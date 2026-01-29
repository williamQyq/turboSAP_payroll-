"""
Generic Module Runner

Runs any module based on its config.
This replaces module-specific graphs for simple config-driven modules.

Handles:
- Session lifecycle (start, answer, complete)
- Question flow with showIf evaluation
- Output generation
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from ..schemas.question import Question
from ..schemas.session import (
    AnswerResult,
    OutputFile,
    SessionState,
    SessionStatus,
    StartSessionResponse,
)
from .module_service import ModuleService, module_service
from .output_generator import OutputGenerator, output_generator
from .question_service import QuestionService, question_service
from .session_output_store import SessionOutputStore, session_output_store

logger = logging.getLogger(__name__)


class ModuleRunnerError(Exception):
    """Base exception for module runner operations."""
    pass


class SessionNotFoundError(ModuleRunnerError):
    """Raised when a session is not found."""
    pass


class ModuleNotFoundError(ModuleRunnerError):
    """Raised when the module doesn't exist."""
    pass


class GenericModuleRunner:
    """
    Runs any module based on its config.

    Manages session state and orchestrates question flow.
    Session state is stored in memory (can be extended to database).
    """

    # In-memory session storage
    # In production, this should be backed by database
    _sessions: Dict[str, SessionState] = {}

    def __init__(
        self,
        module_slug: str,
        module_svc: Optional[ModuleService] = None,
        question_svc: Optional[QuestionService] = None,
        output_gen: Optional[OutputGenerator] = None,
        output_store: Optional[SessionOutputStore] = None,
    ):
        """
        Initialize the module runner for a specific module.

        Args:
            module_slug: The module to run
            module_svc: ModuleService instance
            question_svc: QuestionService instance
            output_gen: OutputGenerator instance
            output_store: SessionOutputStore instance for persisting outputs
        """
        self.module_slug = module_slug
        self.module_service = module_svc or module_service
        self.question_service = question_svc or question_service
        self.output_generator = output_gen or output_generator
        self.output_store = output_store or session_output_store

        # Verify module exists
        if not self.module_service.module_exists(module_slug):
            raise ModuleNotFoundError(f"Module '{module_slug}' not found")

    @classmethod
    def _get_session(cls, session_id: str) -> Optional[SessionState]:
        """Get session from storage."""
        return cls._sessions.get(session_id)

    @classmethod
    def _save_session(cls, session: SessionState) -> None:
        """Save session to storage."""
        cls._sessions[session.session_id] = session

    @classmethod
    def _delete_session(cls, session_id: str) -> None:
        """Delete session from storage."""
        cls._sessions.pop(session_id, None)

    def start_session(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> StartSessionResponse:
        """
        Start a new module session.

        Args:
            user_id: Optional user ID
            session_id: Optional custom session ID (auto-generated if not provided)

        Returns:
            StartSessionResponse with session details
        """
        # Generate session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Check if session already exists
        existing = self._get_session(session_id)
        if existing:
            # Return existing session
            first_question = self.question_service.get_first_question(self.module_slug)
            return StartSessionResponse(
                sessionId=session_id,
                moduleSlug=self.module_slug,
                firstQuestionId=first_question.id if first_question else None,
                sessionState=existing,
            )

        # Create new session
        session = SessionState(
            sessionId=session_id,
            moduleSlug=self.module_slug,
            status=SessionStatus.IN_PROGRESS,
            answers={},
            currentQuestionId=None,
            startedAt=datetime.utcnow(),
            userId=user_id,
        )

        # Get first question
        first_question = self.question_service.get_first_question(self.module_slug)
        if first_question:
            session.current_question_id = first_question.id

        # Save session
        self._save_session(session)

        logger.info(f"Started session '{session_id}' for module '{self.module_slug}'")

        return StartSessionResponse(
            sessionId=session_id,
            moduleSlug=self.module_slug,
            firstQuestionId=first_question.id if first_question else None,
            sessionState=session,
        )

    def get_current_question(self, session_id: str) -> Optional[Question]:
        """
        Get the current/next question for a session.

        Args:
            session_id: Session ID

        Returns:
            Current Question or None if complete
        """
        session = self._get_session(session_id)
        if not session:
            raise SessionNotFoundError(f"Session '{session_id}' not found")

        if session.status == SessionStatus.COMPLETED:
            return None

        # Get next unanswered question
        return self.question_service.get_next_question(
            self.module_slug,
            session.answers,
            session.current_question_id,
        )

    def submit_answer(
        self,
        session_id: str,
        question_id: str,
        answer: Any,
    ) -> AnswerResult:
        """
        Submit an answer for a question.

        Args:
            session_id: Session ID
            question_id: Question being answered
            answer: The answer value

        Returns:
            AnswerResult with next question or completion status
        """
        session = self._get_session(session_id)
        if not session:
            raise SessionNotFoundError(f"Session '{session_id}' not found")

        if session.status == SessionStatus.COMPLETED:
            return AnswerResult(
                success=False,
                message="Session is already completed",
                isComplete=True,
            )

        # Verify question exists
        question = self.question_service.get_question(self.module_slug, question_id)
        if not question:
            return AnswerResult(
                success=False,
                message=f"Question '{question_id}' not found",
            )

        # Store the answer
        session.set_answer(question_id, answer)

        # Find next question
        next_question = self.question_service.get_next_question(
            self.module_slug,
            session.answers,
            question_id,
        )

        if next_question:
            session.current_question_id = next_question.id
            self._save_session(session)

            return AnswerResult(
                success=True,
                nextQuestionId=next_question.id,
                isComplete=False,
                sessionState=session,
            )
        else:
            # No more questions - check if complete
            is_complete = self.question_service.is_module_complete(
                self.module_slug,
                session.answers,
            )

            if is_complete:
                session.status = SessionStatus.COMPLETED
                session.completed_at = datetime.utcnow()
                session.current_question_id = None

                # Save outputs to persistent storage
                self._persist_session_outputs(session)

            self._save_session(session)

            return AnswerResult(
                success=True,
                nextQuestionId=None,
                isComplete=is_complete,
                message="Module completed" if is_complete else None,
                sessionState=session,
            )

    def _persist_session_outputs(self, session: SessionState) -> None:
        """
        Persist session outputs to the output store.

        Called when a session is completed.
        """
        try:
            # Generate outputs
            output_files = self.output_generator.generate_output(
                self.module_slug,
                session.answers,
            )

            # Convert to storable format (CSV strings)
            outputs = {}
            for filename, output_file in output_files.items():
                outputs[filename] = output_file.to_csv()

            # Prepare metadata
            metadata = {
                "completedAt": session.completed_at.isoformat() + "Z" if session.completed_at else None,
                "startedAt": session.started_at.isoformat() + "Z" if session.started_at else None,
                "answersCount": len(session.answers),
                "userId": session.user_id,
            }

            # Save to store
            self.output_store.save_output(
                module_slug=self.module_slug,
                session_id=session.session_id,
                outputs=outputs,
                metadata=metadata,
            )

            logger.info(
                f"Persisted outputs for session '{session.session_id}' "
                f"({len(outputs)} files)"
            )

        except Exception as e:
            # Log error but don't fail the completion
            logger.error(
                f"Failed to persist outputs for session '{session.session_id}': {e}"
            )

    def get_session_state(self, session_id: str) -> SessionState:
        """
        Get full session state including all answers.

        Args:
            session_id: Session ID

        Returns:
            SessionState

        Raises:
            SessionNotFoundError: If session doesn't exist
        """
        session = self._get_session(session_id)
        if not session:
            raise SessionNotFoundError(f"Session '{session_id}' not found")

        return session

    def generate_output(self, session_id: str) -> Dict[str, OutputFile]:
        """
        Generate output files from session answers.

        Args:
            session_id: Session ID

        Returns:
            Dict of filename -> OutputFile
        """
        session = self._get_session(session_id)
        if not session:
            raise SessionNotFoundError(f"Session '{session_id}' not found")

        return self.output_generator.generate_output(
            self.module_slug,
            session.answers,
        )

    def abandon_session(self, session_id: str) -> bool:
        """
        Mark a session as abandoned.

        Args:
            session_id: Session ID

        Returns:
            True if session was abandoned
        """
        session = self._get_session(session_id)
        if not session:
            return False

        session.status = SessionStatus.ABANDONED
        self._save_session(session)

        logger.info(f"Abandoned session '{session_id}'")

        return True

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session entirely.

        Args:
            session_id: Session ID

        Returns:
            True if session was deleted
        """
        session = self._get_session(session_id)
        if not session:
            return False

        self._delete_session(session_id)

        logger.info(f"Deleted session '{session_id}'")

        return True

    def get_progress(self, session_id: str) -> Dict[str, Any]:
        """
        Get progress information for a session.

        Args:
            session_id: Session ID

        Returns:
            Dict with progress info (answered, total, percentage)
        """
        session = self._get_session(session_id)
        if not session:
            raise SessionNotFoundError(f"Session '{session_id}' not found")

        visible_questions = self.question_service.get_visible_questions(
            self.module_slug,
            session.answers,
        )

        total = len(visible_questions)
        answered = sum(1 for q in visible_questions if q.id in session.answers)

        return {
            "answered": answered,
            "total": total,
            "percentage": round(answered / total * 100) if total > 0 else 0,
            "isComplete": session.status == SessionStatus.COMPLETED,
        }


def get_module_runner(module_slug: str) -> GenericModuleRunner:
    """
    Factory function to get a module runner for a specific module.

    Args:
        module_slug: Module to run

    Returns:
        GenericModuleRunner instance
    """
    return GenericModuleRunner(module_slug)
