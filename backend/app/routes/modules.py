"""
Generic Modules API Routes

API endpoints for managing config-driven modules.
These routes use the service layer - no business logic here.

Module CRUD:
- GET    /api/modules                           - List all modules
- POST   /api/modules                           - Create new module
- GET    /api/modules/{slug}                    - Get module config
- PUT    /api/modules/{slug}                    - Update module metadata
- DELETE /api/modules/{slug}                    - Delete module

Question CRUD:
- GET    /api/modules/{slug}/questions          - List questions
- POST   /api/modules/{slug}/questions          - Add question
- GET    /api/modules/{slug}/questions/{id}     - Get question
- PUT    /api/modules/{slug}/questions/{id}     - Update question
- DELETE /api/modules/{slug}/questions/{id}     - Delete question
- PUT    /api/modules/{slug}/questions/reorder  - Reorder questions

Session (user-facing):
- POST   /api/modules/{slug}/sessions           - Start session
- GET    /api/modules/{slug}/sessions/{sid}     - Get session state
- POST   /api/modules/{slug}/sessions/{sid}/answer  - Submit answer
- GET    /api/modules/{slug}/sessions/{sid}/output  - Get generated output
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from ..middleware import get_current_user, require_admin
from ..schemas.module import (
    CreateModuleRequest,
    ModuleConfig,
    ModuleSummary,
    UpdateModuleRequest,
)
from ..schemas.question import Question
from ..schemas.session import (
    AnswerResult,
    GenerateOutputResponse,
    SessionState,
    StartSessionResponse,
    SubmitAnswerRequest,
)
from ..services.module_runner import (
    GenericModuleRunner,
    ModuleRunnerError,
    SessionNotFoundError,
    get_module_runner,
)
from ..services.module_service import (
    ModuleAlreadyExistsError,
    ModuleNotFoundError as ModuleServiceNotFoundError,
    ModuleService,
    ModuleServiceError,
    module_service,
)
from ..services.question_service import (
    ModuleNotFoundError as QuestionModuleNotFoundError,
    QuestionNotFoundError,
    QuestionService,
    QuestionServiceError,
    question_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/modules", tags=["Modules"])


# =============================================================================
# Module CRUD Endpoints
# =============================================================================


@router.get("", response_model=Dict[str, List[ModuleSummary]])
async def list_modules(
    current_user: dict = Depends(get_current_user),
):
    """
    List all available modules.

    Returns modules discovered from the filesystem.
    """
    try:
        modules = module_service.list_modules()
        return {"modules": modules}
    except Exception as e:
        logger.error(f"Error listing modules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Dict[str, Any], status_code=201)
async def create_module(
    request: CreateModuleRequest,
    current_user: dict = Depends(require_admin),
):
    """
    Create a new module. Admin only.

    Creates the module directory with config.json and empty questions.json.
    """
    try:
        created_by = current_user.get("username", "system")
        module = module_service.create_module(request, created_by=created_by)

        return {
            "success": True,
            "message": f"Module '{module.slug}' created successfully",
            "module": ModuleSummary(
                slug=module.slug,
                name=module.name,
                description=module.metadata.description,
                category=module.metadata.category,
                icon=module.metadata.icon,
                status=module.metadata.status,
                order=module.metadata.order,
                question_count=len(module.questions),
                output_files=module.get_output_files(),
                has_config=True,
                has_questions=len(module.questions) > 0,
            ),
        }
    except ModuleAlreadyExistsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ModuleServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating module: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{slug}", response_model=Dict[str, Any])
async def get_module(
    slug: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get module configuration including metadata and questions.
    """
    module = module_service.get_module(slug)
    if not module:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")

    return {
        "slug": module.slug,
        "name": module.name,
        "metadata": module.metadata.model_dump(by_alias=True),
        "questions": [q.model_dump(by_alias=True, exclude_none=True) for q in module.questions],
        "outputFiles": module.get_output_files(),
    }


