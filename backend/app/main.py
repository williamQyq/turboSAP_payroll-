"""
FastAPI backend for TurboSAP Payroll Area Configuration.

Architecture: Single-Instance, Single-Customer Deployment
- Each deployment is completely isolated (one customer = one instance)
- Each instance has its own database, users, sessions, and configuration
- No multi-tenancy: no tenant_id, no cross-instance data sharing
- No super admin: admin role is scoped to instance only, no cross-instance management

Endpoints:
- POST /api/auth/register  - Register a new user (disabled - admin only)
- POST /api/auth/login      - Login and get JWT token
- GET  /api/auth/me         - Get current user info
- POST /api/start           - Start a new configuration session
- POST /api/answer          - Submit an answer and get the next question
- GET  /api/sessions        - Get user's saved sessions
- POST /api/sessions/save   - Save current session
- GET  /api/sessions/{id}   - Load a saved session

Run with: uvicorn app.main:app --reload --port 8000
"""

import uuid
import shutil
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Body
from app.agents.payments.payment_method_graph import payment_method_graph
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.routes.export_api import router as export_router


from .services.questions import get_question, get_first_question
from .agents.graph import master_graph, payroll_graph, PayrollState
from .database import (
    create_user,
    get_user_by_username,
    get_user_by_id,
    update_user_last_login,
    update_user_profile,
    create_session as db_create_session,
    get_session as db_get_session,
    get_user_sessions,
    delete_session as db_delete_session, init_database,
)
from .auth import hash_password, verify_password, create_token
from .middleware import get_current_user, get_optional_user, require_admin
from .roles import is_valid_role, ADMIN_ROLE, CLIENT_ROLE, is_admin

from .config.configuration import (
    load_current_questions,
    load_original_questions,
    save_current_questions,
    init_from_upload,
    restore_original,
)
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os


from .routes import data_terminal, ai_config, module_config, knowledgebase, hierarchy, modules

ENV = os.getenv("APP_ENV", "development")

from contextlib import asynccontextmanager

# ============================================
# FastAPI App Setup
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()

    # Startup: Initialize database and seed users
    users_to_seed = [
        {"username": "admin123", "password": "admin123", "role": "admin", "company_name": "Admin Corp"},
        {"username": "test123", "password": "test123", "role": "client", "company_name": "Test Client Inc"}
    ]

    for u in users_to_seed:
        if not get_user_by_username(u["username"]):
            print(f"[Seeding] Creating user: {u['username']}")
            pw_hash = hash_password(u["password"])
            try:
                create_user(
                    username=u["username"],
                    password_hash=pw_hash,
                    role=u["role"],
                    company_name=u["company_name"]
                )
                print(f"[Seeding] Successfully created {u['username']}")
            except Exception as e:
                print(f"[Seeding] Error creating {u['username']}: {e}")
        else:
            print(f"[Seeding] User already exists: {u['username']}")

    # Seed hierarchy (categories & tasks) if empty
    from .database import count_categories, create_category, create_task
    if count_categories() == 0:
        print("[Seeding] Creating initial hierarchy...")
        # Categories
        create_category("enterprise-structure", "Enterprise Structure", display_order=10)
        create_category("banking", "Banking", display_order=20)
        create_category("personnel-admin", "Personnel Administration", display_order=30)
        # Tasks under Enterprise Structure (matching existing module slugs)
        create_task("payroll-area", "Payroll Area", "enterprise-structure", display_order=10)
        create_task("company-code", "Company Code", "enterprise-structure", display_order=20)
        create_task("personnel-area", "Personnel Area", "enterprise-structure", display_order=30)
        create_task("employee-group", "Employee Group", "enterprise-structure", display_order=40)
        create_task("employee-subgroup", "Employee Subgroup", "enterprise-structure", display_order=50)
        # Tasks under Banking
        create_task("payment-method", "Payment Method", "banking", display_order=10)
        print("[Seeding] Hierarchy created successfully")
    else:
        print("[Seeding] Hierarchy already exists, skipping")

    yield
    # Shutdown logic (if any)

app = FastAPI(
    title="TurboSAP Payroll Configuration API",
    description="API for configuring SAP payroll areas through a guided Q&A flow",
    version="default_code.0.0",
    lifespan=lifespan
)
app.include_router(export_router)

