# TurboSAP Architecture Overview

> High-level system architecture for technical stakeholders
> **Branch:** `admin-config-reorg`

---

## What Problem Does TurboSAP Solve?

**The Challenge:** Configuring SAP HCM (Human Capital Management) is notoriously complex. Setting up payroll areas, payment methods, company codes, and organizational structures requires deep SAP expertise and typically takes consultants weeks of discovery sessions with clients.

**Our Solution:** TurboSAP replaces that manual discovery process with a guided, conversational Q&A flow. Instead of consultants asking open-ended questions and interpreting answers, the system:

1. Asks structured questions in plain English
2. Applies business logic to determine follow-up questions
3. Generates SAP-ready configuration files automatically

**The Value:** A client HR administrator who knows nothing about SAP can answer questions about their payroll frequencies, business units, and payment methods—and get exportable SAP configuration tables at the end.

---

## What's Different About This Branch?

The `admin-config-reorg` branch represents a **fundamental architectural shift** from hardcoded modules to a fully config-driven system:

| Capability | Before | After (This Branch) |
|------------|--------|---------------------|
| Adding a new module | Write Python code, deploy | Create via admin UI, no deploy |
| Editing questions | Modify Python, redeploy | Edit JSON in browser, instant |
| Number of modules | 2 (payroll, payment) | Unlimited |
| Question routing logic | Hardcoded in Python | JSON `showIf` conditions |
| Module execution | Module-specific graph classes | Single generic runner |

**Why this matters:** Consultants and admins can create and customize configuration modules without developer involvement.

---

## Core User Flows

### Client Flow (unchanged)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT JOURNEY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. LOGIN                                                               │
│      ↓                                                                   │
│   2. SELECT MODULE (e.g., "Payroll Area Configuration")                  │
│      ↓                                                                   │
│   3. ANSWER QUESTIONS                                                    │
│      • "What pay frequencies do you use?" → Weekly, Biweekly             │
│      • "For weekly payroll, what's the period pattern?" → Mon-Sun        │
│      • "What day do weekly employees get paid?" → Friday                 │
│      ↓                                                                   │
│   4. SYSTEM GENERATES CONFIGURATION                                      │
│      • Payroll Area PA01: Weekly Mon-Sun Friday - HQ                     │
│      • Payroll Area PA02: Biweekly Sun-Sat Thursday - All Units          │
│      ↓                                                                   │
│   5. EXPORT SAP FILES                                                    │
│      • T549A.csv (Payroll Areas)                                         │
│      • T549Q.csv (Payroll Calendars)                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Admin Flow (NEW)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ADMIN JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. LOGIN (admin role)                                                  │
│      ↓                                                                   │
│   2. MANAGE MODULES                                                      │
│      • View all modules (draft, active, archived)                        │
│      • Create new module: "Benefits Enrollment"                          │
│      • Set status: draft → active (makes it visible to clients)          │
│      ↓                                                                   │
│   3. EDIT QUESTIONS                                                      │
│      • Add question: "What benefits do you offer?"                       │
│      • Set type: multi_select                                            │
│      • Add options: Health, Dental, Vision, 401k                         │
│      • Add conditional: Show "401k match %" only if 401k selected        │
│      • Drag to reorder questions                                         │
│      ↓                                                                   │
│   4. PREVIEW & TEST                                                      │
│      • Run module in preview mode                                        │
│      • Verify question flow works correctly                              │
│      ↓                                                                   │
│   5. ACTIVATE                                                            │
│      • Set status to "active"                                            │
│      • Module immediately available to clients                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## System Components

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│  │     FRONTEND        │         │            BACKEND                   │   │
│  │   React + Vite      │  HTTP   │         FastAPI + Python             │   │
│  │                     │ ◄─────► │                                      │   │
│  │  • Client UI        │  JSON   │  ┌─────────────────────────────┐    │   │
│  │  • Admin UI (NEW)   │         │  │       API LAYER             │    │   │
│  │  • Module Runner    │         │  │  Routes + Middleware        │    │   │
│  │                     │         │  └──────────────┬──────────────┘    │   │
│  │                     │         │                 │                    │   │
│  │  State: Zustand     │         │  ┌──────────────▼──────────────┐    │   │
│  │  (localStorage)     │         │  │      SERVICE LAYER (NEW)    │    │   │
│  └─────────────────────┘         │  │  ModuleService              │    │   │
│                                  │  │  QuestionService            │    │   │
│                                  │  │  GenericModuleRunner        │    │   │
│                                  │  └──────────────┬──────────────┘    │   │
│                                  │                 │                    │   │
│                                  │  ┌──────────────▼──────────────┐    │   │
│                                  │  │     CONFIG STORE (NEW)      │    │   │
│                                  │  │  Abstract Storage Layer     │    │   │
│                                  │  │  (Local FS → S3 ready)      │    │   │
│                                  │  └──────────────┬──────────────┘    │   │
│                                  │                 │                    │   │
│                                  │  ┌──────────────▼──────────────┐    │   │
│                                  │  │      DATA LAYER             │    │   │
│                                  │  │  SQLite + JSON Configs      │    │   │
│                                  │  └─────────────────────────────┘    │   │
│                                  └─────────────────────────────────────┘   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Technology | Responsibility | New in this branch? |
|-----------|------------|----------------|---------------------|
| **Frontend** | React 19, TypeScript, Vite | UI rendering, client-side state | Enhanced admin UI |
| **API Layer** | FastAPI | HTTP endpoints, auth middleware | New module routes |
| **Service Layer** | Python classes | Business logic, CRUD operations | **NEW** |
| **Config Store** | Abstract + Local FS | Configuration file abstraction | **NEW** |
| **Generic Runner** | Python | Execute any module from config | **NEW** |
| **Database** | SQLite | Users, sessions, hierarchy | Hierarchy tables new |
| **Module Configs** | JSON files | Module definitions, questions | **NEW structure** |

