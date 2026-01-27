# File Descriptions & Architecture Reference (pre-stage branch)

> Comprehensive reference for codebase architecture, file relationships, and data flow.

**Last Updated:** January 2026
**Branch:** `pre-stage`

---

## Project Overview

**TurboSAP** is a full-stack web application for SAP payroll and financial configuration through guided Q&A flows. It uses a monorepo architecture with a Python FastAPI backend and a React/TypeScript frontend.

### Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, TypeScript, Vite, Zustand (state), React Router 7, Tailwind CSS, Zod |
| **Backend** | Python, FastAPI, LangGraph (orchestration), SQLite, Pydantic |
| **Architecture** | Single-instance, single-customer deployment (no multi-tenancy) |

---

## Directory Structure Overview

```
turboSAPrecent/
├── backend/                              # Python backend (FastAPI + LangGraph)
│   ├── app/
│   │   ├── main.py                       # FastAPI entry point & lifecycle
│   │   ├── auth.py                       # Password hashing, JWT tokens
│   │   ├── middleware.py                 # Auth middleware (get_current_user, require_admin)
│   │   ├── database.py                   # SQLite schema & queries
│   │   ├── roles.py                      # Role definitions (client, admin)
│   │   │
│   │   ├── agents/                       # LangGraph orchestration
│   │   │   ├── graph.py                  # Master graph orchestrator
│   │   │   ├── payroll/
│   │   │   │   └── payroll_area_graph.py # Payroll area Q&A logic
│   │   │   └── payments/
│   │   │       └── payment_method_graph.py # Payment method Q&A logic
│   │   │
│   │   ├── routes/                       # API endpoints
│   │   │   ├── module_config.py          # Module configuration CRUD
│   │   │   ├── modules.py                # Generic modules API
│   │   │   ├── hierarchy.py              # Category/task management
│   │   │   ├── export_api.py             # SAP file export
│   │   │   ├── knowledgebase.py          # Document management
│   │   │   ├── ai_config.py              # AI configuration
│   │   │   └── data_terminal.py          # Admin console
│   │   │
│   │   ├── services/                     # Business logic layer
│   │   │   ├── config_store.py           # Abstract config storage
│   │   │   ├── module_service.py         # Module CRUD operations
│   │   │   ├── question_service.py       # Question management
│   │   │   ├── module_runner.py          # Generic module execution
│   │   │   ├── output_generator.py       # Export file generation
│   │   │   ├── question_validator.py     # Question validation
│   │   │   └── knowledgebase.py          # ReachNett integration
│   │   │
│   │   ├── schemas/                      # Pydantic models
│   │   │   ├── module.py                 # Module metadata/config
│   │   │   ├── question.py               # Question/option models
│   │   │   └── session.py                # Session state models
│   │   │
│   │   ├── data/                         # Runtime data
│   │   │   ├── modules/                  # Module definitions
│   │   │   │   ├── payroll-area/
│   │   │   │   ├── payment-methods/
│   │   │   │   └── tax-company/
│   │   │   ├── modules_metadata.json     # Module registry
│   │   │   └── hierarchy.json            # SAP task hierarchy
│   │   │
│   │   └── config/                       # Legacy configuration
│   │       ├── questions_current.json
│   │       ├── questions_original.json
│   │       └── questions_backup.json
│   │
│   └── requirements.txt                  # Python dependencies
│
├── src/                                  # React frontend
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Router & auth flow
│   ├── types.ts                          # Core TypeScript types
│   ├── store.ts                          # Zustand config store
│   ├── payrollLogic.ts                   # Payroll calculation algorithm
│   │
│   ├── api/                              # API client layer
│   │   ├── auth.ts                       # Authentication API
│   │   ├── modules.ts                    # Modules API
│   │   ├── hierarchy.ts                  # Hierarchy API
│   │   ├── langgraph.ts                  # LangGraph session API
│   │   ├── dataTerminal.ts               # Terminal API
│   │   └── utils.ts                      # HTTP client wrapper
│   │
│   ├── store/
│   │   └── auth.ts                       # Zustand auth store
│   │
│   ├── components/
│   │   ├── layout/                       # Layout wrappers
│   │   │   ├── DashboardLayout.tsx       # User page layout
│   │   │   ├── AdminLayout.tsx           # Admin page layout (gold theme)
│   │   │   ├── Sidebar.tsx               # User navigation
│   │   │   ├── AdminSidebar.tsx          # Admin navigation
│   │   │   └── Header.tsx                # Page header
│   │   │
│   │   ├── auth/                         # Authentication UI
│   │   │   ├── AuthPage.tsx              # Login page
│   │   │   ├── LoginForm.tsx             # Login form
│   │   │   ├── RegisterForm.tsx          # Registration (disabled)
│   │   │   └── ProtectedRoute.tsx        # Route guards
│   │   │
│   │   ├── chat/                         # Q&A interface
│   │   │   ├── ChatInterface.tsx         # Question display
│   │   │   ├── MessageBubble.tsx         # Message styling
│   │   │   └── ChatCard.tsx              # Card wrapper
│   │   │
│   │   ├── admin/                        # Admin components
│   │   │   ├── QuestionEditor.tsx        # Question CRUD
│   │   │   └── QuestionList.tsx          # Questions table
│   │   │
│   │   └── ui/                           # Shadcn-style components
│   │
│   ├── pages/                            # User pages
│   │   ├── DashboardPage.tsx             # Main dashboard
│   │   ├── PayrollAreaPage.tsx           # Payroll Q&A
│   │   ├── PaymentMethodPage.tsx         # Payment Q&A
│   │   ├── CompanyCodePage.tsx           # Company code config
│   │   ├── ConfigurationScopePage.tsx    # Config overview
│   │   ├── ExportCenterPage.tsx          # Download exports
│   │   ├── AccountPage.tsx               # User profile
│   │   ├── ModulesListPage.tsx           # Module listing
│   │   ├── ModuleSessionPage.tsx         # Generic module runner
│   │   └── ChatPage.tsx                  # Legacy chat
│   │
│   ├── pages/admin/                      # Admin pages
│   │   ├── AdminDashboardPage.tsx        # Admin overview
│   │   ├── AdminUsersPage.tsx            # User management
│   │   ├── AdminSettingsPage.tsx         # System settings
│   │   ├── AdminCategoriesPage.tsx       # Hierarchy management
│   │   ├── ModulesPage.tsx               # Module CRUD
│   │   ├── ModuleEditorPage.tsx          # Question editor
│   │   ├── ConfigurationManagementPage.tsx
│   │   ├── DocumentsPage.tsx             # Knowledge base
│   │   ├── PaymentMethodConfigPage.tsx
│   │   └── PayrollAreaConfigPage.tsx
│   │
│   ├── hooks/
│   │   └── useExportData.ts              # Export data hook
│   │
│   ├── utils/
│   │   ├── exportUtils.ts                # Export file generation
│   │   └── fileGenerators.ts             # SAP file formatting
│   │
│   └── types/
│       └── chat.ts                       # Chat message types
│
├── package.json                          # Frontend dependencies
├── vite.config.ts                        # Vite configuration
├── tsconfig.app.json                     # TypeScript config
└── file_descriptions.md                  # This documentation (outdated)
```