# ====== frontend static files ======
frontend_dir = Path(__file__).parent / "static"

# Serve all static assets (JS, CSS, images)
if ENV == "production":
    app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

# Mount API routers that live in app.routes
app.include_router(data_terminal.router)
app.include_router(ai_config.router)
app.include_router(module_config.router)
app.include_router(knowledgebase.router)
app.include_router(hierarchy.router)
app.include_router(modules.router)

# Serve uploaded logos (in both dev and production)
uploads_dir = Path(__file__).parent.parent / "uploads"
if not uploads_dir.exists():
    uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Mount API routers that live in app.routes
app.include_router(data_terminal.router)

# CORS - Allow React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Vite alternate port
        "http://localhost:5175",  # Vite alternate port
        "http://localhost:3000",  # CRA default
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
        "http://turbosap-py312-env.eba-5hg7r3id.us-east-2.elasticbeanstalk.com",
        "TurboSAP-pre-stage-py312.eba-5hg7r3id.us-east-2.elasticbeanstalk.com",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Session Storage
# Now using SQLite database instead of in-memory
# ============================================

# Keep in-memory sessions for backward compatibility (anonymous sessions)
sessions: dict[str, PayrollState] = {}

# ============================================
# Helper Functions
# ============================================

def calculate_progress(state: PayrollState) -> int:
    """Calculate completion progress (0-100)."""
    answers = state.get("answers", {})
    answered_count = len(answers)

    # Estimate total questions (varies based on answers)
    # Base: q1_frequencies = default_code
    # Each frequency adds ~2 questions (pattern + payday)
    # Each calendar combo adds ~4 questions (business, business_names, geographic, regions)
    frequencies = answers.get("q1_frequencies", [])
    if isinstance(frequencies, str):
        frequencies = [frequencies]

    num_frequencies = len(frequencies)
    # Estimate: default_code + (2 * freqs) + (4 * freqs) = default_code + 6*freqs
    # But some questions are conditional, so be conservative
    estimated_total = 1 + (num_frequencies * 6)

    if state.get("done"):
        return 100

    return min(int((answered_count / max(estimated_total, 1)) * 100), 95)

def cfg(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}



# ============================================
# API Endpoints
# ============================================

@app.get("/api/health")
def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "TurboSAP Payroll Configuration API"}


# ============================================
# Authentication Endpoints
# ============================================

@app.post("/api/auth/register")
def register(request: dict = Body(...)):
    """
    Public registration is disabled.
    Users must be created by administrators through the admin panel.
    """
    raise HTTPException(
        status_code=403,
        detail="Public registration is disabled. Please contact an administrator to create an account."
    )


@app.post("/api/auth/login")
def login(request: dict = Body(...)):
    """
    Login and get JWT token.

    Current: Single-factor authentication (username + password).
    Future: Will support MFA (Multi-Factor Authentication) via email OTP, SMS OTP, or TOTP.
            If MFA is enabled, this will return a temporary token and require a second step.

    Request body:
        {
            "username": "user123",
            "password": "securepassword"
        }

    Returns (current):
        {
            "userId": default_code,
            "username": "user123",
            "role": "client",
            "companyName": "ABC Corp",
            "logoPath": "/uploads/logos/3.png",
            "token": "jwt_token_here"
        }

    Returns (future - if MFA enabled):
        {
            "requiresMFA": true,
            "tempToken": "temporary_token",
            "mfaMethod": "email" | "sms" | "totp"
        }
    """
    username = request.get("username")
    password = request.get("password")

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    # Get user
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Verify password
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Update last login
    update_user_last_login(user["id"])

    # Generate token
    token = create_token(user["id"], user["username"], user["role"])

    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "companyName": user.get("company_name"),
        "logoPath": user.get("logo_path"),
        "token": token,
    }