---

## Data Flow

### 1. Module Execution (Generic Runner)

```
User starts module "payroll-area"
         │
         ▼
┌─────────────────┐     POST /api/modules/payroll-area/sessions
│    Frontend     │ ─────────────────────────────────────────────►
└─────────────────┘
                        │
                        ▼
                  ┌─────────────────┐
                  │  API Router     │  Validate auth
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────────────────────────────────┐
                  │         GenericModuleRunner (NEW)           │
                  │                                             │
                  │  1. Generate session_id                     │
                  │  2. Load modules/payroll-area/config.json   │
                  │  3. Load modules/payroll-area/questions.json│
                  │  4. Create SessionState (in-memory)         │
                  │  5. Find first question (order=0)           │
                  └────────┬────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  ConfigStore    │  Read JSON files
                  └────────┬────────┘
                           │
◄──────────────────────────┘
{sessionId: "abc123", firstQuestion: {id: "q1_frequencies", text: "..."}}
```

### 2. Answer Submission with Conditional Logic

```
User selects "Weekly" and "Biweekly"
         │
         ▼
┌─────────────────┐     POST /api/modules/.../sessions/abc123/answer
│    Frontend     │ ────────────────────────────────────────────────────►
└─────────────────┘     {questionId: "q1_frequencies", value: ["weekly", "biweekly"]}
                        │
                        ▼
                  ┌─────────────────────────────────────────────────────┐
                  │              GenericModuleRunner                     │
                  │                                                      │
                  │  1. Store answer: answers["q1_frequencies"] =        │
                  │                   ["weekly", "biweekly"]             │
                  │                                                      │
                  │  2. Evaluate showIf for each remaining question:     │
                  │                                                      │
                  │     q1_weekly_pattern:                               │
                  │       showIf: {questionId: "q1_frequencies",         │
                  │                contains: "weekly"}                   │
                  │       → answers["q1_frequencies"] contains "weekly"  │
                  │       → TRUE → Show this question next               │
                  │                                                      │
                  │     q1_monthly_details:                              │
                  │       showIf: {questionId: "q1_frequencies",         │
                  │                contains: "monthly"}                  │
                  │       → answers["q1_frequencies"] contains "monthly" │
                  │       → FALSE → Skip this question                   │
                  │                                                      │
                  │  3. Return next applicable question                  │
                  └────────┬────────────────────────────────────────────┘
                           │
◄──────────────────────────┘
{nextQuestion: {id: "q1_weekly_pattern", ...}, progress: 15}
```

### 3. Admin Creating a Module

```
Admin clicks "Create Module"
         │
         ▼
┌─────────────────┐     POST /api/modules
│  Admin UI       │ ─────────────────────────────────────────────►
└─────────────────┘     {name: "Tax Settings", description: "...", icon: "file"}
                        │
                        ▼
                  ┌─────────────────┐
                  │  ModuleService  │
                  └────────┬────────┘
                           │
                           ├─► Slugify: "Tax Settings" → "tax-settings"
                           │
                           ├─► Create directory:
                           │   data/modules/tax-settings/
                           │
                           ├─► Write config.json:
                           │   {
                           │     "slug": "tax-settings",
                           │     "name": "Tax Settings",
                           │     "status": "draft",
                           │     ...
                           │   }
                           │
                           └─► Write questions.json:
                               {
                                 "questions": []
                               }
                           │
◄──────────────────────────┘
{slug: "tax-settings", name: "Tax Settings", status: "draft"}

Admin can now add questions via UI → No code, no deploy
```