---

## Backend Files

### Core Entry Point

#### `backend/app/main.py`
**Purpose**: FastAPI application entry point and lifecycle management

**Lifespan Management**:
- Database initialization on startup
- Seeds default users (`admin123`, `test123`)
- Seeds hierarchy (categories and tasks from `hierarchy.json`)

**CORS Configuration**:
```python
origins = [
    "http://localhost:5173",      # Vite dev
    "http://localhost:5174",      # Alternate dev port
    "http://localhost:3000",      # Alt frontend
    "https://*.elasticbeanstalk.com",  # Production
]
```

**Key Endpoints Defined**:
```python
# Authentication
POST /api/auth/login          # Login, returns JWT
POST /api/auth/register       # Registration (disabled)
GET  /api/auth/me             # Validate token, get user

# Sessions
POST /api/start               # Start LangGraph session
POST /api/answer              # Submit answer
GET  /api/session/{id}        # Get session state

# Admin
GET  /api/admin/users         # List users
POST /api/admin/users         # Create user
PUT  /api/admin/users/{id}    # Update user
DELETE /api/admin/users/{id}  # Delete user
```

**Includes Routers**:
- `module_config.router` → `/api/config`
- `modules.router` → `/api/modules`
- `hierarchy.router` → `/api/hierarchy`
- `export_api.router` → `/api/export`
- `knowledgebase.router` → `/api/knowledge`
- `ai_config.router` → `/api/ai`
- `data_terminal.router` → `/api/terminal`

---

### Authentication & Authorization

#### `backend/app/auth.py`
**Purpose**: Password hashing and JWT token management

**Functions**:
```python
hash_password(password: str) -> str
    # bcrypt hashing with auto-generated salt

verify_password(password: str, password_hash: str) -> bool
    # Constant-time comparison against hash

create_token(user_id: int, username: str, role: str) -> str
    # JWT with 7-day expiration
    # Payload: {user_id, username, role, exp}

verify_token(token: str) -> Optional[Dict]
    # Decodes and validates JWT
    # Returns payload dict or None if invalid/expired
```

**Configuration**:
```python
SECRET_KEY = os.getenv("JWT_SECRET", "turbosap-secret-key-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7
```

**Called By**: `main.py` (login endpoint), `middleware.py` (token validation)

---

#### `backend/app/middleware.py`
**Purpose**: Authentication middleware for route protection

**Functions**:
```python
get_current_user(authorization: str, credentials: HTTPAuthorizationCredentials) -> Dict
    # Extracts token from header or bearer
    # Validates with verify_token()
    # Raises HTTPException 401 if invalid
    # Returns: {user_id, username, role}

get_optional_user(...) -> Optional[Dict]
    # Same as above but returns None instead of raising
    # For routes that work with or without auth

require_admin(user: Dict = Depends(get_current_user)) -> Dict
    # Wraps get_current_user
    # Raises HTTPException 403 if role != "admin"
```

**Usage in Routes**:
```python
@router.get("/protected")
async def protected_route(user: Dict = Depends(get_current_user)):
    ...

@router.get("/admin-only")
async def admin_route(user: Dict = Depends(require_admin)):
    ...
```

---

#### `backend/app/roles.py`
**Purpose**: Role definitions and permissions

**Constants**:
```python
ROLES = {
    "client": "Regular user - can configure their instance",
    "admin": "Administrator - full access to instance"
}
```

**Note**: Future-extensible for module-specific permissions

---

### Database Layer

#### `backend/app/database.py`
**Purpose**: SQLite database schema and query functions

**Database**: `turbosap.db` (SQLite)

**Schema**:
```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'client',
    logo_path TEXT,
    company_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Sessions table (user config state)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    config_state TEXT,          -- JSON blob
    module TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Hierarchy tables
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```