@app.get("/api/auth/me")
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Requires authentication.
    """
    user = get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "companyName": user.get("company_name"),
        "logoPath": user.get("logo_path"),
        "createdAt": user.get("created_at") + "Z" if user.get("created_at") else None,
        "lastLogin": user.get("last_login") + "Z" if user.get("last_login") else None,
    }


@app.post("/api/auth/change-password")
async def change_password(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Change current user's password.
    
    User must provide their current password for verification.
    System does not support password recovery - old passwords cannot be retrieved.
    
    Request body:
        {
            "currentPassword": "oldpass123",
            "newPassword": "newpass456"
        }
    
    Returns:
        {
            "status": "ok",
            "message": "Password changed successfully"
        }
    """
    current_password = request.get("currentPassword")
    new_password = request.get("newPassword")
    
    # Validate input
    if not current_password:
        raise HTTPException(status_code=400, detail="Current password is required")
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    if current_password == new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Get user from database
    user = get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Hash new password and update
    new_password_hash = hash_password(new_password)
    from .database import update_user_password
    update_user_password(user["id"], new_password_hash)
    
    return {
        "status": "ok",
        "message": "Password changed successfully"
    }


@app.post("/api/start")
async def start_session(
    request: dict = Body({}),
    authorization: Optional[str] = Header(None),
):
    """
    Start a new configuration session for any module.

    Request body (optional):
        {
            "module": "payroll_area" | "payment_method",  // Defaults to "payroll_area"
            "companyName": "ABC Corp"
        }

    Headers (optional):
        Authorization: Bearer <token> - If provided, session will be saved to database

    Returns:
        { "sessionId": "...", "question": {...}, "module": "..." }
    """
    session_id = str(uuid.uuid4())
    module = request.get("module", "payroll_area")  # Get module from request

    # Map module name to database format
    module_db_name = {
        "payroll_area": "payroll area",
        "payment_method": "payment method",
    }.get(module, module)

    # Initialize master graph state
    initial_state = {
        "session_id": session_id,
        "answers": {},
        "current_question_id": None,
        "current_question": None,
        "completed_modules": [],
        "current_module": module,  # Tell master graph which module to start
        "payroll_areas": [],
        "payment_methods": [],
        "done": False,
    }

    # Run master graph to get first question
    result = master_graph.invoke(initial_state, config=cfg(session_id))


    # Try to get current user (optional authentication)
    current_user = None
    try:
        current_user = await get_optional_user(authorization)
    except:
        pass

    # Store session - use database if authenticated, otherwise in-memory
    if current_user:
        db_create_session(
            session_id=session_id,
            user_id=current_user["user_id"],
            config_state=result,
            module=module_db_name,  # Save module name
        )
    else:
        sessions[session_id] = result

    # Get the question details
    question_id = result.get("current_question_id")

    # Check if question is dynamic (from graph) or in JSON
    question = result.get("current_question")
    if not question:
        # Question is in JSON file - need to determine which module's questions
        if module == "payment_method":
            question = get_question(question_id, "payment_method") if question_id else get_first_question("payment_method")
        else:
            question = get_question(question_id) if question_id else get_first_question()

    return {
        "sessionId": session_id,
        "question": question,
        "module": module,  # Return module so frontend knows which one started
    }




