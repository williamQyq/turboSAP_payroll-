# File Descriptions & Architecture Reference (admin-config-reorg branch)

> Comprehensive reference for codebase architecture, file relationships, and data flow.

**Last Updated:** January 2026
**Branch:** `admin-config-reorg`

---

## Executive Summary

The **admin-config-reorg** branch represents a major architectural reorganization of TurboSAP toward a **generic, config-driven module system**. The key evolution:

| Aspect | Before | After |
|--------|--------|-------|
| Modules | 2 hardcoded (payroll, payment) | Unlimited config-driven |
| Question Logic | Python code per module | JSON configuration |
| Admin Tools | Limited | Full CRUD for modules/questions |
| Execution | Module-specific graphs | GenericModuleRunner |

---

## Directory Structure Overview

```
turboSAPrecent/
├── backend/                              # Python backend (FastAPI + LangGraph)
│   ├── app/
│   │   ├── main.py                       # FastAPI entry point & lifecycle
│   │   ├── auth.py                       # Password hashing, JWT tokens
│   │   ├── middleware.py                 # Auth middleware
│   │   ├── database.py                   # SQLite schema & queries
│   │   ├── roles.py                      # Role definitions
│   │   │
│   │   ├── agents/                       # LangGraph (LEGACY - being replaced)
│   │   │   ├── graph.py                  # Master graph orchestrator
│   │   │   ├── payroll/
│   │   │   │   └── payroll_area_graph.py # Payroll Q&A (legacy)
│   │   │   └── payments/
│   │   │       └── payment_method_graph.py # Payment Q&A (legacy)
│   │   │
│   │   ├── routes/                       # API endpoints (NEW structure)
│   │   │   ├── __init__.py
│   │   │   ├── modules.py                # Generic module CRUD + sessions
│   │   │   ├── module_config.py          # Module configuration management
│   │   │   ├── hierarchy.py              # Category/task management
│   │   │   ├── export_api.py             # SAP file export
│   │   │   ├── knowledgebase.py          # Document management
│   │   │   ├── ai_config.py              # AI configuration
│   │   │   └── data_terminal.py          # Admin console
│   │   │
│   │   ├── services/                     # Business logic (NEW)
│   │   │   ├── config_store.py           # Abstract config storage
│   │   │   ├── module_service.py         # Module CRUD operations
│   │   │   ├── module_runner.py          # Generic module execution
│   │   │   ├── question_service.py       # Question management
│   │   │   ├── output_generator.py       # Export file generation
│   │   │   ├── question_validator.py     # Question validation
│   │   │   ├── questions.py              # Legacy question loader
│   │   │   └── knowledgebase.py          # ReachNett integration
│   │   │
│   │   ├── schemas/                      # Pydantic models (NEW)
│   │   │   ├── module.py                 # Module metadata/config
│   │   │   ├── question.py               # Question/option models
│   │   │   └── session.py                # Session state models
│   │   │
│   │   ├── data/                         # Runtime data
│   │   │   ├── modules/                  # Module definitions (NEW)
│   │   │   │   ├── payroll-area/
│   │   │   │   │   ├── config.json
│   │   │   │   │   └── questions.json
│   │   │   │   ├── payment-methods/
│   │   │   │   ├── tax-company/
│   │   │   │   ├── bank-details/
│   │   │   │   └── test-module/
│   │   │   ├── metadata/
│   │   │   │   └── modules.json          # Central modules index
│   │   │   ├── hierarchy.json            # SAP task hierarchy
│   │   │   └── modules_metadata.json     # Legacy metadata
│   │   │
│   │   └── config/                       # Legacy configuration
│   │       ├── questions_current.json
│   │       ├── questions_original.json
│   │       └── questions_backup.json
│   │
│   └── requirements.txt
│
├── src/                                  # React frontend
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Router & auth flow
│   ├── types.ts                          # Core TypeScript types
│   ├── store.ts                          # Zustand config store
│   ├── payrollLogic.ts                   # Payroll calculation algorithm
│   │
│   ├── api/                              # API client layer
│   │   ├── modules.ts                    # Module API client (NEW)
│   │   ├── auth.ts                       # Authentication API
│   │   ├── hierarchy.ts                  # Hierarchy API
│   │   ├── langgraph.ts                  # LangGraph session API
│   │   ├── dataTerminal.ts               # Terminal API
│   │   └── utils.ts                      # HTTP client wrapper
│   │
│   ├── store/
│   │   └── auth.ts                       # Zustand auth store
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx       # User page layout
│   │   │   ├── AdminLayout.tsx           # Admin page layout
│   │   │   ├── Sidebar.tsx               # User navigation
│   │   │   ├── AdminSidebar.tsx          # Admin navigation
│   │   │   └── Header.tsx                # Page header
│   │   │
│   │   ├── admin/                        # Admin components (EXPANDED)
│   │   │   ├── QuestionEditor.tsx        # Question CRUD modal
│   │   │   └── QuestionList.tsx          # Questions table
│   │   │
│   │   ├── chat/                         # Q&A interface
│   │   ├── auth/                         # Authentication UI
│   │   └── ui/                           # Shadcn-style components
│   │
│   ├── pages/                            # User pages
│   │   ├── DashboardPage.tsx
│   │   ├── PayrollAreaPage.tsx
│   │   ├── PaymentMethodPage.tsx
│   │   ├── ModulesListPage.tsx           # Module listing (NEW)
│   │   ├── ModuleSessionPage.tsx         # Generic module runner (NEW)
│   │   └── ...
│   │
│   └── pages/admin/                      # Admin pages (REORGANIZED)
│       ├── AdminDashboardPage.tsx
│       ├── AdminUsersPage.tsx
│       ├── ModulesPage.tsx               # Module CRUD (NEW)
│       ├── ModuleEditorPage.tsx          # Question editor (NEW)
│       ├── AdminCategoriesPage.tsx
│       ├── ConfigurationManagementPage.tsx
│       └── config/                       # Config sub-pages (NEW)
│           ├── QuestionsTab.tsx
│           ├── ModulesTab.tsx
│           └── DecisionTreeTab.tsx
│
├── ADMIN_SCOPE.md                        # Admin role design philosophy
├── ADMIN_VISION.md                       # 3-phase admin roadmap
├── ARCHITECTURE.md                       # System architecture
└── package.json
```