**User Functions**:
```python
get_user_by_username(username: str) -> Optional[Dict]
get_user_by_id(user_id: int) -> Optional[Dict]
create_user(username, password_hash, role="client", company_name=None) -> int
update_user_password(user_id: int, password_hash: str) -> bool
update_user_last_login(user_id: int) -> None
get_all_users() -> List[Dict]
delete_user(user_id: int) -> bool
```

**Session Functions**:
```python
create_session(session_id, user_id, config_state, module) -> None
get_session(session_id: str) -> Optional[Dict]
get_user_sessions(user_id: int) -> List[Dict]
update_session(session_id, config_state) -> None
delete_session(session_id: str) -> None
```

**Hierarchy Functions**:
```python
create_category(name: str, display_order: int = 0) -> int
get_all_categories() -> List[Dict]
update_category(category_id, name, display_order) -> bool
delete_category(category_id: int) -> bool

create_task(category_id, name, display_order=0) -> int
get_tasks_by_category(category_id: int) -> List[Dict]
update_task(task_id, name, display_order) -> bool
delete_task(task_id: int) -> bool

get_full_hierarchy() -> List[Dict]
    # Returns categories with nested tasks array
```

---

### LangGraph Orchestration

#### `backend/app/agents/graph.py`
**Purpose**: Master graph orchestrator - routes between configuration modules

**Module Sequence**:
```python
MODULE_SEQUENCE = [
    "payroll_area",      # Always first
    "payment_method",    # Second
    # Future: "time_management", "benefits", etc.
]
```

**MasterState (TypedDict)**:
```python
class MasterState(TypedDict):
    session_id: str
    completed_modules: list[str]
    current_module: Optional[str]
    answers: dict                    # All answers across modules
    payroll_areas: list[dict]        # Output from payroll module
    payment_methods: list[dict]      # Output from payment module
    current_question: Optional[dict]
    done: bool
    message: Optional[str]
```

**Key Functions**:
```python
get_next_module(state: MasterState) -> Optional[str]
    # Finds first incomplete module from MODULE_SEQUENCE
    # Returns None if all complete

master_router(state: MasterState) -> MasterState
    # Main routing logic:
    # 1. Get next module
    # 2. Delegate to module router (payroll/payment)
    # 3. Collect module outputs
    # 4. Mark module complete when done
    # 5. Return updated state

create_master_graph() -> StateGraph
    # Builds: START → master_router → END
    # Uses MemorySaver for checkpoint persistence
```

**Exports**:
```python
master_graph          # Compiled graph instance
payroll_graph = master_graph  # Backward compatibility alias
MasterState
PayrollState = MasterState    # Backward compatibility alias
```

**Called By**: `main.py` (session endpoints)

---

#### `backend/app/agents/payroll/payroll_area_graph.py`
**Purpose**: Payroll-specific Q&A logic and area generation

**PayrollState (TypedDict)**:
```python
class PayrollState(TypedDict):
    session_id: str
    answers: dict
    current_question: Optional[dict]
    current_question_id: Optional[str]
    payroll_areas: list[dict]
    done: bool
    message: Optional[str]
```

**Question Flow**:
```
q1_frequencies (multi-select)
    ↓ (for each selected frequency)
q1_{freq}_pattern (e.g., q1_weekly_pattern)
    ↓
q1_{freq}_payday (e.g., q1_weekly_payday)
    ↓ (for each calendar combination)
q2_{combo}_business_units (e.g., q2_weekly_mon_sun_friday_business_units)
    ↓
q3_{combo}_geographic (e.g., q3_weekly_mon_sun_friday_geographic)
    ↓
Generate payroll areas
```

**Key Functions**:
```python
get_calendar_combos(answers: dict) -> list[str]
    # Extracts all frequency+pattern+payday combos
    # E.g., ["weekly_mon_sun_friday", "biweekly_sun_sat_thursday"]

determine_next_question(answers: dict) -> tuple[Optional[str], Optional[dict]]
    # Routes to next unanswered question
    # Returns (question_id, question_dict) or (None, None) if complete

generate_payroll_areas(answers: dict) -> list[dict]
    # Creates payroll area configs from answers
    # One area per: frequency × business_unit × region combination
    # Output structure:
    # {
    #     code: "PA01",
    #     description: "Weekly Mon-Sun Friday - HQ",
    #     frequency: "weekly",
    #     periodPattern: "mon_sun",
    #     payDay: "friday",
    #     businessUnit: "HQ",
    #     region: "US",
    #     calendarId: "W1",
    #     employeeCount: 0,
    #     reasoning: "..."
    # }

router_node(state: PayrollState) -> PayrollState
    # Main node: determine next question or generate areas
```

**Hot-Reload**: Questions loaded from `questions_current.json` on each call

---

#### `backend/app/agents/payments/payment_method_graph.py`
**Purpose**: Payment method Q&A logic

**PaymentMethodState (TypedDict)**:
```python
class PaymentMethodState(TypedDict):
    session_id: str
    answers: dict
    current_question: Optional[dict]
    payment_methods: list[dict]
    done: bool
```

**Question Flow**:
```
pm1_methods (multi-select: ACH, Check, Pay Card, etc.)
    ↓ (for each method)
pm2_{method}_details
    ↓
pm3_approval_workflow
    ↓
Generate payment method configs
```

**Hot-Reload**: Questions from `payment_method_questions.json`

---

### Routes (API Endpoints)

#### `backend/app/routes/module_config.py`
**Purpose**: Unified module configuration management

