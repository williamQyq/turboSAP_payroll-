# TurboSAP Architecture Overview

> High-level system architecture for technical stakeholders
> **Branch:** `pre-stage`

---

## What Problem Does TurboSAP Solve?

**The Challenge:** Configuring SAP HCM (Human Capital Management) is notoriously complex. Setting up payroll areas, payment methods, company codes, and organizational structures requires deep SAP expertise and typically takes consultants weeks of discovery sessions with clients.

**Our Solution:** TurboSAP replaces that manual discovery process with a guided, conversational Q&A flow. Instead of consultants asking open-ended questions and interpreting answers, the system:

1. Asks structured questions in plain English
2. Applies business logic to determine follow-up questions
3. Generates SAP-ready configuration files automatically

**The Value:** A client HR administrator who knows nothing about SAP can answer questions about their payroll frequencies, business units, and payment methods—and get exportable SAP configuration tables at the end.

---

## Core User Flow

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
│      • "Do different business units need separate payroll areas?" → Yes  │
│      ↓                                                                   │
│   4. SYSTEM GENERATES CONFIGURATION                                      │
│      • Payroll Area PA01: Weekly Mon-Sun Friday - HQ                     │
│      • Payroll Area PA02: Weekly Mon-Sun Friday - West Region            │
│      • Payroll Area PA03: Biweekly Sun-Sat Thursday - All Units          │
│      ↓                                                                   │
│   5. EXPORT SAP FILES                                                    │
│      • T549A.csv (Payroll Areas)                                         │
│      • T549Q.csv (Payroll Calendars)                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Admin Journey:** Administrators configure the questions themselves, adjust conditional logic, and manage users—without touching code.

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
│  │  • Auth UI          │  JSON   │  ┌─────────────────────────────┐    │   │
│  │  • Q&A Interface    │         │  │       API LAYER             │    │   │
│  │  • Admin Console    │         │  │  Routes + Middleware        │    │   │
│  │  • Export Center    │         │  └──────────────┬──────────────┘    │   │
│  │                     │         │                 │                    │   │
│  │  State: Zustand     │         │  ┌──────────────▼──────────────┐    │   │
│  │  (localStorage)     │         │  │      SERVICE LAYER          │    │   │
│  └─────────────────────┘         │  │  Business Logic + CRUD      │    │   │
│                                  │  └──────────────┬──────────────┘    │   │
│                                  │                 │                    │   │
│                                  │  ┌──────────────▼──────────────┐    │   │
│                                  │  │       LANGGRAPH             │    │   │
│                                  │  │  Conversation Orchestration │    │   │
│                                  │  │  (State Machine)            │    │   │
│                                  │  └──────────────┬──────────────┘    │   │
│                                  │                 │                    │   │
│                                  │  ┌──────────────▼──────────────┐    │   │
│                                  │  │      DATA LAYER             │    │   │
│                                  │  │  SQLite + JSON Config       │    │   │
│                                  │  └─────────────────────────────┘    │   │
│                                  └─────────────────────────────────────┘   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Frontend** | React 19, TypeScript, Vite | UI rendering, client-side state, API calls |
| **API Layer** | FastAPI | HTTP endpoints, auth middleware, request validation |
| **Service Layer** | Python classes | Business logic, CRUD operations, file abstraction |
| **LangGraph** | LangGraph (Anthropic) | Stateful conversation flow, question routing |
| **Database** | SQLite | Users, sessions, hierarchy (categories/tasks) |
| **Config Store** | JSON files | Module definitions, questions, output mappings |

---

## Data Flow

### 1. Session Start → First Question

```
User clicks "Start Payroll Configuration"
         │
         ▼
┌─────────────────┐     POST /api/modules/payroll-area/sessions
│    Frontend     │ ─────────────────────────────────────────────►
└─────────────────┘
                        │
                        ▼
                  ┌─────────────────┐
                  │   API Router    │  Validate auth, route request
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Module Runner   │  Load module config + questions
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   LangGraph     │  Initialize session state
                  │   (or simple    │  Determine first question
                  │    runner)      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Config Store   │  Read questions.json
                  └────────┬────────┘
                           │
◄──────────────────────────┘
{sessionId: "abc123", question: {id: "q1_frequencies", text: "What pay frequencies..."}}
```

### 2. Answer Submission → Next Question (or Completion)