---

## Key Architectural Changes (vs pre-stage)

### 1. Generic Module Runner (NEW)

**Location:** `backend/app/services/module_runner.py`

**Purpose:** Execute ANY module based purely on JSON configuration - no module-specific Python code needed.

```python
class GenericModuleRunner:
    """Runs any module based on its config"""

    _sessions: Dict[str, SessionState] = {}  # In-memory session storage

    def start_session(self, user_id: int, session_id: str) -> StartSessionResponse:
        # 1. Load module config from modules/{slug}/config.json
        # 2. Load questions from modules/{slug}/questions.json
        # 3. Create session state
        # 4. Return first question

    def submit_answer(self, session_id: str, question_id: str, value: Any) -> AnswerResult:
        # 1. Store answer in session
        # 2. Evaluate showIf conditions for all remaining questions
        # 3. Find next applicable question
        # 4. Return next question or completion status

    def generate_output(self, session_id: str) -> Dict[str, OutputFile]:
        # Generate output files based on outputMapping definitions
```

**Key Difference from pre-stage:** In pre-stage, `payroll_area_graph.py` and `payment_method_graph.py` contain hardcoded question routing logic. In admin-config-reorg, that logic is driven entirely by `showIf` conditions in JSON.

---

### 2. Module Service Layer (NEW)

**Location:** `backend/app/services/module_service.py`

**Purpose:** CRUD operations for modules - create, read, update, delete entire modules.

```python
class ModuleService:
    def __init__(self, config_store: ConfigStore): ...

    def list_modules(self) -> List[ModuleSummary]:
        # Scans modules/*/config.json
        # Returns summaries with slug, name, description, status

    def get_module(self, slug: str) -> Optional[ModuleConfig]:
        # Loads config.json + questions.json
        # Returns full module with all questions

    def create_module(self, request: CreateModuleRequest) -> str:
        # 1. Slugify name: "Payment Terms" → "payment-terms"
        # 2. Create modules/{slug}/ directory
        # 3. Create config.json with metadata
        # 4. Create empty questions.json
        # Returns slug

    def update_module(self, slug: str, updates: Dict) -> bool:
        # Updates config.json fields

    def delete_module(self, slug: str) -> bool:
        # Removes entire module directory
```

---

### 3. Question Service Layer (NEW)

**Location:** `backend/app/services/question_service.py`

**Purpose:** CRUD operations for questions within a module.

```python
class QuestionService:
    def get_questions(self, module_slug: str) -> List[Question]:
        # Returns sorted questions from questions.json

    def add_question(self, module_slug: str, question: Question) -> Question:
        # Appends question to questions.json
        # Auto-generates ID if not provided

    def update_question(self, module_slug: str, question_id: str, updates: Dict) -> bool:
        # Updates specific question fields

    def delete_question(self, module_slug: str, question_id: str) -> bool:
        # Removes question from questions.json

    def reorder_questions(self, module_slug: str, question_ids: List[str]) -> List[Question]:
        # Reorders questions based on provided ID sequence
        # Updates order field: 0, 1, 2, ...
```

---

### 4. ConfigStore Abstraction (NEW)

**Location:** `backend/app/services/config_store.py`

**Purpose:** Abstract file storage - local filesystem now, S3-ready for production.

```python
class ConfigStore(ABC):
    """Abstract interface for config storage"""

    @abstractmethod
    def get(self, path: str) -> Optional[Dict]:
        # "modules/payroll-area/questions" → loads JSON
        pass

    @abstractmethod
    def save(self, path: str, data: Dict) -> None:
        # Writes JSON to path
        pass

    @abstractmethod
    def exists(self, path: str) -> bool: ...

    @abstractmethod
    def delete(self, path: str) -> bool: ...

    @abstractmethod
    def list(self, pattern: str) -> List[str]:
        # "modules/*/config" → finds all module configs
        pass

    @abstractmethod
    def copy(self, source: str, dest: str) -> None:
        # For creating backups
        pass


class LocalFileConfigStore(ConfigStore):
    """Filesystem implementation"""

    def __init__(self, base_path: str = "app/data"):
        self.base_path = Path(base_path)

    def get(self, path: str) -> Optional[Dict]:
        file_path = self.base_path / f"{path}.json"
        return json.loads(file_path.read_text()) if file_path.exists() else None
```