**Endpoints**:
```python
GET /api/config/modules
    # List all modules with metadata
    # Returns: [{slug, name, description, status, icon}, ...]

GET /api/config/modules/{slug}
    # Get module metadata
    # Returns: {slug, name, description, questions: [...]}

PUT /api/config/modules/{slug}
    # Update module metadata (admin only)
    # Body: {name?, description?, icon?, status?}

GET /api/config/modules/{slug}/questions
    # Get module questions
    # Returns: {questions: [...]}

PUT /api/config/modules/{slug}/questions
    # Update questions (admin only)
    # Creates backup before saving
    # Body: {questions: [...]}

POST /api/config/modules/{slug}/questions/restore
    # Restore from backup (admin only)
    # Query: ?backup=original|backup
```

**File Path Resolution**:
```python
# New structure (post-migration)
modules/{slug}/config.json
modules/{slug}/questions.json

# Legacy structure (fallback)
config/questions_current.json  (payroll-area)
data/payment_method_questions.json
```

**Uses**: `ConfigStore`, `require_admin`

---

#### `backend/app/routes/modules.py`
**Purpose**: Generic modules API for config-driven Q&A

**User Endpoints**:
```python
GET /api/modules
    # List available modules (status=active only for non-admin)
    # Returns: [{slug, name, description, icon}, ...]

GET /api/modules/{slug}
    # Get module with questions
    # Returns: {slug, name, questions: [...]}

POST /api/modules/{slug}/sessions
    # Start new session
    # Returns: {sessionId, question: {...}}

GET /api/modules/{slug}/sessions/{session_id}
    # Get session state
    # Returns: {sessionId, status, progress, answers, currentQuestion}

POST /api/modules/{slug}/sessions/{session_id}/answer
    # Submit answer
    # Body: {questionId, answer}
    # Returns: {done, nextQuestion?, progress}

GET /api/modules/{slug}/sessions/{session_id}/output
    # Get generated output files
    # Returns: {files: [{name, format, content}, ...]}
```

**Admin Endpoints**:
```python
POST /api/modules
    # Create new module
    # Body: {name, description, icon?}

PUT /api/modules/{slug}
    # Update module
    # Body: {name?, description?, status?}

DELETE /api/modules/{slug}
    # Delete module
```

**Uses**: `ModuleService`, `GenericModuleRunner`, `get_current_user`

---

#### `backend/app/routes/hierarchy.py`
**Purpose**: Category and task hierarchy management

**Endpoints**:
```python
GET /api/hierarchy
    # Get full hierarchy tree
    # Returns: [{id, name, displayOrder, tasks: [...]}]

POST /api/hierarchy/categories
    # Create category
    # Body: {name, displayOrder?}

PUT /api/hierarchy/categories/{id}
    # Update category
    # Body: {name?, displayOrder?}

DELETE /api/hierarchy/categories/{id}
    # Delete category (cascades to tasks)

POST /api/hierarchy/categories/{category_id}/tasks
    # Create task in category
    # Body: {name, displayOrder?}

PUT /api/hierarchy/tasks/{id}
    # Update task

DELETE /api/hierarchy/tasks/{id}
    # Delete task
```

**Note**: Converts snake_case DB columns to camelCase for frontend

---

#### `backend/app/routes/export_api.py`
**Purpose**: Export configurations to SAP format files

**Endpoints**:
```python
POST /api/export/payroll-areas
    # Generate SAP payroll area files
    # Body: {payrollAreas: [...]}
    # Returns: {t549a: "...", t549q: "..."}

POST /api/export/payment-methods
    # Generate payment method export

GET /api/export/templates
    # Get export templates
```

---

### Services (Business Logic)

#### `backend/app/services/config_store.py`
**Purpose**: Abstract configuration storage layer

**Abstract Base**:
```python
class ConfigStore(ABC):
    @abstractmethod
    def get(self, path: str) -> Optional[dict]: ...

    @abstractmethod
    def save(self, path: str, data: dict) -> None: ...

    @abstractmethod
    def exists(self, path: str) -> bool: ...

    @abstractmethod
    def delete(self, path: str) -> None: ...

    @abstractmethod
    def list(self, pattern: str) -> list[str]: ...
```

**Filesystem Implementation**:
```python
class FilesystemConfigStore(ConfigStore):
    def __init__(self, base_path: str = "app/data"):
        self.base_path = Path(base_path)

    def get(self, path: str) -> Optional[dict]:
        # Reads {base_path}/{path}.json
        # Returns parsed JSON or None

    def save(self, path: str, data: dict) -> None:
        # Writes JSON to {base_path}/{path}.json
        # Creates parent directories if needed

    def list(self, pattern: str) -> list[str]:
        # Glob pattern matching
        # E.g., list("modules/*/config") → ["modules/payroll-area/config", ...]
```

**Path Examples**:
```
modules/payroll-area/config    → app/data/modules/payroll-area/config.json
modules/payroll-area/questions → app/data/modules/payroll-area/questions.json
```

**Future**: Ready for S3 backend implementation

---

#### `backend/app/services/module_service.py`
**Purpose**: Module CRUD operations

**ModuleService**:
```python
class ModuleService:
    def __init__(self, store: ConfigStore): ...

    def list_modules(self) -> list[ModuleSummary]:
        # Scans modules/*/config.json
        # Returns list of module summaries

    def get_module(self, slug: str) -> Optional[ModuleConfig]:
        # Loads config.json + questions.json
        # Returns full module with questions

    def create_module(self, name: str, description: str, icon: str = None) -> str:
        # Slugifies name
        # Creates modules/{slug}/config.json
        # Creates modules/{slug}/questions.json (empty)
        # Returns slug

    def update_module(self, slug: str, **updates) -> bool:
        # Updates config.json fields

    def delete_module(self, slug: str) -> bool:
        # Removes module directory
```