```
User selects "Weekly" and "Biweekly"
         │
         ▼
┌─────────────────┐     POST /api/modules/.../sessions/abc123/answer
│    Frontend     │ ─────────────────────────────────────────────────►
└─────────────────┘     {questionId: "q1_frequencies", answer: ["weekly", "biweekly"]}
                        │
                        ▼
                  ┌─────────────────┐
                  │ Module Runner   │  Store answer in session
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   LangGraph     │  Evaluate conditional logic:
                  │                 │  - User selected "weekly"
                  │                 │  - Next: q1_weekly_pattern
                  │                 │  (showIf: frequencies contains "weekly")
                  └────────┬────────┘
                           │
◄──────────────────────────┘
{done: false, progress: 15, nextQuestion: {id: "q1_weekly_pattern", ...}}


        ... (repeat for all questions) ...


When all questions answered:
                           │
                           ▼
                  ┌─────────────────┐
                  │   LangGraph     │  No more applicable questions
                  │                 │  → Generate payroll areas
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │Output Generator │  Apply output mappings
                  │                 │  Transform answers → SAP format
                  └────────┬────────┘
                           │
◄──────────────────────────┘
{done: true, payrollAreas: [{code: "PA01", description: "Weekly Mon-Sun Friday - HQ", ...}]}
```

### 3. Export Generation

```
User clicks "Export to SAP"
         │
         ▼
┌─────────────────┐     GET /api/modules/.../sessions/abc123/output
│    Frontend     │ ─────────────────────────────────────────────────►
└─────────────────┘
                        │
                        ▼
                  ┌─────────────────┐
                  │Output Generator │  Read session answers
                  │                 │  Apply output mappings from config
                  │                 │  Generate T549A, T549Q content
                  └────────┬────────┘
                           │
◄──────────────────────────┘
{files: [
  {name: "T549A.csv", format: "csv", content: "ABKRS,APTS,...\nPA01,01,..."},
  {name: "T549Q.csv", format: "csv", content: "..."}
]}
```

---

## Key Architectural Decisions

### 1. LangGraph for Conversation Flow

**What:** We use LangGraph (from Anthropic/LangChain) as a state machine to orchestrate the Q&A flow.

**Why:**
- Questions aren't linear—they branch based on previous answers
- Example: "Do you use weekly payroll?" → Yes → "What period pattern for weekly?" → "What pay day?"
- LangGraph manages this conditional routing + session state persistence

**How it works:**
```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
              ┌────►│   ROUTER    │◄────┐
              │     │   NODE      │     │
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────┴──────┐     │
              │     │             │     │
              │     ▼             ▼     │
              │  [Next Q]    [Complete] │
              │     │             │     │
              │     │             ▼     │
              │     │      ┌──────────┐ │
              │     │      │ GENERATE │ │
              │     │      │ OUTPUT   │ │
              │     │      └────┬─────┘ │
              │     │           │       │
              └─────┘           ▼       │
                           ┌────────┐   │
                           │  END   │───┘
                           └────────┘
```

**Current Structure:**
- **Master Graph** → Routes between modules (Payroll → Payment → ...)
- **Module Graphs** → Handle specific Q&A (payroll_area_graph, payment_method_graph)

### 2. Config-Driven vs Code-Defined

**Decision:** Questions and conditional logic are defined in JSON configuration files, not hardcoded.

**Structure:**
```json
{
  "questions": [
    {
      "id": "q1_frequencies",
      "text": "What pay frequencies does your organization use?",
      "type": "multiple_select",
      "options": [
        {"value": "weekly", "label": "Weekly"},
        {"value": "biweekly", "label": "Bi-weekly"}
      ]
    },
    {
      "id": "q1_weekly_pattern",
      "text": "For WEEKLY payroll, what period pattern?",
      "type": "multiple_choice",
      "showIf": {
        "questionId": "q1_frequencies",
        "operator": "contains",
        "value": "weekly"
      },
      "options": [...]
    }
  ]
}
```

**Benefits:**
- Admins can modify questions without deploying code
- Hot-reload: changes take effect immediately
- A/B testing different question flows
- Client-specific customization

**Trade-off:** Complex conditional logic is harder to express in JSON than code. Currently supported operators: `equals`, `contains`, `not_equals`.

### 3. Single-Instance Deployment (No Multi-Tenancy)

**Decision:** Each customer gets their own isolated instance of TurboSAP.

**What this means:**
- Separate database per customer
- Separate configuration files
- No `tenant_id` columns or cross-customer data concerns
- Admin role = full access to that instance only

**Why:**
- Simpler security model (no data leakage risk)
- Customers can customize questions without affecting others
- Easier compliance (data residency, audit trails)
- Matches SAP implementation model (each company = separate SAP instance)