**Path Mapping:**
```
Logical Path                    →  Filesystem Path
modules/payroll-area/config     →  app/data/modules/payroll-area/config.json
modules/payroll-area/questions  →  app/data/modules/payroll-area/questions.json
metadata/modules                →  app/data/metadata/modules.json
```

---

### 5. Enhanced Question Schema (NEW)

**Location:** `backend/app/schemas/question.py`

```python
class QuestionType(str, Enum):
    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"
    TEXT = "text"
    NUMBER = "number"
    YES_NO = "yes_no"


class QuestionOption(BaseModel):
    value: Optional[str] = None      # Primary identifier
    label: str                       # Display text
    id: Optional[str] = None         # Legacy support
    description: Optional[str] = None

    @model_validator
    def normalize_value(cls, values):
        # If value is None but id exists, use id as value
        # Backward compatibility with old format


class ShowIfCondition(BaseModel):
    questionId: str
    equals: Optional[str] = None      # For single_select
    notEquals: Optional[str] = None
    contains: Optional[str] = None    # For multi_select
    answerId: Optional[str] = None    # Legacy format


class OutputMapping(BaseModel):
    outputFile: str                   # e.g., "payroll_areas.csv"
    column: str                       # e.g., "frequency"
    transform: Optional[str] = None   # e.g., "uppercase"


class Question(BaseModel):
    id: str
    text: str
    type: QuestionType
    options: Optional[List[QuestionOption]] = None
    showIf: Optional[ShowIfCondition] = None
    required: bool = True
    order: Optional[int] = None
    helpText: Optional[str] = None
    outputMapping: Optional[OutputMapping] = None
```

---

### 6. Hierarchy Management (NEW)

**Location:** `backend/app/routes/hierarchy.py`, `backend/app/database.py`

**Database Schema:**
```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,           -- "enterprise-structure"
    name TEXT NOT NULL,            -- "Enterprise Structure"
    display_order INTEGER DEFAULT 0
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,           -- "payroll-area"
    name TEXT NOT NULL,            -- "Payroll Area"
    category_id TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```

**Initial Hierarchy (seeded on startup):**
```
Enterprise Structure
├── Payroll Area
├── Company Code
├── Personnel Area
├── Employee Group
└── Employee Subgroup

Banking
└── Payment Method
```

**API Endpoints:**
```
GET  /api/hierarchy                    # Full tree
POST /api/hierarchy/categories         # Create category
PUT  /api/hierarchy/categories/{id}    # Update category
DELETE /api/hierarchy/categories/{id}  # Delete (cascades to tasks)
POST /api/hierarchy/tasks              # Create task
PUT  /api/hierarchy/tasks/{id}         # Update task
DELETE /api/hierarchy/tasks/{id}       # Delete task
PUT  /api/hierarchy/reorder            # Bulk reorder
```

---

### 7. New Admin Pages (Frontend)

#### `src/pages/admin/ModulesPage.tsx`
**Purpose:** Module list with CRUD operations

**Features:**
- Grid of module cards (name, description, status, question count)
- Create Module modal
- Delete confirmation dialog
- Edit button → navigates to ModuleEditorPage
- Status badges (draft, active, archived)

#### `src/pages/admin/ModuleEditorPage.tsx`
**Purpose:** Full question editor for a module

**Features:**
- **Questions Tab:**
  - List of questions with drag-to-reorder
  - Add/Edit/Delete question buttons
  - Question preview
  - showIf condition visualization

- **Settings Tab:**
  - Module name, description, icon
  - Status toggle (draft/active)
  - Save button

- **Preview Tab:**
  - Run module in preview mode
  - Test question flow without saving

**Key Components:**
```typescript
// Question editor modal
<QuestionEditor
    question={selectedQuestion}
    onSave={(q) => updateQuestion(moduleSlug, q.id, q)}
    onClose={() => setSelectedQuestion(null)}
/>

// Sortable question list
<DndContext onDragEnd={handleDragEnd}>
    <SortableContext items={questionIds}>
        {questions.map(q => (
            <SortableQuestionItem key={q.id} question={q} />
        ))}
    </SortableContext>
</DndContext>
```

#### `src/pages/ModulesListPage.tsx`
**Purpose:** Client-facing module list

**Features:**
- Shows only active modules (status !== 'draft')
- Start button for each module
- Progress indicator for in-progress sessions

#### `src/pages/ModuleSessionPage.tsx`
**Purpose:** Generic module execution UI

**Flow:**
1. Load module by slug from URL params
2. Call `startSession(slug)` to get first question
3. Display question with appropriate input type
4. On answer, call `submitAnswer()` to get next question
5. Repeat until `isComplete: true`
6. Show results and export options

---

## Backend Files - Detailed

### Core Entry Point

#### `backend/app/main.py`
**Purpose:** FastAPI application, route registration, lifecycle management