---

## Key Architectural Decisions

### 1. Generic Module Runner (vs Module-Specific Code)

**Old Approach (pre-stage):**
```python
# payroll_area_graph.py - 500+ lines of hardcoded logic
def determine_next_question(answers):
    if "q1_frequencies" not in answers:
        return "q1_frequencies"
    if "weekly" in answers["q1_frequencies"]:
        if "q1_weekly_pattern" not in answers:
            return "q1_weekly_pattern"
    # ... hundreds more lines ...
```

**New Approach (this branch):**
```python
# module_runner.py - Generic for ALL modules
def get_next_question(session, questions):
    for question in questions:
        if question.id in session.answers:
            continue  # Already answered

        if question.showIf:
            if not evaluate_condition(question.showIf, session.answers):
                continue  # Condition not met, skip

        return question  # Next applicable question

    return None  # All done
```

**Benefits:**
- New modules without code changes
- Admins can modify question flow
- Single codebase to maintain

**Trade-off:**
- Complex branching logic harder in JSON than Python
- Currently supported: `equals`, `contains`, `notEquals`

---

### 2. ConfigStore Abstraction Layer

**What:** All configuration access goes through an abstract interface

```python
class ConfigStore(ABC):
    def get(path: str) -> Dict        # Read config
    def save(path: str, data: Dict)   # Write config
    def exists(path: str) -> bool     # Check existence
    def delete(path: str) -> bool     # Remove config
    def list(pattern: str) -> List    # Find configs
    def copy(src, dst)                # Backup
```

**Current Implementation:** `LocalFileConfigStore`
- Stores JSON in `backend/app/data/`
- Simple filesystem operations

**Future Implementation:** `S3ConfigStore`
- Same interface, cloud storage
- Zero application code changes

**Why this matters:** Production deployment can use S3 without touching business logic

---

### 3. Single-Instance Deployment (No Multi-Tenancy)

**Decision:** Each customer gets their own isolated TurboSAP instance

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Customer A    │     │   Customer B    │     │   Customer C    │
│   Instance      │     │   Instance      │     │   Instance      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Own database  │     │ • Own database  │     │ • Own database  │
│ • Own configs   │     │ • Own configs   │     │ • Own configs   │
│ • Own users     │     │ • Own users     │     │ • Own users     │
│ • Own modules   │     │ • Own modules   │     │ • Own modules   │
└─────────────────┘     └─────────────────┘     └─────────────────┘

        No data sharing between instances
        No super-admin across instances
        No tenant_id columns anywhere
```

**Why:**
- **Simpler security** - No risk of data leakage between customers
- **Customer customization** - Each can modify modules freely
- **Compliance friendly** - Data residency is straightforward
- **Matches SAP model** - Each company = separate SAP instance

**Trade-off:** More infrastructure at scale (solved via containerization)

---

### 4. Hierarchy as Database Tables (Not Hardcoded)

**What:** Categories and tasks stored in SQLite, editable by admins

```sql
categories                          tasks
┌────────────────────────┐         ┌────────────────────────────┐
│ id: "enterprise"       │────┐    │ id: "payroll-area"         │
│ name: "Enterprise..."  │    │    │ category_id: "enterprise"  │
│ display_order: 0       │    └───►│ name: "Payroll Area"       │
└────────────────────────┘         │ display_order: 0           │
                                   └────────────────────────────┘
```

**Initial seed from `hierarchy.json`:**
```json
{
  "categories": [
    {
      "name": "Enterprise Structure",
      "tasks": ["Payroll Area", "Company Code", "Personnel Area"]
    },
    {
      "name": "Banking",
      "tasks": ["Payment Method"]
    }
  ]
}
```

**Why database instead of hardcoded:**
- Customers can add their own categories
- Modules can be reorganized per customer
- Admin UI can reorder without code changes

---

### 5. In-Memory Sessions + Optional Persistence

**Session Storage:**
```python
class GenericModuleRunner:
    _sessions: Dict[str, SessionState] = {}  # In-memory

    def start_session(self, ...):
        session = SessionState(...)
        self._sessions[session.id] = session
        return session