@app.post("/api/answer")
async def submit_answer(
    request: dict,
    authorization: Optional[str] = Header(None),
):
    session_id = request.get("sessionId")
    question_id = request.get("questionId")
    answer = request.get("answer")

    # Validate request
    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId is required")
    if not question_id:
        raise HTTPException(status_code=400, detail="questionId is required")
    if answer is None:
        raise HTTPException(status_code=400, detail="answer is required")

    current_user = await get_optional_user(authorization)

    # --------------------------------------------
    # 1) Load state: MemorySaver -> DB -> legacy dict
    # --------------------------------------------
    state = None

    # (A) MemorySaver state (preferred)
    snapshot = master_graph.get_state(cfg(session_id))
    if snapshot and snapshot.values:
        state = snapshot.values

    # (B) DB fallback if authenticated
    if state is None and current_user:
        db_session = db_get_session(session_id)
        if db_session and db_session["user_id"] == current_user["user_id"]:
            state = db_session["config_state"]
            # Optional: seed memory so next calls hit MemorySaver
            master_graph.invoke(state, config=cfg(session_id))

    # (C) Legacy in-memory dict fallback (anonymous)
    if state is None:
        state = sessions.get(session_id)
        if state:
            # Optional: seed memory
            master_graph.invoke(state, config=cfg(session_id))

    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # --------------------------------------------
    # 2) Store answer into state
    # --------------------------------------------
    state.setdefault("answers", {})
    state["answers"][question_id] = answer

    # --------------------------------------------
    # 3) Run graph: IMPORTANT => use master_graph
    # --------------------------------------------
    result = master_graph.invoke(state, config=cfg(session_id))

    # --------------------------------------------
    # 4) Persist result (optional)
    #    - MemorySaver is already updated automatically
    #    - Keep DB write if you want durability for authed users
    # --------------------------------------------
    if current_user:
        module = result.get("current_module", "payroll_area")
        module_db_name = {
            "payroll_area": "payroll area",
            "payment_method": "payment method",
        }.get(module, module)

        db_create_session(
            session_id=session_id,
            user_id=current_user["user_id"],
            config_state=result,
            module=module_db_name,
        )
    else:
        # Keep legacy dict updated if you still support it
        sessions[session_id] = result

    # --------------------------------------------
    # 5) Response
    # --------------------------------------------
    progress = calculate_progress(result)

    # done or no next question
    if result.get("done") or not result.get("current_question_id"):
        response = {
            "sessionId": session_id,
            "done": True,
            "progress": 100,
            "message": result.get("message", "Configuration complete."),
        }
        if result.get("payroll_areas"):
            response["payrollAreas"] = result.get("payroll_areas", [])
        if result.get("payment_methods"):
            response["paymentMethods"] = result.get("payment_methods", [])
        return response

    # next question (dynamic or from JSON)
    next_question_id = result.get("current_question_id")
    next_question = result.get("current_question")

    if not next_question:
        current_module = result.get("current_module", "payroll_area")
        if current_module == "payment_method":
            next_question = get_question(next_question_id, "payment_method")
        else:
            next_question = get_question(next_question_id)

    if not next_question:
        raise HTTPException(status_code=500, detail=f"Question not found: {next_question_id}")

    return {
        "sessionId": session_id,
        "done": False,
        "progress": progress,
        "question": next_question,
    }


@app.get("/api/session/{session_id}")
async def get_session_state(
    session_id: str,
    authorization: Optional[str] = Header(None),
):
    current_user = await get_optional_user(authorization)

    state = None

    # A) MemorySaver
    snapshot = master_graph.get_state(cfg(session_id))
    if snapshot and snapshot.values:
        state = snapshot.values

    # B) DB fallback (authed)
    if state is None and current_user:
        db_session = db_get_session(session_id)
        if db_session and db_session["user_id"] == current_user["user_id"]:
            state = db_session["config_state"]
            # seed memory so future calls hit MemorySaver
            master_graph.invoke(state, config=cfg(session_id))

    # C) legacy dict fallback (anonymous)
    if state is None:
        state = sessions.get(session_id)
        if state:
            master_graph.invoke(state, config=cfg(session_id))

    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "sessionId": session_id,
        "module": state.get("current_module"),
        "answers": state.get("answers", {}),
        "currentQuestionId": state.get("current_question_id"),
        "question": state.get("current_question"),
        "done": state.get("done", False),
        "paymentMethods": state.get("payment_methods", []),
        "payrollAreas": state.get("payroll_areas", []),
    }



# ============================================
# Session Management Endpoints
# ============================================