**Lifespan Events:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()                    # Create tables
    seed_default_users()         # admin123, test123
    seed_hierarchy()             # Categories and tasks from hierarchy.json

    yield

    # Shutdown (cleanup if needed)
```

**Route Registration:**
```python
app.include_router(modules_router, prefix="/api/modules")
app.include_router(module_config_router, prefix="/api/config/modules")
app.include_router(hierarchy_router, prefix="/api/hierarchy")
app.include_router(export_router, prefix="/api/export")
app.include_router(knowledgebase_router, prefix="/api/knowledge")
```

**Key Endpoints Defined Inline:**
```python
# Authentication
POST /api/auth/login           # Login, returns JWT
POST /api/auth/register        # Registration (disabled)
GET  /api/auth/me              # Validate token
PUT  /api/auth/password        # Change password

# Legacy Session (still functional)
POST /api/start                # Start LangGraph session
POST /api/answer               # Submit answer (uses master_graph)
GET  /api/session/{id}         # Get session state

# Admin User Management
GET  /api/admin/users          # List users
POST /api/admin/users          # Create user
PUT  /api/admin/users/{id}     # Update user
DELETE /api/admin/users/{id}   # Delete user
GET  /api/admin/users/{id}/progress  # User progress
```

---

### Routes Layer

#### `backend/app/routes/modules.py`
**Purpose:** RESTful API for generic module operations

**Endpoints:**

```python
# Module CRUD
GET  /api/modules                      # List all modules
POST /api/modules                      # Create module (admin)
GET  /api/modules/{slug}               # Get module with questions
PUT  /api/modules/{slug}               # Update module (admin)
DELETE /api/modules/{slug}             # Delete module (admin)

# Question CRUD
GET  /api/modules/{slug}/questions     # List questions
POST /api/modules/{slug}/questions     # Add question (admin)
PUT  /api/modules/{slug}/questions/{id}    # Update question (admin)
DELETE /api/modules/{slug}/questions/{id}  # Delete question (admin)
PUT  /api/modules/{slug}/questions/reorder # Reorder questions (admin)

# Session Management
POST /api/modules/{slug}/sessions      # Start session
GET  /api/modules/{slug}/sessions/{id} # Get session state
POST /api/modules/{slug}/sessions/{id}/answer  # Submit answer
GET  /api/modules/{slug}/sessions/{id}/output  # Get output files
```

**Dependencies:**
```python
from services.module_service import ModuleService
from services.question_service import QuestionService
from services.module_runner import GenericModuleRunner
from services.config_store import LocalFileConfigStore
from middleware import get_current_user, require_admin
```

---

#### `backend/app/routes/module_config.py`
**Purpose:** Configuration management with legacy path support

**Supports Both Paths:**
```python
# New structure
modules/{slug}/questions.json

# Legacy structure (fallback)
config/questions_current.json      # For payroll-area
data/payment_method_questions.json # For payment-methods
```

**Endpoints:**
```python
GET  /api/config/modules                    # List module configs
GET  /api/config/modules/{slug}             # Get config
PUT  /api/config/modules/{slug}             # Update config (admin)
GET  /api/config/modules/{slug}/questions   # Get questions
PUT  /api/config/modules/{slug}/questions   # Update questions (admin)
POST /api/config/modules/{slug}/questions/restore  # Restore backup (admin)
```

**Backup Strategy:**
- Before any update, copies current → backup
- Restore options: original, backup
- Validates question schema before saving

---

#### `backend/app/routes/hierarchy.py`
**Purpose:** Category and task hierarchy management

**Data Model:**
```python
# Response format
{
    "categories": [
        {
            "id": "enterprise-structure",
            "name": "Enterprise Structure",
            "displayOrder": 0,
            "tasks": [
                {
                    "id": "payroll-area",
                    "name": "Payroll Area",
                    "displayOrder": 0
                }
            ]
        }
    ]
}
```

**Endpoints:**
```python
GET  /api/hierarchy                           # Full tree
POST /api/hierarchy/categories                # Create category
PUT  /api/hierarchy/categories/{id}           # Update
DELETE /api/hierarchy/categories/{id}         # Delete (cascades)
POST /api/hierarchy/categories/{cat_id}/tasks # Create task
PUT  /api/hierarchy/tasks/{id}                # Update task
DELETE /api/hierarchy/tasks/{id}              # Delete task
PUT  /api/hierarchy/reorder                   # Bulk reorder
```

---

### Services Layer

#### `backend/app/services/module_runner.py`
**Purpose:** Generic execution engine for any config-driven module

**Session State:**
```python
class SessionState:
    id: str
    module_slug: str
    user_id: int
    status: SessionStatus  # IN_PROGRESS, COMPLETED
    answers: Dict[str, Any]
    current_question_id: Optional[str]
    created_at: datetime
    updated_at: datetime
```

**Execution Flow:**
```python
def submit_answer(self, session_id: str, question_id: str, value: Any) -> AnswerResult:
    session = self._sessions[session_id]

    # Store answer
    session.answers[question_id] = value

    # Find next question
    questions = self._load_questions(session.module_slug)

    for q in questions:
        # Skip already answered
        if q.id in session.answers:
            continue

        # Check showIf condition
        if q.showIf:
            if not self._evaluate_condition(q.showIf, session.answers):
                continue  # Condition not met, skip this question

        # Found next question
        return AnswerResult(
            nextQuestionId=q.id,
            nextQuestion=q,
            progress=self._calculate_progress(session),
            isComplete=False
        )

    # No more questions
    session.status = SessionStatus.COMPLETED
    return AnswerResult(isComplete=True, progress=100)