```

**Why in-memory:**
- Fast (no database round-trips during Q&A)
- Simple (no session table schema to manage)
- Sufficient (sessions are short-lived)

**Persistence option:**
- Can optionally save to `sessions` table for recovery
- Used for long-running or interrupted sessions

**Trade-off:** Sessions lost on server restart (acceptable for now)

---

### 6. Backward Compatibility

**Legacy endpoints still work:**
```
POST /api/start    → Uses LangGraph master_graph
POST /api/answer   → Uses LangGraph graphs
```

**Legacy file paths supported:**
```
config/questions_current.json     → Payroll area (old path)
data/payment_method_questions.json → Payment methods (old path)

Both automatically mapped to new structure
```

**Legacy question format:**
```json
// Old format
{"id": "opt1", "label": "Option 1"}

// New format
{"value": "opt1", "label": "Option 1"}

// QuestionOption auto-converts id → value
```

---

## Current State vs What's Being Built

### Implemented (this branch)

| Feature | Status | Notes |
|---------|--------|-------|
| **GenericModuleRunner** | ✅ Complete | Runs any module from JSON |
| **ModuleService** | ✅ Complete | Full CRUD for modules |
| **QuestionService** | ✅ Complete | Full CRUD for questions |
| **ConfigStore abstraction** | ✅ Complete | Local FS, S3-ready |
| **Admin ModulesPage** | ✅ Complete | Create/edit/delete modules |
| **Admin ModuleEditorPage** | ✅ Complete | Question editor with reorder |
| **Hierarchy management** | ✅ Complete | Categories/tasks in DB |
| **showIf conditions** | ✅ Complete | equals, contains, notEquals |
| **Legacy compatibility** | ✅ Complete | Old endpoints still work |

### In Progress / Planned

| Feature | Status | Notes |
|---------|--------|-------|
| **Output mappings** | 🔄 Partial | Question → export file mapping |
| **Complex conditions** | 📋 Planned | AND/OR logic in showIf |
| **Module versioning** | 📋 Planned | Track question changes |
| **Session persistence** | 📋 Planned | Save to DB for recovery |
| **S3 ConfigStore** | 📋 Planned | Production storage |

---

## Architecture Evolution

```
PHASE 1 (pre-stage)              PHASE 2 (This Branch)           PHASE 3 (Future)
───────────────────              ─────────────────────           ────────────────
• Hardcoded module graphs        • Generic module runner          • AI-assisted answers
• 2 modules (payroll, payment)   • Unlimited modules              • Natural language input
• No admin module UI             • Full admin CRUD                • Complex conditions
• Questions in Python            • Questions in JSON              • Module versioning
• Legacy file paths              • ConfigStore abstraction        • S3 production storage
```

---

## Deployment Model

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Elastic Beanstalk                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐         ┌─────────────────────────┐   │
│   │   Frontend      │         │       Backend           │   │
│   │   (Static)      │  ────►  │   (Python/Gunicorn)     │   │
│   │                 │         │                         │   │
│   │   Vite build    │         │   FastAPI               │   │
│   │   served via    │         │   + GenericModuleRunner │   │
│   │   nginx/CDN     │         │   + ConfigStore         │   │
│   └─────────────────┘         │                         │   │
│                               │   SQLite (local file)   │   │
│                               │   JSON configs (local)  │   │
│                               └─────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Current:** Single-server with local files
**Future:** PostgreSQL + S3 for production scale

---

## Summary for Stakeholders

**TurboSAP is a guided configuration tool that:**

1. **Replaces manual SAP discovery** with structured Q&A flows
2. **Is now fully config-driven** - admins create modules without developers
3. **Uses a generic execution engine** - one codebase runs any module
4. **Deploys per-customer** for isolation and customization
5. **Generates SAP-ready files** automatically

**What changed in this branch:**

| Before | After |
|--------|-------|
| 2 hardcoded modules | Unlimited modules via admin UI |
| Developers edit Python | Admins edit JSON in browser |
| Module-specific code | Single generic runner |
| Fixed question logic | Configurable showIf conditions |

**Key technical choices:**

- **Generic module execution** - Any module runs from JSON config
- **ConfigStore abstraction** - Local files now, S3-ready for production
- **Service layer pattern** - Clean separation of concerns
- **Backward compatibility** - Legacy endpoints and formats still work
- **Single-instance deployment** - Strong data isolation per customer

**What makes it powerful:**

- **No-code module creation** - Admins build new config wizards themselves
- **Instant updates** - Question changes take effect immediately
- **Conditional logic** - Questions appear based on previous answers
- **Scalable architecture** - Ready for cloud storage and more modules