@app.get("/api/sessions")
async def list_user_sessions(
    module: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get all saved sessions for the current user.

    Query params:
        module: Optional filter by module (e.g., "payroll area")

    Returns:
        List of session objects
    """
    sessions_list = get_user_sessions(current_user["user_id"], module)
    return {
        "sessions": [
            {
                "id": s["id"],
                "module": s["module"],
                "updatedAt": s["updated_at"],
                "progress": calculate_progress(s["config_state"]),
                "done": s["config_state"].get("done", False),
            }
            for s in sessions_list
        ]
    }


@app.post("/api/sessions/save")
async def save_session(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Save the current session to database.

    Request body:
        {
            "sessionId": "...",
            "module": "payroll area" (optional, defaults to "payroll area")
        }

    Returns:
        { "status": "ok", "sessionId": "..." }
    """
    session_id = request.get("sessionId")
    module = request.get("module", "payroll area")

    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId is required")

    # Get session from in-memory or database
    state = sessions.get(session_id)
    if not state:
        # Try database
        db_session = db_get_session(session_id)
        if db_session:
            state = db_session["config_state"]
    
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save to database
    db_create_session(
        session_id=session_id,
        user_id=current_user["user_id"],
        config_state=state,
        module=module,
    )

    return {"status": "ok", "sessionId": session_id}


@app.get("/api/sessions/{session_id}")
async def load_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Load a saved session and return the first question or results.

    Returns:
        { "sessionId": "...", "question": {...} } or { "sessionId": "...", "done": true, "payrollAreas": [...] }
    """
    db_session = db_get_session(session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if db_session["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    state = db_session["config_state"]

    # If done, return results
    if state.get("done"):
        return {
            "sessionId": session_id,
            "done": True,
            "progress": 100,
            "payrollAreas": state.get("payroll_areas", []),
            "message": state.get("message", "Configuration complete."),
        }

    # Otherwise, return current question
    question_id = state.get("current_question_id")
    question = state.get("current_question")
    if not question and question_id:
        question = get_question(question_id)

    return {
        "sessionId": session_id,
        "question": question,
        "progress": calculate_progress(state),
    }


@app.delete("/api/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a saved session.

    Returns:
        { "status": "ok" }
    """
    db_session = db_get_session(session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if db_session["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    db_delete_session(session_id)
    return {"status": "ok"}

@app.get("/api/config/questions/current")
def get_current_config():
    """Get current questions configuration. Available to all authenticated users."""
    return load_current_questions()

@app.get("/api/config/questions/original")
async def get_original_config(current_user: dict = Depends(get_current_user)):
    """Get original questions configuration. Available to all authenticated users."""
    return load_original_questions()

@app.post("/api/config/questions/upload")
async def upload_questions_config(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """Upload questions configuration. Admin only."""
    try:
        init_from_upload(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.put("/api/config/questions/current")
async def update_current_config(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """Update current questions configuration. Admin only."""
    try:
        save_current_questions(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.post("/api/config/questions/restore")
async def restore_questions_config(current_user: dict = Depends(require_admin)):
    """Restore original questions configuration. Admin only."""
    restore_original()
    return {"status": "ok"}


# ============================================
# Admin Management Endpoints
# ============================================

@app.post("/api/admin/users")
async def create_user_by_admin(
    request: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Create a new user (admin only).
    
    Request body:
        {
            "username": "newuser",
            "password": "securepassword",
            "role": "client" | "admin",
            "companyName": "ABC Corp" (optional)
        }
    
    Returns:
        {
            "userId": default_code,
            "username": "newuser",
            "role": "client",
            "companyName": "ABC Corp"
        }
    """
    username = request.get("username")
    password = request.get("password")
    role = request.get("role", "client")
    company_name = request.get("companyName")
    
    # Validate input
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    # Use role validation utility (allows future extension to module roles)
    if not is_valid_role(role):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid role. Must be '{CLIENT_ROLE}' or '{ADMIN_ROLE}'"
        )
    
    # Check if username already exists
    existing_user = get_user_by_username(username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    try:
        password_hash = hash_password(password)
        user_id = create_user(
            username=username,
            password_hash=password_hash,
            role=role,
            company_name=company_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Get created user
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=500, detail="Failed to retrieve created user")
    
    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "companyName": user.get("company_name"),
        "createdAt": user.get("created_at"),
    }


@app.get("/api/admin/users")
async def list_all_users(current_user: dict = Depends(require_admin)):
    """
    List all users. Admin only.

    Returns:
        List of all users (without password hashes)
    """
    from .database import get_db_connection
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, role, logo_path, company_name, created_at, last_login
            FROM users
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        users = []
        for row in rows:
            user_dict = dict(row)
            # Convert snake_case to camelCase for frontend
            users.append({
                "id": user_dict.get("id"),
                "username": user_dict.get("username"),
                "role": user_dict.get("role"),
                "logoPath": user_dict.get("logo_path"),
                "companyName": user_dict.get("company_name"),
                "createdAt": user_dict.get("created_at") + "Z" if user_dict.get("created_at") else None,
                "lastLogin": user_dict.get("last_login") + "Z" if user_dict.get("last_login") else None,
            })
        return {"users": users}


@app.get("/api/admin/users/{user_id}/progress")
async def get_user_progress(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    from .database import get_user_by_id
    
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    sessions_list = get_user_sessions(user_id)
    
    payroll_status = "not-started"
    payment_status = "not-started"
    last_activity = None
    
    for session in sessions_list:
        config_state = session.get("config_state", {})
        updated_at = session.get("updated_at")
        completed_modules = config_state.get("completed_modules", [])
        answers = config_state.get("answers", {})
        
        if updated_at and (not last_activity or updated_at > last_activity):
            last_activity = updated_at
        
        if "payroll_area" in completed_modules or config_state.get("payroll_areas"):
            payroll_status = "completed"
        elif any(key.startswith(("q1_frequencies", "q1_weekly", "q1_biweekly", "q1_semimonthly", "q1_monthly", "business_", "geographic_", "regions_")) for key in answers.keys()):
            if payroll_status != "completed":
                payroll_status = "in-progress"
        
        if "payment_method" in completed_modules or config_state.get("payment_methods"):
            payment_status = "completed"
        elif any(key.startswith(("q1_payment_method", "q2_payment_method", "q3_payment_method", "q4_payment_method", "q5_pre_note", "q1_p_", "q2_q_")) for key in answers.keys()):
            if payment_status != "completed":
                payment_status = "in-progress"
    
    return {
        "payrollArea": payroll_status,
        "paymentMethod": payment_status,
        "lastActivity": last_activity + "Z" if last_activity else None,
    }


@app.get("/api/admin/users/{user_id}")
async def get_user_details(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Get user details by ID. Admin only.
    """
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove password hash from response
    user.pop("password_hash", None)
    return user


@app.put("/api/admin/users/{user_id}")
async def update_user_role(
    user_id: int,
    request: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update user role. Admin only.

    Request body:
        {
            "role": "client" | "admin" (future: "ROLE_PAYROLL", "ROLE_FINANCE", etc.)
        }
    """
    new_role = request.get("role")
    # Use role validation utility (allows future extension to module roles)
    if not is_valid_role(new_role):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid role. Must be '{CLIENT_ROLE}' or '{ADMIN_ROLE}'"
        )
    
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from removing their own admin role
    if user_id == current_user["user_id"] and not is_admin(new_role):
        raise HTTPException(
            status_code=400,
            detail="Cannot remove your own admin role"
        )
    
    from .database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET role = ?
            WHERE id = ?
        """, (new_role, user_id))
        conn.commit()
    
    return {"status": "ok", "userId": user_id, "role": new_role}


@app.put("/api/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    request: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Reset a user's password. Admin only.
    
    Admin can reset any user's password to a new temporary password.
    System does not support viewing or recovering old passwords.
    
    Request body:
        {
            "newPassword": "newtemp123"
        }
    
    Returns:
        {
            "status": "ok",
            "message": "Password reset successfully for user 'username'"
        }
    """
    new_password = request.get("newPassword")
    
    # Validate input
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Check if user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash new password and update
    new_password_hash = hash_password(new_password)
    from .database import update_user_password
    update_user_password(user_id, new_password_hash)
    
    return {
        "status": "ok",
        "message": f"Password reset successfully for user '{user['username']}'"
    }


# ============================================
# Logo Upload Endpoint
# ============================================

@app.post("/api/upload/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload company logo for current user.

    Accepts image files (PNG, JPG, JPEG, GIF, SVG).
    Saves to: backend/uploads/logos/{user_id}.{ext}

    Returns:
        {
            "logoPath": "/uploads/logos/123.png",
            "message": "Logo uploaded successfully"
        }
    """
    user_id = current_user["user_id"]

    # Validate file type
    allowed_extensions = {".png", ".jpg", ".jpeg", ".gif", ".svg"}
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )

    # Create uploads directory if it doesn't exist
    uploads_dir = Path(__file__).parent.parent / "uploads" / "logos"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # Save file with user_id as filename
    file_path = uploads_dir / f"{user_id}{file_ext}"

    try:
        # Save uploaded file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Update database with logo path
        logo_path = f"/uploads/logos/{user_id}{file_ext}"
        update_user_profile(user_id, logo_path=logo_path)

        return {
            "logoPath": logo_path,
            "message": "Logo uploaded successfully"
        }

    except Exception as e:
        # Clean up file if database update fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload logo: {str(e)}"
        )


# Catch-all route for SPA (React/Vite)
@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_spa(full_path: str):
    index_file = frontend_dir / "index.html"

    #Development
    if ENV == "development":
        # In dev, the frontend should be served by Vite directly
        return HTMLResponse(
            "<h1>Vite Dev ServerRunning</h1><p>FastAPI is acting as an API only.</p>",
            status_code=200
        )

    # Production
    if index_file.exists():
        return index_file.read_text(encoding="utf-8")

    return HTMLResponse("<h1>Frontend not found</h1>", status_code=404)

# @app.post("/api/session/payment_method/start")
# async def start_payment_method_session(
#     request: dict = Body({}),
#     authorization: Optional[str] = Header(None),
# ):
#     session_id = str(uuid.uuid4())

#     # initialize state specifically for payment method module
#     initial_state = {
#         "session_id": session_id,
#         "answers": {},
#         "current_question_id": None,
#         "current_question": None,
#         "payment_methods": [],
#         "done": False,
#         "message": None,
#         # optional: keep this for debugging / DB module label
#         "current_module": "payment_method",
#     }

#     result = master_graph.invoke(initial_state, config=cfg(session_id))


#     # optional auth + DB saving (same pattern as your /api/start)
#     current_user = None
#     try:
#         current_user = await get_optional_user(authorization)
#     except:
#         pass

#     if current_user:
#         db_create_session(
#             session_id=session_id,
#             user_id=current_user["user_id"],
#             config_state=result,
#             module="payment method",
#         )
#     else:
#         sessions[session_id] = result

#     return {
#         "sessionId": session_id,
#         "question": result.get("current_question"),
#         "module": "payment_method",
#     }


# @app.post("/api/session/payment_method/answer")
# async def submit_payment_method_answer(
#     request: dict = Body(...),
#     authorization: Optional[str] = Header(None),
# ):
#     session_id = request.get("sessionId")
#     question_id = request.get("questionId")
#     answer = request.get("answer")

#     if not session_id:
#         raise HTTPException(status_code=400, detail="sessionId is required")
#     if not question_id:
#         raise HTTPException(status_code=400, detail="questionId is required")
#     if answer is None:
#         raise HTTPException(status_code=400, detail="answer is required")

#     current_user = await get_optional_user(authorization)

#     # load session
#     state = None
#     if current_user:
#         db_session = db_get_session(session_id)
#         if db_session and db_session["user_id"] == current_user["user_id"]:
#             state = db_session["config_state"]

#     if not state:
#         state = sessions.get(session_id)

#     if not state:
#         raise HTTPException(status_code=404, detail="Session not found")

#     # store answer
#     state.setdefault("answers", {})
#     state["answers"][question_id] = answer

#     # run the correct graph
#     result = master_graph.invoke(state, config=cfg(session_id))


#     # save updated session
#     if current_user:
#         db_create_session(
#             session_id=session_id,
#             user_id=current_user["user_id"],
#             config_state=result,
#             module="payment method",
#         )
#     else:
#         sessions[session_id] = result

#     # done response (IMPORTANT: return paymentMethods in camelCase for your UI)
#     if result.get("done") or not result.get("current_question_id"):
#         return {
#             "sessionId": session_id,
#             "done": True,
#             "progress": 100,
#             "paymentMethods": result.get("payment_methods", []),
#             "message": result.get("message", "Configuration complete."),
#         }

#     return {
#         "sessionId": session_id,
#         "done": False,
#         "progress": 0,  # optional: implement progress for payment method
#         "question": result.get("current_question"),
#     }

# ---- Payment Method alias endpoints (thin wrappers) ----

@app.post("/api/session/payment_method/start")
async def start_payment_method_session(
    authorization: Optional[str] = Header(None),
):
    # Call the unified start logic
    return await start_session(
        request={"module": "payment_method"},
        authorization=authorization,
    )


@app.post("/api/session/payment_method/answer")
async def submit_payment_method_answer(
    request: dict = Body(...),
    authorization: Optional[str] = Header(None),
):
    # Call the unified answer logic
    return await submit_answer(
        request=request,
        authorization=authorization,
    )



# ============================================
# Run the server
# ============================================

if __name__ == "__main__":
    import uvicorn
    print("Starting TurboSAP API server...")
    print("API docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