def _evaluate_condition(self, condition: ShowIfCondition, answers: Dict) -> bool:
    answer = answers.get(condition.questionId)

    if condition.equals:
        return answer == condition.equals

    if condition.contains:
        return condition.contains in (answer or [])

    if condition.notEquals:
        return answer != condition.notEquals

    # Legacy answerId format
    if condition.answerId:
        return answer == condition.answerId or condition.answerId in (answer or [])

    return True
```

---

#### `backend/app/services/config_store.py`
**Purpose:** Abstraction layer for configuration storage

**Interface:**
```python
class ConfigStore(ABC):
    @abstractmethod
    def get(self, path: str) -> Optional[Dict]: ...

    @abstractmethod
    def save(self, path: str, data: Dict) -> None: ...

    @abstractmethod
    def exists(self, path: str) -> bool: ...

    @abstractmethod
    def delete(self, path: str) -> bool: ...

    @abstractmethod
    def list(self, pattern: str) -> List[str]: ...

    @abstractmethod
    def copy(self, source: str, dest: str) -> None: ...
```

**Local Implementation:**
```python
class LocalFileConfigStore(ConfigStore):
    def __init__(self, base_path: str = "app/data"):
        self.base_path = Path(base_path)

    def get(self, path: str) -> Optional[Dict]:
        file_path = self.base_path / f"{path}.json"
        if not file_path.exists():
            return None
        return json.loads(file_path.read_text())

    def save(self, path: str, data: Dict) -> None:
        file_path = self.base_path / f"{path}.json"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(json.dumps(data, indent=2))

    def list(self, pattern: str) -> List[str]:
        # pattern: "modules/*/config"
        # Returns: ["modules/payroll-area/config", "modules/payment-methods/config", ...]
        glob_pattern = f"{pattern}.json"
        matches = self.base_path.glob(glob_pattern)
        return [str(m.relative_to(self.base_path))[:-5] for m in matches]
```

**Future S3 Implementation (planned):**
```python
class S3ConfigStore(ConfigStore):
    def __init__(self, bucket: str, prefix: str = "configs/"):
        self.s3 = boto3.client('s3')
        self.bucket = bucket
        self.prefix = prefix

    def get(self, path: str) -> Optional[Dict]:
        key = f"{self.prefix}{path}.json"
        response = self.s3.get_object(Bucket=self.bucket, Key=key)
        return json.loads(response['Body'].read())
```

---

### Schemas Layer

#### `backend/app/schemas/module.py`
```python
class ModuleStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ModuleMetadata(BaseModel):
    slug: str
    name: str
    description: str = ""
    icon: str = "box"
    status: ModuleStatus = ModuleStatus.DRAFT
    category: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ModuleSummary(BaseModel):
    """Lightweight module info for listings"""
    slug: str
    name: str
    description: str
    icon: str
    status: ModuleStatus
    question_count: int = 0


class ModuleConfig(ModuleMetadata):
    """Full module with questions"""
    questions: List[Question] = []
    output_files: List[str] = []


class CreateModuleRequest(BaseModel):
    name: str
    description: str = ""
    icon: str = "box"
    category: Optional[str] = None


class UpdateModuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[ModuleStatus] = None
```

---

#### `backend/app/schemas/session.py`
```python
class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class SessionState(BaseModel):
    id: str
    module_slug: str
    user_id: int
    status: SessionStatus
    answers: Dict[str, Any]
    current_question_id: Optional[str]
    progress: int  # 0-100
    created_at: datetime
    updated_at: datetime


class StartSessionResponse(BaseModel):
    session_id: str
    module_slug: str
    first_question_id: str
    first_question: Question


class SubmitAnswerRequest(BaseModel):
    question_id: str
    value: Any  # str, List[str], int, bool depending on question type


class AnswerResult(BaseModel):
    success: bool = True
    next_question_id: Optional[str] = None
    next_question: Optional[Question] = None
    is_complete: bool = False
    progress: int


class OutputFile(BaseModel):
    name: str
    format: str  # csv, json, xml
    content: str
    columns: Optional[List[str]] = None
    rows: Optional[List[Dict]] = None
```

---

### Data Files

#### Module Directory Structure
```
backend/app/data/modules/
├── payroll-area/
│   ├── config.json           # Module metadata
│   ├── questions.json        # Questions with showIf logic
│   └── questions_backup.json # Backup before last edit
│
├── payment-methods/
│   ├── config.json
│   └── questions.json
│
├── tax-company/
│   ├── config.json
│   └── questions.json
│
└── bank-details/
    ├── config.json
    └── questions.json