**Slugification**: `"Payroll Area"` → `"payroll-area"`

---

#### `backend/app/services/question_service.py`
**Purpose**: Question management within modules

**QuestionService**:
```python
class QuestionService:
    def list_questions(self, module_slug: str) -> list[Question]:
        # Loads questions.json for module

    def get_question(self, module_slug: str, question_id: str) -> Optional[Question]:
        # Finds specific question by ID

    def create_question(self, module_slug: str, question: Question) -> None:
        # Adds question to questions.json

    def update_question(self, module_slug: str, question_id: str, updates: dict) -> bool:
        # Modifies question fields

    def delete_question(self, module_slug: str, question_id: str) -> bool:
        # Removes question

    def reorder_questions(self, module_slug: str, order: list[str]) -> None:
        # Batch reorder by ID list
```

---

#### `backend/app/services/module_runner.py`
**Purpose**: Generic module execution engine

**GenericModuleRunner**:
```python
class GenericModuleRunner:
    def __init__(self, module_service: ModuleService): ...

    sessions: dict[str, SessionState] = {}  # In-memory storage

    def start_session(self, module_slug: str) -> tuple[str, Question]:
        # Creates session ID
        # Loads module questions
        # Returns first question

    def get_session(self, session_id: str) -> Optional[SessionState]:
        # Returns session state

    def submit_answer(self, session_id: str, question_id: str, answer: Any) -> AnswerResult:
        # Stores answer
        # Evaluates showIf conditions to find next question
        # Returns {done, nextQuestion, progress}

    def get_output(self, session_id: str) -> list[OutputFile]:
        # Applies output mappings
        # Generates export files

    def _evaluate_show_if(self, condition: ShowIfCondition, answers: dict) -> bool:
        # Evaluates conditional display rules
        # Supports: equals, contains, not_equals
```

**Conditional Logic (showIf)**:
```python
# Question only shows if previous answer matches
{
    "id": "q2_weekly_pattern",
    "showIf": {
        "questionId": "q1_frequencies",
        "operator": "contains",
        "value": "weekly"
    }
}
```

---

#### `backend/app/services/output_generator.py`
**Purpose**: Transform answers into export files

**OutputGenerator**:
```python
class OutputGenerator:
    def generate(self, module_slug: str, answers: dict, mappings: list[OutputMapping]) -> list[OutputFile]:
        # For each mapping:
        #   - Extract answer value
        #   - Apply transformation
        #   - Add to output file
        # Returns: [{name, format, content}, ...]
```

**Output Mapping Example**:
```json
{
    "questionId": "q1_frequencies",
    "outputFile": "payroll_areas.csv",
    "column": "frequency",
    "transform": "uppercase"
}
```

---

### Schemas (Pydantic Models)

#### `backend/app/schemas/module.py`
```python
class ModuleMetadata(BaseModel):
    slug: str
    name: str
    description: str
    icon: Optional[str] = None
    status: str = "active"  # active, draft, archived

class ModuleSummary(BaseModel):
    slug: str
    name: str
    description: str
    icon: Optional[str] = None

class ModuleConfig(ModuleMetadata):
    questions: list[Question] = []

class CreateModuleRequest(BaseModel):
    name: str
    description: str
    icon: Optional[str] = None

class UpdateModuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None
```

---

#### `backend/app/schemas/question.py`
```python
class QuestionOption(BaseModel):
    value: str           # Internal ID
    label: str           # Display text
    description: Optional[str] = None

class ShowIfCondition(BaseModel):
    questionId: str
    operator: str = "equals"  # equals, contains, not_equals
    value: Any

class OutputMapping(BaseModel):
    outputFile: str
    column: str
    transform: Optional[str] = None

class Question(BaseModel):
    id: str
    text: str
    type: str            # multiple_choice, multiple_select, text, number
    options: Optional[list[QuestionOption]] = None
    showIf: Optional[ShowIfCondition] = None
    required: bool = True
    outputMappings: Optional[list[OutputMapping]] = None
```

---

#### `backend/app/schemas/session.py`
```python
class SessionState(BaseModel):
    id: str
    moduleSlug: str
    status: str          # in_progress, completed
    progress: int        # 0-100
    answers: dict
    currentQuestionId: Optional[str]

class StartSessionResponse(BaseModel):
    sessionId: str
    question: Question

class SubmitAnswerRequest(BaseModel):
    questionId: str
    answer: Any

class AnswerResult(BaseModel):
    done: bool
    nextQuestion: Optional[Question] = None
    progress: int

class OutputFile(BaseModel):
    name: str
    format: str          # csv, json, xml
    content: str

class GenerateOutputResponse(BaseModel):
    files: list[OutputFile]
```

---

### Data Files

#### `backend/app/data/modules/`
**Purpose**: Module definitions (one directory per module)

**Structure**:
```
modules/
├── payroll-area/
│   ├── config.json      # {slug, name, description, icon, status}
│   └── questions.json   # {questions: [...]}
├── payment-methods/
│   ├── config.json
│   └── questions.json
└── tax-company/
    ├── config.json
    └── questions.json
```

---

#### `backend/app/data/hierarchy.json`
**Purpose**: SAP implementation task hierarchy (29 categories, 95 tasks)

**Structure**:
```json
{
    "categories": [
        {
            "name": "Enterprise Structure",
            "tasks": [
                "Define Company Codes",
                "Define Personnel Areas",
                "Define Personnel Subareas"
            ]
        },
        {
            "name": "Payroll",
            "tasks": [
                "Define Payroll Areas",
                "Define Payroll Periods",
                "Configure Pay Scale Types"
            ]
        }
    ]
}
```