@router.put("/{slug}", response_model=Dict[str, Any])
async def update_module(
    slug: str,
    request: UpdateModuleRequest,
    current_user: dict = Depends(require_admin),
):
    """
    Update module metadata. Admin only.
    """
    try:
        updated_by = current_user.get("username", "system")
        module = module_service.update_module(slug, request, updated_by=updated_by)

        return {
            "success": True,
            "message": f"Module '{slug}' updated successfully",
            "module": module.metadata.model_dump(by_alias=True),
        }
    except ModuleServiceNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except ModuleServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating module: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{slug}", response_model=Dict[str, Any])
async def delete_module(
    slug: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a module and all its files. Admin only.
    """
    deleted = module_service.delete_module(slug)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")

    return {
        "success": True,
        "message": f"Module '{slug}' deleted successfully",
    }


# =============================================================================
# Question CRUD Endpoints
# =============================================================================


@router.get("/{slug}/questions", response_model=Dict[str, Any])
async def list_questions(
    slug: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get all questions for a module, ordered.
    """
    try:
        questions = question_service.get_questions(slug)
        return {
            "moduleSlug": slug,
            "questions": [q.model_dump(by_alias=True, exclude_none=True) for q in questions],
            "count": len(questions),
        }
    except QuestionModuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except Exception as e:
        logger.error(f"Error listing questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{slug}/questions", response_model=Dict[str, Any], status_code=201)
async def add_question(
    slug: str,
    question: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Add a new question to a module. Admin only.

    Question ID is auto-generated if not provided.
    """
    try:
        created = question_service.add_question(slug, question)
        return {
            "success": True,
            "message": f"Question '{created.id}' added successfully",
            "question": created.model_dump(by_alias=True, exclude_none=True),
        }
    except QuestionModuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except QuestionServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{slug}/questions/{question_id}", response_model=Dict[str, Any])
async def get_question(
    slug: str,
    question_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get a single question by ID.
    """
    try:
        question = question_service.get_question(slug, question_id)
        if not question:
            raise HTTPException(
                status_code=404,
                detail=f"Question '{question_id}' not found in module '{slug}'",
            )
        return {
            "moduleSlug": slug,
            "question": question.model_dump(by_alias=True, exclude_none=True),
        }
    except QuestionModuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except Exception as e:
        logger.error(f"Error getting question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{slug}/questions/{question_id}", response_model=Dict[str, Any])
async def update_question(
    slug: str,
    question_id: str,
    updates: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update an existing question. Admin only.
    """
    try:
        updated = question_service.update_question(slug, question_id, updates)
        return {
            "success": True,
            "message": f"Question '{question_id}' updated successfully",
            "question": updated.model_dump(by_alias=True, exclude_none=True),
        }
    except QuestionModuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except QuestionNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Question '{question_id}' not found in module '{slug}'",
        )
    except QuestionServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{slug}/questions/{question_id}", response_model=Dict[str, Any])
async def delete_question(
    slug: str,
    question_id: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a question. Admin only.
    """
    try:
        deleted = question_service.delete_question(slug, question_id)
        if not deleted:
            raise HTTPException(
                status_code=404,
                detail=f"Question '{question_id}' not found in module '{slug}'",
            )
        return {
            "success": True,
            "message": f"Question '{question_id}' deleted successfully",
        }
    except QuestionModuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except Exception as e:
        logger.error(f"Error deleting question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{slug}/questions/reorder", response_model=Dict[str, Any])
async def reorder_questions(
    slug: str,
    order_data: Dict[str, List[str]] = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Reorder questions by providing ordered list of IDs. Admin only.

    Expected payload: {"questionIds": ["q1", "q2", "q3"]}
    """
    try:
        question_ids = order_data.get("questionIds", [])
        if not question_ids:
            raise HTTPException(status_code=400, detail="questionIds list is required")

        questions = question_service.reorder_questions(slug, question_ids)
        return {
            "success": True,
            "message": "Questions reordered successfully",
            "questions": [q.model_dump(by_alias=True, exclude_none=True) for q in questions],
        }
    except QuestionModuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Module '{slug}' not found")
    except Exception as e:
        logger.error(f"Error reordering questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Session Endpoints (User-Facing)
# =============================================================================


@router.post("/{slug}/sessions", response_model=Dict[str, Any], status_code=201)
async def start_session(
    slug: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Start a new module session.

    Returns session ID and first question.
    """
    try:
        runner = get_module_runner(slug)
        user_id = current_user.get("user_id")
        response = runner.start_session(user_id=user_id)

        return {
            "success": True,
            "sessionId": response.session_id,
            "moduleSlug": slug,
            "firstQuestionId": response.first_question_id,
            "status": response.session_state.status.value,
        }
    except ModuleRunnerError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{slug}/sessions/{session_id}", response_model=Dict[str, Any])
async def get_session(
    slug: str,
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get session state including all answers.
    """
    try:
        runner = get_module_runner(slug)
        session = runner.get_session_state(session_id)

        # Get current question
        current_question = None
        if session.current_question_id:
            q = question_service.get_question(slug, session.current_question_id)
            if q:
                current_question = q.model_dump(by_alias=True, exclude_none=True)

        # Get progress
        progress = runner.get_progress(session_id)

        return {
            "sessionId": session_id,
            "moduleSlug": slug,
            "status": session.status.value,
            "answers": session.answers,
            "currentQuestionId": session.current_question_id,
            "currentQuestion": current_question,
            "progress": progress,
            "startedAt": session.started_at.isoformat() if session.started_at else None,
            "completedAt": session.completed_at.isoformat() if session.completed_at else None,
        }
    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    except ModuleRunnerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{slug}/sessions/{session_id}/answer", response_model=Dict[str, Any])
async def submit_answer(
    slug: str,
    session_id: str,
    request: SubmitAnswerRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit an answer for a question.

    Returns next question or completion status.
    """
    try:
        runner = get_module_runner(slug)
        result = runner.submit_answer(session_id, request.question_id, request.value)

        # Get next question details if available
        next_question = None
        if result.next_question_id:
            q = question_service.get_question(slug, result.next_question_id)
            if q:
                next_question = q.model_dump(by_alias=True, exclude_none=True)

        # Get progress
        progress = runner.get_progress(session_id)

        return {
            "success": result.success,
            "message": result.message,
            "nextQuestionId": result.next_question_id,
            "nextQuestion": next_question,
            "isComplete": result.is_complete,
            "progress": progress,
        }
    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    except ModuleRunnerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{slug}/sessions/{session_id}/output", response_model=Dict[str, Any])
async def get_session_output(
    slug: str,
    session_id: str,
    format: str = Query(default="json", description="Output format: json or csv"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get generated output files for a completed session.
    """
    try:
        runner = get_module_runner(slug)
        output_files = runner.generate_output(session_id)

        if format == "csv":
            # Return CSV content for each file
            csv_outputs = {}
            for filename, output_file in output_files.items():
                csv_outputs[filename] = output_file.to_csv()
            return {"files": csv_outputs, "format": "csv"}
        else:
            # Return JSON structure
            json_outputs = {}
            for filename, output_file in output_files.items():
                json_outputs[filename] = {
                    "columns": output_file.columns,
                    "rows": output_file.to_dict_rows(),
                }
            return {"files": json_outputs, "format": "json"}

    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    except ModuleRunnerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating output: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{slug}/sessions/{session_id}/output/{filename}")
async def download_output_file(
    slug: str,
    session_id: str,
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Download a specific output file as CSV.
    """
    try:
        runner = get_module_runner(slug)
        output_files = runner.generate_output(session_id)

        if filename not in output_files:
            raise HTTPException(
                status_code=404,
                detail=f"Output file '{filename}' not found. Available: {list(output_files.keys())}",
            )

        csv_content = output_files[filename].to_csv()

        return PlainTextResponse(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    except ModuleRunnerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{slug}/sessions/{session_id}", response_model=Dict[str, Any])
async def delete_session(
    slug: str,
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete/abandon a session.
    """
    try:
        runner = get_module_runner(slug)
        deleted = runner.delete_session(session_id)

        if not deleted:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

        return {
            "success": True,
            "message": f"Session '{session_id}' deleted successfully",
        }
    except ModuleRunnerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