```

#### `config.json` Example
```json
{
    "slug": "payroll-area",
    "name": "Payroll Area Configuration",
    "description": "Configure payroll areas for your organization",
    "icon": "calendar",
    "status": "active",
    "category": "enterprise-structure",
    "createdAt": "2024-12-15T10:00:00Z",
    "updatedAt": "2025-01-20T14:30:00Z"
}
```

#### `questions.json` Example
```json
{
    "metadata": {
        "version": "2.0",
        "createdAt": "2024-12-15T10:00:00Z",
        "updatedAt": "2025-01-20T14:30:00Z"
    },
    "questions": [
        {
            "id": "q1_frequencies",
            "text": "What pay frequencies does your organization use?",
            "type": "multi_select",
            "order": 0,
            "required": true,
            "options": [
                {"value": "weekly", "label": "Weekly", "description": "Paid every week"},
                {"value": "biweekly", "label": "Bi-weekly", "description": "Paid every two weeks"},
                {"value": "semimonthly", "label": "Semi-monthly", "description": "Paid twice per month"},
                {"value": "monthly", "label": "Monthly", "description": "Paid once per month"}
            ]
        },
        {
            "id": "q1_weekly_pattern",
            "text": "For WEEKLY payroll, what period pattern do you use?",
            "type": "single_select",
            "order": 1,
            "showIf": {
                "questionId": "q1_frequencies",
                "contains": "weekly"
            },
            "options": [
                {"value": "mon_sun", "label": "Monday - Sunday"},
                {"value": "sun_sat", "label": "Sunday - Saturday"}
            ]
        },
        {
            "id": "q1_weekly_payday",
            "text": "What day are weekly employees paid?",
            "type": "single_select",
            "order": 2,
            "showIf": {
                "questionId": "q1_frequencies",
                "contains": "weekly"
            },
            "options": [
                {"value": "friday", "label": "Friday"},
                {"value": "thursday", "label": "Thursday"}
            ],
            "outputMapping": {
                "outputFile": "payroll_areas.csv",
                "column": "pay_day"
            }
        }
    ]
}
```

---

## Frontend Files - Detailed

### API Layer

#### `src/api/modules.ts`
**Purpose:** Complete API client for module operations

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Module CRUD
export async function listModules(): Promise<ModuleSummary[]>
export async function getModule(slug: string): Promise<ModuleConfig>
export async function createModule(data: CreateModuleRequest): Promise<ModuleSummary>
export async function updateModule(slug: string, data: UpdateModuleRequest): Promise<ModuleSummary>
export async function deleteModule(slug: string): Promise<void>

// Question CRUD
export async function getQuestions(slug: string): Promise<Question[]>
export async function addQuestion(slug: string, question: Question): Promise<Question>
export async function updateQuestion(slug: string, questionId: string, updates: Partial<Question>): Promise<Question>
export async function deleteQuestion(slug: string, questionId: string): Promise<void>
export async function reorderQuestions(slug: string, questionIds: string[]): Promise<Question[]>

// Session Management
export async function startSession(slug: string): Promise<StartSessionResponse>
export async function getSession(slug: string, sessionId: string): Promise<SessionState>
export async function submitAnswer(slug: string, sessionId: string, questionId: string, value: any): Promise<AnswerResult>
export async function getSessionOutput(slug: string, sessionId: string, format?: string): Promise<OutputFiles>
```

---

### Admin Pages

#### `src/pages/admin/ModulesPage.tsx`
**Purpose:** Module list and management

**State:**
```typescript
const [modules, setModules] = useState<ModuleSummary[]>([]);
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
```

**Key Functions:**
```typescript
const loadModules = async () => {
    const data = await listModules();
    setModules(data);
};

const handleCreate = async (data: CreateModuleRequest) => {
    await createModule(data);
    await loadModules();
    setIsCreateModalOpen(false);
};

const handleDelete = async (slug: string) => {
    await deleteModule(slug);
    await loadModules();
    setDeleteConfirm(null);
};
```

**UI Structure:**
```tsx
<AdminLayout title="Modules" currentPath="/admin/modules">
    <div className="flex justify-between mb-6">
        <h2>Configuration Modules</h2>
        <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus /> Create Module
        </Button>
    </div>

    <div className="grid grid-cols-3 gap-4">
        {modules.map(module => (
            <ModuleCard
                key={module.slug}
                module={module}
                onEdit={() => navigate(`/admin/modules/${module.slug}`)}
                onDelete={() => setDeleteConfirm(module.slug)}
            />
        ))}
    </div>

    <CreateModuleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
    />
</AdminLayout>
```

---

#### `src/pages/admin/ModuleEditorPage.tsx`
**Purpose:** Question editor with tabs

**URL Params:** `/admin/modules/:slug`

**State:**
```typescript
const { slug } = useParams();
const [module, setModule] = useState<ModuleConfig | null>(null);
const [activeTab, setActiveTab] = useState<'questions' | 'settings' | 'preview'>('questions');
const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
const [hasChanges, setHasChanges] = useState(false);
```

**Tabs:**