**Loaded By**: `main.py` on startup (seeds database)

---

#### `backend/app/config/` (Legacy)
**Purpose**: Legacy question configuration files

| File | Purpose |
|------|---------|
| `questions_current.json` | Active payroll questions (editable) |
| `questions_original.json` | Original version (immutable backup) |
| `questions_backup.json` | Admin modification backup |

**Note**: Being migrated to `modules/payroll-area/questions.json`

---

## Frontend Files

### Entry Points

#### `src/main.tsx`
**Purpose**: React application entry point

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
```

---

#### `src/App.tsx`
**Purpose**: Main router and authentication flow

**Authentication Check**:
```typescript
useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        getCurrentUser(token)
            .then(user => setAuth(token, user))
            .catch(() => clearAuth());
    }
}, []);
```

**Route Structure**:
```typescript
<BrowserRouter>
    <Routes>
        {/* Public */}
        <Route path="/login" element={<AuthPage />} />

        {/* User Routes (requires auth) */}
        <Route element={<ProtectedRoute requireClient />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/payroll-area" element={<PayrollAreaPage />} />
            <Route path="/payment-methods" element={<PaymentMethodPage />} />
            <Route path="/modules" element={<ModulesListPage />} />
            <Route path="/modules/:slug" element={<ModuleSessionPage />} />
            <Route path="/account" element={<AccountPage />} />
            {/* ... more user routes */}
        </Route>

        {/* Admin Routes (requires admin role) */}
        <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/modules" element={<ModulesPage />} />
            <Route path="/admin/modules/:slug" element={<ModuleEditorPage />} />
            <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            {/* ... more admin routes */}
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
</BrowserRouter>
```

---

### API Layer

#### `src/api/utils.ts`
**Purpose**: HTTP client wrapper

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}
```

---

#### `src/api/auth.ts`
**Purpose**: Authentication API calls

```typescript
interface AuthResponse {
    userId: number;
    username: string;
    role: 'client' | 'admin';
    token: string;
    companyName?: string;
    logoPath?: string;
}

export async function login(username: string, password: string): Promise<AuthResponse>
    // POST /api/auth/login

export async function getCurrentUser(token: string): Promise<User>
    // GET /api/auth/me

export async function changePassword(currentPassword: string, newPassword: string): Promise<void>
    // PUT /api/auth/password
```

---

#### `src/api/modules.ts`
**Purpose**: Modules API calls

```typescript
interface ModuleSummary {
    slug: string;
    name: string;
    description: string;
    icon?: string;
}

interface Question {
    id: string;
    text: string;
    type: 'multiple_choice' | 'multiple_select' | 'text';
    options?: { value: string; label: string; description?: string }[];
}

interface SessionState {
    sessionId: string;
    status: 'in_progress' | 'completed';
    progress: number;
    currentQuestion?: Question;
}

export async function listModules(): Promise<ModuleSummary[]>
    // GET /api/modules

export async function startSession(slug: string): Promise<{ sessionId: string; question: Question }>
    // POST /api/modules/{slug}/sessions

export async function submitAnswer(
    slug: string,
    sessionId: string,
    questionId: string,
    answer: any
): Promise<{ done: boolean; nextQuestion?: Question; progress: number }>
    // POST /api/modules/{slug}/sessions/{id}/answer

export async function getSessionOutput(slug: string, sessionId: string): Promise<OutputFile[]>
    // GET /api/modules/{slug}/sessions/{id}/output
```

---

#### `src/api/hierarchy.ts`
**Purpose**: Hierarchy API calls

```typescript
interface Category {
    id: number;
    name: string;
    displayOrder: number;
    tasks: Task[];
}

interface Task {
    id: number;
    name: string;
    displayOrder: number;
}

export async function getHierarchy(): Promise<Category[]>
export async function createCategory(name: string, displayOrder?: number): Promise<Category>
export async function updateCategory(id: number, updates: Partial<Category>): Promise<void>
export async function deleteCategory(id: number): Promise<void>
export async function createTask(categoryId: number, name: string): Promise<Task>
export async function updateTask(id: number, updates: Partial<Task>): Promise<void>
export async function deleteTask(id: number): Promise<void>
```

---

### State Management

#### `src/store/auth.ts`
**Purpose**: Zustand authentication store

```typescript
interface User {
    userId: number;
    username: string;
    role: 'client' | 'admin';
    companyName?: string;
    logoPath?: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    setAuth: (token: string, user: User) => void;
    clearAuth: () => void;
    updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,

            setAuth: (token, user) => set({
                token,
                user,
                isAuthenticated: true
            }),

            clearAuth: () => {
                localStorage.removeItem('token');
                set({ token: null, user: null, isAuthenticated: false });
            },

            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),
        }),
        {
            name: 'turbosap-auth',
            partialize: (state) => ({ token: state.token, user: state.user }),
        }
    )
);
```

**Session Timeout**: 10 minutes of inactivity clears auth

---

#### `src/store.ts`
**Purpose**: Configuration state (payroll areas, company profile)

```typescript
interface ConfigurationStore {
    profile: CompanyProfile;
    payrollAreas: PayrollArea[];
    validation: ValidationResult;
    paymentDataVersion: number;  // Increment to trigger updates

    // Profile actions
    setCompanyInfo: (name: string, id: string) => void;
    setTotalEmployees: (count: number) => void;

    // Frequency actions
    addPayFrequency: (freq: PayFrequency) => void;
    updatePayFrequency: (index: number, freq: Partial<PayFrequency>) => void;
    removePayFrequency: (index: number) => void;

    // Business unit actions
    addBusinessUnit: (unit: BusinessUnit) => void;
    updateBusinessUnit: (index: number, unit: Partial<BusinessUnit>) => void;

    // Recalculation
    recalculate: () => void;  // Runs calculateMinimalAreas()

    // Export
    exportJSON: () => string;
}

export const useConfigStore = create<ConfigurationStore>()(
    persist(
        (set, get) => ({ ... }),
        { name: 'turbosap-config' }
    )
);
```

---

### Layout Components

#### `src/components/layout/DashboardLayout.tsx`
**Purpose**: Wrapper for user pages

```typescript
interface Props {
    children: React.ReactNode;
    title: string;
    description?: string;
    currentPath: string;
}

export function DashboardLayout({ children, title, description, currentPath }: Props) {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar currentPath={currentPath} />
            <div className="pl-64">
                <Header title={title} description={description} />
                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}
```

---

#### `src/components/layout/AdminLayout.tsx`
**Purpose**: Wrapper for admin pages (gold/amber theme)

```typescript
export function AdminLayout({ children, title, description, currentPath }: Props) {
    return (
        <div className="min-h-screen bg-amber-50">
            <AdminSidebar currentPath={currentPath} />
            <div className="pl-64">
                <header className="bg-amber-600 text-white">
                    <h1>{title}</h1>
                    <span className="badge">Admin</span>
                </header>
                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}
```

---

#### `src/components/layout/Sidebar.tsx`
**Purpose**: User navigation sidebar

**Links**:
| Path | Label | Icon |
|------|-------|------|
| `/dashboard` | Dashboard | Home |
| `/payroll-area` | Payroll Area | Calendar |
| `/payment-methods` | Payment Methods | CreditCard |
| `/modules` | Modules | Grid |
| `/account` | Account | User |

---

#### `src/components/layout/AdminSidebar.tsx`
**Purpose**: Admin navigation sidebar (gold theme)

**Links**:
| Path | Label | Icon |
|------|-------|------|
| `/admin/dashboard` | Dashboard | Home |
| `/admin/users` | Users | Users |
| `/admin/modules` | Modules | Grid |
| `/admin/categories` | Categories | Folder |
| `/admin/settings` | Settings | Settings |
| `/admin/console` | Console | Terminal |
| `/admin/documents` | Documents | FileText |

---

### Authentication Components

#### `src/components/auth/ProtectedRoute.tsx`
**Purpose**: Route guards for authenticated routes

```typescript
interface Props {
    requireClient?: boolean;
    requireAdmin?: boolean;
}

export function ProtectedRoute({ requireClient, requireAdmin }: Props) {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    if (requireAdmin && user?.role !== 'admin') {
        return <Navigate to="/dashboard" />;
    }

    return <Outlet />;
}
```

---

### Core Types

#### `src/types.ts`
**Purpose**: Core TypeScript type definitions

```typescript
// Pay frequency types
type PayFrequencyType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

interface PayFrequency {
    type: PayFrequencyType;
    employeeCount: number;
    calendarPattern: string;  // e.g., "mon_sun"
    payDay: string;           // e.g., "friday"
}

// Business structure
interface BusinessUnit {
    code: string;
    name: string;
    employeeCount: number;
    requiresSeparateArea: boolean;
}

interface Union {
    code: string;
    name: string;
    employeeCount: number;
    uniqueCalendar: boolean;
    uniqueFunding: boolean;
}

interface TimeZone {
    code: string;
    name: string;
    employeeCount: number;
    affectsProcessing: boolean;
}

// Company profile
interface CompanyProfile {
    companyId: string;
    companyName: string;
    totalEmployees: number;
    payFrequencies: PayFrequency[];
    businessUnits: BusinessUnit[];
    unions: Union[];
    timeZones: TimeZone[];
    requiresSecuritySplit: boolean;
}

// Payroll area
interface PayrollArea {
    code: string;              // e.g., "PA01"
    description: string;
    frequency: PayFrequencyType;
    periodPattern: string;
    payDay: string;
    calendarId: string;
    employeeCount: number;
    businessUnit?: string;
    region?: string;
    reasoning: string;
}

// Validation
interface ValidationResult {
    isValid: boolean;
    employeesCovered: number;
    warnings: string[];
    errors: string[];
}
```

---

### Key Pages

#### `src/pages/DashboardPage.tsx`
**Purpose**: Main user dashboard

**Features**:
- Welcome message with company name
- Quick links to configuration modules
- Saved session list (resume capability)
- Recent activity

---

#### `src/pages/ModulesListPage.tsx`
**Purpose**: List available configuration modules

**Features**:
- Grid of module cards
- Module icon, name, description
- "Start" button to begin session
- Status badges (draft, active)

---

#### `src/pages/ModuleSessionPage.tsx`
**Purpose**: Generic module Q&A runner

**Flow**:
1. Get `slug` from URL params
2. Call `startSession(slug)` on mount
3. Display current question
4. On answer, call `submitAnswer()`
5. If done, show results and export options

---

#### `src/pages/admin/ModulesPage.tsx`
**Purpose**: Admin module management

**Features**:
- List all modules (including drafts)
- Create new module button
- Edit/delete module actions
- Status toggle (active/draft/archived)

---

#### `src/pages/admin/ModuleEditorPage.tsx`
**Purpose**: Edit module questions

**Features**:
- Question list with drag-reorder
- Add/edit/delete questions
- Question preview
- Conditional logic (showIf) editor
- Save/restore/reset buttons

---

## Data Flow Diagrams

### Authentication Flow

```
User enters credentials
    │
    └─► AuthPage.handleSubmit()
            │
            └─► api/auth.ts: login(username, password)
                    │
                    └─► POST /api/auth/login
                            │
                            └─► main.py: login_endpoint()
                                    │
                                    ├─► database.get_user_by_username()
                                    ├─► auth.verify_password()
                                    └─► auth.create_token()
                                            │
                                            └─► Returns {token, userId, role, ...}

Token received
    │
    └─► useAuthStore.setAuth(token, user)
            │
            ├─► Stores in Zustand state
            └─► Persists to localStorage
```

### Module Session Flow

```
User clicks "Start Module"
    │
    └─► ModuleSessionPage.useEffect()
            │
            └─► api/modules.ts: startSession(slug)
                    │
                    └─► POST /api/modules/{slug}/sessions
                            │
                            └─► routes/modules.py: start_session()
                                    │
                                    ├─► GenericModuleRunner.start_session()
                                    │       │
                                    │       ├─► Load module questions
                                    │       ├─► Create session ID
                                    │       └─► Return first question
                                    │
                                    └─► Returns {sessionId, question}

User selects answer
    │
    └─► handleAnswer(questionId, answer)
            │
            └─► api/modules.ts: submitAnswer(slug, sessionId, questionId, answer)
                    │
                    └─► POST /api/modules/{slug}/sessions/{id}/answer
                            │
                            └─► GenericModuleRunner.submit_answer()
                                    │
                                    ├─► Store answer
                                    ├─► Evaluate showIf conditions
                                    ├─► Find next applicable question
                                    └─► Returns {done, nextQuestion, progress}

When done=true
    │
    └─► api/modules.ts: getSessionOutput(slug, sessionId)
            │
            └─► GET /api/modules/{slug}/sessions/{id}/output
                    │
                    └─► OutputGenerator.generate()
                            │
                            └─► Returns [{name, format, content}, ...]
```

### Admin Question Update Flow

```
Admin edits questions
    │
    └─► QuestionEditor.handleSave()
            │
            └─► PUT /api/config/modules/{slug}/questions
                    │
                    └─► routes/module_config.py: update_questions()
                            │
                            ├─► Create backup (questions_backup.json)
                            ├─► Validate question structure
                            └─► ConfigStore.save()
                                    │
                                    └─► Write to modules/{slug}/questions.json

Changes take effect immediately (hot-reload)
```

---

## Key Architectural Patterns

### 1. Single-Instance Deployment
- Each customer gets isolated instance
- No multi-tenancy (no tenant_id)
- Admin role scoped to instance only

### 2. Config-Driven Modules
- Modules defined via JSON configuration
- Questions support conditional display (showIf)
- Output mappings define answer → export transformation
- Hot-reload for admin changes

### 3. Separation of Concerns

| Layer | Responsibility |
|-------|----------------|
| Routes | HTTP handling, validation |
| Services | Business logic, orchestration |
| Schemas | Data validation, serialization |
| ConfigStore | File abstraction |
| LangGraph | State machine orchestration |

### 4. Session Persistence

| Storage | Use Case |
|---------|----------|
| LangGraph MemorySaver | In-process session state |
| SQLite sessions table | User session recovery |
| localStorage | Frontend auth + config state |

### 5. Authentication

| Component | Mechanism |
|-----------|-----------|
| Backend | JWT tokens (7-day expiry) |
| Frontend | Zustand + localStorage |
| Route protection | Dependency injection middleware |

---

## Quick Reference Tables

### Backend Routes Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/auth/login | - | Login |
| GET | /api/auth/me | User | Validate token |
| GET | /api/modules | User | List modules |
| POST | /api/modules/{slug}/sessions | User | Start session |
| POST | /api/modules/{slug}/sessions/{id}/answer | User | Submit answer |
| GET | /api/modules/{slug}/sessions/{id}/output | User | Get exports |
| GET | /api/config/modules | Admin | List module configs |
| PUT | /api/config/modules/{slug}/questions | Admin | Update questions |
| GET | /api/hierarchy | User | Get categories/tasks |
| POST | /api/admin/users | Admin | Create user |

### Frontend Routes Summary

| Path | Component | Auth | Purpose |
|------|-----------|------|---------|
| /login | AuthPage | - | Login |
| /dashboard | DashboardPage | Client | Home |
| /modules | ModulesListPage | Client | Module listing |
| /modules/:slug | ModuleSessionPage | Client | Run module |
| /admin/dashboard | AdminDashboardPage | Admin | Admin home |
| /admin/modules | ModulesPage | Admin | Manage modules |
| /admin/modules/:slug | ModuleEditorPage | Admin | Edit questions |
| /admin/users | AdminUsersPage | Admin | User management |

---

## File Location Quick Reference

| Component | Path |
|-----------|------|
| Backend entry | `backend/app/main.py` |
| Auth logic | `backend/app/auth.py`, `middleware.py` |
| Database | `backend/app/database.py` |
| LangGraph | `backend/app/agents/` |
| API routes | `backend/app/routes/` |
| Services | `backend/app/services/` |
| Schemas | `backend/app/schemas/` |
| Module data | `backend/app/data/modules/` |
| Frontend entry | `src/App.tsx`, `src/main.tsx` |
| API clients | `src/api/` |
| State stores | `src/store/auth.ts`, `src/store.ts` |
| Layouts | `src/components/layout/` |
| User pages | `src/pages/` |
| Admin pages | `src/pages/admin/` |
| Types | `src/types.ts` |