**Trade-off:** More infrastructure to manage at scale (solved via containerization).

### 4. Authentication Model

**Structure:**
```
┌──────────────┐     ┌──────────────┐
│    CLIENT    │     │    ADMIN     │
│    ROLE      │     │    ROLE      │
├──────────────┤     ├──────────────┤
│ • Dashboard  │     │ • All client │
│ • Run modules│     │   features   │
│ • View own   │     │ • User mgmt  │
│   sessions   │     │ • Edit       │
│ • Export     │     │   questions  │
│   results    │     │ • System     │
│              │     │   settings   │
└──────────────┘     └──────────────┘
```

**Implementation:**
- JWT tokens (7-day expiry)
- bcrypt password hashing
- Middleware-based route protection
- No OAuth/SSO currently (future consideration)

### 5. Hybrid Storage Model

| Data Type | Storage | Reason |
|-----------|---------|--------|
| Users, Sessions | SQLite | Relational, queryable, ACID |
| Module configs, Questions | JSON files | Hot-reload, version-controllable, human-editable |
| Session state (in-flight) | In-memory (LangGraph) | Performance, no persistence needed mid-session |

**ConfigStore Abstraction:** The JSON file access is wrapped in an abstract `ConfigStore` class, making it easy to swap filesystem for S3 or database storage later.

---

## Current State vs What's Being Built

### What Exists (pre-stage branch)

| Feature | Status | Notes |
|---------|--------|-------|
| **Auth system** | ✅ Complete | Login, JWT, role-based access |
| **User dashboard** | ✅ Complete | Session history, quick links |
| **Payroll Area module** | ✅ Complete | Full Q&A flow with LangGraph |
| **Payment Method module** | ✅ Complete | Full Q&A flow |
| **Admin user management** | ✅ Complete | Create, delete, reset password |
| **Admin question editor** | ✅ Complete | CRUD questions, conditional logic |
| **Generic module runner** | ✅ Complete | Config-driven module execution |
| **Export to SAP format** | ✅ Complete | T549A, T549Q generation |
| **Hierarchy management** | ✅ Complete | Categories/tasks (SAP roadmap) |

### What's In Progress / Planned

| Feature | Status | Notes |
|---------|--------|-------|
| **Additional modules** | 🔄 Scaffolded | Tax, Benefits, Time Management |
| **Knowledge base** | 🔄 Partial | Document upload exists, AI integration pending |
| **AI assistant** | 🔄 Partial | Config page exists, not connected |
| **Multi-module orchestration** | ✅ Exists | Master graph routes between modules |
| **Session resume** | ✅ Exists | Can resume interrupted sessions |

### Architecture Evolution

```
PHASE 1 (Done)                    PHASE 2 (Current)              PHASE 3 (Future)
─────────────────                 ──────────────────              ────────────────
• Hardcoded payroll               • Config-driven modules         • AI-assisted answers
  questions                       • Admin question editor         • Natural language input
• Single module                   • Multiple modules              • Cross-module dependencies
• Manual export                   • Generic module runner         • Direct SAP integration
• No auth                         • Full auth + admin             • SSO/OAuth
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
│   │   Vite build    │         │   FastAPI + LangGraph   │   │
│   │   served via    │         │                         │   │
│   │   nginx/CDN     │         │   SQLite (local file)   │   │
│   └─────────────────┘         │   JSON configs          │   │
│                               └─────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Current:** Single-server deployment with SQLite
**Future consideration:** PostgreSQL for multi-instance, S3 for config storage

---

## Summary for Stakeholders

**TurboSAP is a guided configuration tool that:**

1. **Replaces manual SAP discovery** with structured Q&A flows
2. **Uses LangGraph** for intelligent question routing (conditional, branching conversations)
3. **Is config-driven** so admins can modify questions without code changes
4. **Deploys per-customer** for isolation and customization
5. **Generates SAP-ready files** (T549A, T549Q, etc.) automatically

**Key technical choices:**
- React + FastAPI + SQLite (simple, proven stack)
- LangGraph for conversation state management
- JSON-based module configuration with hot-reload
- JWT auth with role-based access control
- Abstract storage layer (ready for S3/cloud migration)

**What makes it different from a simple form wizard:**
- Conditional question logic (answers determine next questions)
- Combinatorial output generation (frequencies × business units × regions)
- Session persistence (resume interrupted configurations)
- Admin-editable without deployment