**Questions Tab:**
```tsx
<DndContext onDragEnd={handleReorder}>
    <SortableContext items={module.questions.map(q => q.id)}>
        {module.questions.map((question, index) => (
            <SortableQuestionRow
                key={question.id}
                question={question}
                index={index}
                onEdit={() => setSelectedQuestion(question)}
                onDelete={() => handleDeleteQuestion(question.id)}
            />
        ))}
    </SortableContext>
</DndContext>

<Button onClick={() => setSelectedQuestion({} as Question)}>
    <Plus /> Add Question
</Button>

<QuestionEditorModal
    question={selectedQuestion}
    onSave={handleSaveQuestion}
    onClose={() => setSelectedQuestion(null)}
/>
```

**Settings Tab:**
```tsx
<form onSubmit={handleSaveSettings}>
    <Input label="Name" value={module.name} onChange={...} />
    <Textarea label="Description" value={module.description} onChange={...} />
    <Select label="Icon" value={module.icon} options={iconOptions} onChange={...} />
    <Select label="Status" value={module.status} options={statusOptions} onChange={...} />
    <Button type="submit">Save Settings</Button>
</form>
```

**Preview Tab:**
```tsx
<ModulePreview
    module={module}
    onComplete={(answers) => console.log('Preview complete:', answers)}
/>
```

---

#### `src/pages/ModuleSessionPage.tsx`
**Purpose:** Run any module (client-facing)

**URL Params:** `/modules/:slug`

**State:**
```typescript
const { slug } = useParams();
const [session, setSession] = useState<SessionState | null>(null);
const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
const [isComplete, setIsComplete] = useState(false);
const [output, setOutput] = useState<OutputFiles | null>(null);
```

**Flow:**
```typescript
useEffect(() => {
    const initSession = async () => {
        const response = await startSession(slug);
        setSession({ id: response.session_id, ... });
        setCurrentQuestion(response.first_question);
    };
    initSession();
}, [slug]);

const handleAnswer = async (value: any) => {
    const result = await submitAnswer(slug, session.id, currentQuestion.id, value);

    if (result.is_complete) {
        setIsComplete(true);
        const outputData = await getSessionOutput(slug, session.id);
        setOutput(outputData);
    } else {
        setCurrentQuestion(result.next_question);
    }
};
```

**UI:**
```tsx
{!isComplete ? (
    <QuestionCard
        question={currentQuestion}
        onAnswer={handleAnswer}
        progress={session?.progress || 0}
    />
) : (
    <ResultsPanel
        output={output}
        onDownload={handleDownload}
        onStartOver={() => initSession()}
    />
)}
```

---

## Data Flow Diagrams

### Creating a Module (Admin)

```
Admin clicks "Create Module"
         │
         ▼
┌─────────────────┐
│  ModulesPage    │  Opens CreateModuleModal
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Modal Form     │  name: "Tax Settings", description: "...", icon: "file-text"
└────────┬────────┘
         │
         ▼
┌─────────────────┐     POST /api/modules
│  api/modules.ts │ ────────────────────────────────────────────►
└─────────────────┘     { name, description, icon }
                        │
                        ▼
                  ┌─────────────────┐
                  │ routes/modules  │  Validate request, check admin role
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ module_service  │
                  │ .create_module()│
                  └────────┬────────┘
                           │
                           ├─► Slugify: "Tax Settings" → "tax-settings"
                           ├─► Create: data/modules/tax-settings/
                           ├─► Write: config.json
                           └─► Write: questions.json (empty)
                           │
                           ▼
◄──────────────────────────┘
{ slug: "tax-settings", name: "Tax Settings", ... }
```

### Running a Module Session

```
User clicks "Start" on module card
         │
         ▼
┌─────────────────┐     POST /api/modules/{slug}/sessions
│ModuleSessionPage│ ───────────────────────────────────────────►
└─────────────────┘
                        │
                        ▼
                  ┌─────────────────┐
                  │  module_runner  │
                  │ .start_session()│
                  └────────┬────────┘
                           │
                           ├─► Generate session_id (UUID)
                           ├─► Load config.json
                           ├─► Load questions.json
                           ├─► Create SessionState (IN_PROGRESS)
                           ├─► Find first question (order=0, no showIf)
                           └─► Store in _sessions dict
                           │
◄──────────────────────────┘
{ session_id, first_question_id, first_question }

User answers question
         │
         ▼
┌─────────────────┐     POST /api/modules/{slug}/sessions/{id}/answer
│ModuleSessionPage│ ───────────────────────────────────────────────────►
└─────────────────┘     { question_id: "q1", value: ["weekly", "monthly"] }
                        │
                        ▼
                  ┌─────────────────┐
                  │  module_runner  │
                  │ .submit_answer()│
                  └────────┬────────┘
                           │
                           ├─► Store: answers["q1"] = ["weekly", "monthly"]
                           ├─► For each remaining question:
                           │      Check showIf condition against answers
                           │      If condition met → return as next question
                           ├─► Calculate progress: answered / total applicable
                           └─► Return next question or isComplete=true
                           │
◄──────────────────────────┘
{ next_question_id, next_question, progress: 33, is_complete: false }

         ... repeat until is_complete: true ...

User clicks "Download Results"
         │
         ▼
┌─────────────────┐     GET /api/modules/{slug}/sessions/{id}/output
│ModuleSessionPage│ ───────────────────────────────────────────────────►
└─────────────────┘
                        │
                        ▼
                  ┌─────────────────┐
                  │ output_generator│
                  │  .generate()    │
                  └────────┬────────┘
                           │
                           ├─► Load output mappings from questions
                           ├─► For each mapping:
                           │      Get answer value
                           │      Apply transform (if any)
                           │      Add to output file
                           └─► Return files with content
                           │
◄──────────────────────────┘
{ files: { "payroll_areas.csv": { columns, rows, content } } }
```

---

## Legacy vs New Components

### What's Being Replaced

| Legacy Component | New Component | Status |
|------------------|---------------|--------|
| `agents/payroll/payroll_area_graph.py` | `services/module_runner.py` | Legacy still works, new preferred |
| `agents/payments/payment_method_graph.py` | `services/module_runner.py` | Legacy still works, new preferred |
| `agents/graph.py` (master_graph) | `services/module_runner.py` | Legacy still works for /api/start |
| `config/questions_current.json` | `data/modules/payroll-area/questions.json` | Both paths supported |
| Hardcoded question IDs in Python | JSON showIf conditions | Fully config-driven now |

### Backward Compatibility

The system maintains backward compatibility:

1. **Legacy endpoints still work:**
   - `POST /api/start` → Uses master_graph
   - `POST /api/answer` → Uses master_graph

2. **Legacy file paths supported:**
   - `config/questions_current.json` → Mapped to payroll-area module
   - `data/payment_method_questions.json` → Mapped to payment-methods module

3. **Legacy question format:**
   - Options with `id/label` auto-convert to `value/label`
   - `answerId` in showIf converts to `equals` or `contains`

---

## Architecture Decisions

### 1. Generic Over Specific
**Decision:** Replace module-specific Python code with config-driven execution
**Rationale:** Supports unlimited modules without code deployment
**Trade-off:** Complex conditional logic harder to express in JSON

### 2. ConfigStore Abstraction
**Decision:** Abstract file storage behind interface
**Rationale:** Easy migration to S3 without application changes
**Current:** LocalFileConfigStore (filesystem)
**Future:** S3ConfigStore (cloud)

### 3. In-Memory Sessions + Optional Persistence
**Decision:** Sessions stored in GenericModuleRunner._sessions dict
**Rationale:** Fast, simple, sufficient for current scale
**Persistence:** Can optionally save to database for recovery
**Trade-off:** Sessions lost on server restart (acceptable for now)

### 4. Single-Instance Deployment
**Decision:** No multi-tenancy, each customer = isolated instance
**Rationale:** Strong data isolation, simpler security
**Benefit:** Customers can customize without affecting others
**Trade-off:** More infrastructure at scale

### 5. Admin-Editable Hierarchy
**Decision:** Categories/tasks stored in database, not hardcoded
**Rationale:** Customers can organize modules their way
**Implementation:** hierarchy.json seeds initial structure, then DB is source of truth

---

## Quick Reference

### Backend Routes Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/auth/login | - | Login |
| GET | /api/auth/me | User | Validate token |
| GET | /api/modules | User | List modules |
| POST | /api/modules | Admin | Create module |
| GET | /api/modules/{slug} | User | Get module |
| PUT | /api/modules/{slug} | Admin | Update module |
| DELETE | /api/modules/{slug} | Admin | Delete module |
| GET | /api/modules/{slug}/questions | User | List questions |
| POST | /api/modules/{slug}/questions | Admin | Add question |
| PUT | /api/modules/{slug}/questions/{id} | Admin | Update question |
| DELETE | /api/modules/{slug}/questions/{id} | Admin | Delete question |
| PUT | /api/modules/{slug}/questions/reorder | Admin | Reorder questions |
| POST | /api/modules/{slug}/sessions | User | Start session |
| POST | /api/modules/{slug}/sessions/{id}/answer | User | Submit answer |
| GET | /api/modules/{slug}/sessions/{id}/output | User | Get output |
| GET | /api/hierarchy | User | Get hierarchy |
| POST | /api/hierarchy/categories | Admin | Create category |
| POST | /api/hierarchy/tasks | Admin | Create task |

### Frontend Routes Summary

| Path | Component | Auth | New? |
|------|-----------|------|------|
| /login | AuthPage | - | |
| /dashboard | DashboardPage | Client | |
| /modules | ModulesListPage | Client | NEW |
| /modules/:slug | ModuleSessionPage | Client | NEW |
| /admin/dashboard | AdminDashboardPage | Admin | |
| /admin/modules | ModulesPage | Admin | NEW |
| /admin/modules/:slug | ModuleEditorPage | Admin | NEW |
| /admin/categories | AdminCategoriesPage | Admin | |
| /admin/users | AdminUsersPage | Admin | |

### Key Files by Purpose

| Purpose | Backend | Frontend |
|---------|---------|----------|
| Module CRUD | services/module_service.py | api/modules.ts |
| Question CRUD | services/question_service.py | api/modules.ts |
| Module Execution | services/module_runner.py | pages/ModuleSessionPage.tsx |
| Config Storage | services/config_store.py | - |
| Admin Module UI | routes/modules.py | pages/admin/ModulesPage.tsx |
| Question Editor | routes/modules.py | pages/admin/ModuleEditorPage.tsx |
| Hierarchy | routes/hierarchy.py | api/hierarchy.ts |
