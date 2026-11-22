# Roomies

**Fairness-driven task allocation and validation for shared living.**

Roomies helps roommates coordinate chores, split expenses, settle penalties, and keep each other accountable. Housemates assign recurring chores with proof-of-work submissions, peer voting, automatic rotation, expense ledgers, task swaps, and a leaderboard — all scoped to a **House** (shared living unit).

| Frontend | Backend | Database | Cache / Jobs |
|----------|---------|----------|--------------|
| Next.js 15 · React 19 · TanStack Query | Express 5 · TypeScript · Prisma | PostgreSQL (Neon) | Redis · BullMQ |

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Chore & task model](#chore--task-model)
- [Core flows](#core-flows)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Background jobs](#background-jobs)
- [Development](#development)
- [Testing](#testing)
- [Database migrations](#database-migrations)

---

## Features

### Houses & membership
- Create or join a house via invite code
- Admin vs member roles; soft-remove members without deleting history
- House dashboard loads house metadata, chores, and vote statuses in one request

### Chores & tasks
- **Chore** = named recurring template (e.g. “Clean the fridge”)
- **Task instance** = one rotation cycle assigned to a specific roommate
- Fair rotation engine with per-chore stats (open tasks, completion history, days since last assignment)
- Proof submission with optional image and clarification note
- Dispute / resubmit flow when voting rejects proof

### Peer voting
- Assignee excluded from voting; majority threshold based on active members
- Vote reasons stored per submission round
- Optimistic UI updates; vote statuses always fetched fresh (not cached with dashboard)

### Thread & discussion
- Unified **Thread** tab per chore: all cycles, submissions, votes, and nested comments
- Comments anchor to a specific **submission** (Reddit-style replies)

### Expenses
- Shared expenses with equal splits across active members
- Per-member settlement tracking

### Other
- Task swaps between roommates
- Penalty ledger (points + fines) from rejected/expired tasks
- House-wide chat channel
- Leaderboard by completed tasks and penalties
- Email + security-question password recovery; optional Google OAuth

---

## Architecture

High-level system diagram:

```mermaid
flowchart TB
  subgraph client [Frontend — Next.js :4000]
    Pages[App Router pages]
    RQ[TanStack Query]
    API_Client[Axios API client]
    Pages --> RQ --> API_Client
  end

  subgraph server [Backend — Express :4001]
    Routes[Module routes]
    Services[Services / business logic]
    Repos[Repositories]
    Routes --> Services --> Repos
  end

  subgraph data [Infrastructure]
    PG[(PostgreSQL / Neon)]
    Redis[(Redis / Upstash)]
    BullMQ[BullMQ workers]
    Storage[Local uploads / Cloudinary]
  end

  API_Client -->|REST + JWT| Routes
  Repos --> PG
  Services --> Redis
  BullMQ --> Redis
  BullMQ --> Services
  Services --> Storage
```

Backend follows a **modular monolith** pattern:

```mermaid
flowchart LR
  subgraph modules [Domain modules]
    auth[auth]
    house[house]
    tasks[tasks / chores]
    voting[voting]
    expenses[expenses]
    penalty[penalty]
    messages[messages]
    leaderboard[leaderboard]
  end

  subgraph shared [shared/]
    db[prisma]
    cache[redis-cache]
    jobs[BullMQ jobs]
    middleware[middleware]
  end

  modules --> shared
```

Each module typically contains:

| Layer | Responsibility |
|-------|----------------|
| `*.routes.ts` | HTTP routing, auth middleware, validation |
| `*.controller.ts` | Request/response mapping |
| `*.service.ts` | Business rules, transactions |
| `*.repository.ts` | Prisma queries |

---

## Chore & task model

Roomies separates **what** needs doing from **who does it this cycle**.

```mermaid
erDiagram
  House ||--o{ Chore : has
  Chore ||--o{ Task : instances
  Task ||--o{ TaskSubmission : submissions
  TaskSubmission ||--o{ Vote : votes
  TaskSubmission ||--o{ TaskComment : comments
  Task }o--|| User : assignedTo

  Chore {
    uuid id
    string title
    boolean isRecurring
    string cronSchedule
    int rewardPoints
  }

  Task {
    uuid id
    int cycleNumber
    string status
    datetime deadline
  }

  TaskSubmission {
    uuid id
    int attemptNumber
    string imageUrl
  }
```

| Concept | Description |
|---------|-------------|
| **Chore** | Template: title, recurring settings, reward/penalty. One per title per house. |
| **Task (instance)** | A single assignment cycle: assignee, deadline, status, submissions. |
| **Submission** | One proof attempt within an instance (attempt 1, 2, … after disputes). |
| **Vote** | Approve/reject on a specific submission; optional reject reason. |
| **Thread** | API/UI view spanning all instances and submissions for a chore. |

**List UI** shows one row per chore (active instance). Past cycles appear in the detail modal **Thread** tab — not as duplicate list rows.

---

## Core flows

### Task lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending: assign / rotate
  pending --> submitted: assignee submits proof
  submitted --> completed: majority approve
  submitted --> disputed: majority reject (retries left)
  submitted --> rejected: majority reject (no retries)
  disputed --> submitted: resubmit
  pending --> expired: deadline passed (sweeper job)
  completed --> pending: rotate next instance (recurring)
```

### Submit → vote → rotate

```mermaid
sequenceDiagram
  participant A as Assignee
  participant API as Backend
  participant V as Voters
  participant DB as PostgreSQL

  A->>API: POST /api/tasks/:id/submit (proof image)
  API->>DB: Create TaskSubmission, status=submitted
  V->>API: POST /api/tasks/:id/vote
  API->>DB: Record Vote, check majority
  alt Approved
    API->>DB: status=completed
    API->>DB: Spawn next Task instance on same Chore
  else Rejected majority
    API->>DB: status=disputed or rejected
  end
```

### Rotation engine (fairness)

When a recurring chore completes, the next instance is assigned using:

1. `SELECT FOR UPDATE` on the house row (prevents concurrent assignment races)
2. Per-member stats: open tasks, same-title open count, recent completions, days since last same-title assignment
3. Exclusion of the member who just completed (when possible)
4. Round-robin tie-breaking via `house.currentIndex`

Solo houses (one active member) auto-approve submissions without voting.

---

## Project structure

```
roomies/
├── frontend/                 # Next.js 15 app (port 4000)
│   └── src/
│       ├── app/              # App Router — (auth), (app) route groups
│       ├── components/       # Shared UI (Modal, Sidebar, Icon, …)
│       ├── hooks/            # useAuth, useHouseDashboard, useTaskPolling
│       ├── lib/              # API client, endpoints, query keys
│       └── types/            # Shared TypeScript interfaces
│
├── backend/                  # Express API (port 4001)
│   ├── prisma/
│   │   ├── schema.prisma     # Data model
│   │   └── migrations/       # SQL migrations
│   ├── scripts/
│   │   └── backfill-chores.ts
│   └── src/
│       ├── app.ts            # Server entry + route mounting
│       ├── modules/          # Domain modules (auth, house, tasks, …)
│       └── shared/           # DB, cache, jobs, middleware, utils
│
└── README.md
```

### Frontend routes (main)

| Route | Purpose |
|-------|---------|
| `/login`, `/register`, `/reset-password` | Auth |
| `/dashboard` | House list & create/join |
| `/houses/[id]` | House hub: Tasks, Chat, Expenses, Leaderboard, Swaps, Penalties |
| `/tasks` | Cross-house “my tasks” view |
| `/expenses`, `/community`, `/profile` | Global views |

### Backend route prefixes

| Prefix | Module |
|--------|--------|
| `/api/auth` | Login, register, refresh, recovery, Google OAuth |
| `/api/houses` | CRUD, join, dashboard, members |
| `/api/houses/:id/chores` | Chore list, assign |
| `/api/houses/:id/tasks` | Legacy task list, admin edit/delete |
| `/api/chores/:id/thread` | Full chore thread |
| `/api/tasks/:id` | Submit, detail, thread, comments |
| `/api/tasks/:id/vote` | Voting |
| `/api/houses/:id/expenses` | Expense ledger |
| `/api/houses/:id/messages` | House chat |
| `/api/houses/:id/swaps` | Task swaps |
| `/api/houses/:id/leaderboard` | Rankings |
| `/api/houses/:houseId/penalties` | Penalty settlement |

---

## Getting started

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** (local or [Neon](https://neon.tech))
- **Redis** (local or [Upstash](https://upstash.com)) — required for caching and background jobs

### 1. Clone and install

```bash
git clone <repo-url> roomies
cd roomies

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure backend

```bash
cd backend
cp .env.docker .env   # starting point — edit with your values
```

Minimum required in `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/roomies
DIRECT_URL=postgresql://user:pass@localhost:5432/roomies
JWT_ACCESS_SECRET=your-access-secret-min-16-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-16-chars
CORS_ORIGIN=http://localhost:4000
```

### 3. Database setup

```bash
cd backend
npx prisma migrate deploy
npx prisma generate

# If upgrading from pre-Chore schema, run the backfill once:
npx tsx scripts/backfill-chores.ts
```

### 4. Configure frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4001
```

### 5. Run development servers

Terminal 1 — API:

```bash
cd backend
npm run dev
```

Terminal 2 — UI:

```bash
cd frontend
npm run dev
```

Open [http://localhost:4000](http://localhost:4000). API health check: [http://localhost:4001/health](http://localhost:4001/health).

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (pooled) |
| `DIRECT_URL` | Yes | Direct Postgres URL for migrations |
| `JWT_ACCESS_SECRET` | Yes | Access token signing secret (≥16 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `CORS_ORIGIN` | No | Frontend origin (default `http://localhost:4000`) |
| `PORT` | No | API port (default `4001`) |
| `REDIS_URL` | No* | Redis URL for BullMQ + cache |
| `UPSTASH_REDIS_REST_URL` | No* | Upstash REST URL (cache layer) |
| `UPSTASH_REDIS_REST_TOKEN` | No* | Upstash REST token |
| `TASK_MAX_RESUBMISSIONS` | No | Max proof retries after dispute (default `3`) |
| `TASK_MAX_OPEN_PER_USER` | No | Rotation fairness cap (default `2`) |
| `CLOUDINARY_*` | No | Cloud image hosting; falls back to local `./uploads` |
| `SMTP_*` | No | Email for password reset; logs link if unset |
| `GOOGLE_CLIENT_ID` | No | Enable Google sign-in |

\* Redis is required in production for background jobs and dashboard caching. Local `REDIS_HOST` / `REDIS_PORT` work for development.

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (default `http://localhost:4001`) |

---

## API overview

### Authentication

All protected routes expect:

```
Authorization: Bearer <accessToken>
```

The frontend stores `accessToken` and `refreshToken` in `localStorage` and proactively refreshes before expiry.

### Key endpoints

```http
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh

# House
GET    /api/houses
POST   /api/houses
POST   /api/houses/join
GET    /api/houses/:id/dashboard?statusFilter=active|all

# Chores (preferred)
GET    /api/houses/:id/chores
POST   /api/houses/:id/chores/assign
GET    /api/chores/:id/thread
GET    /api/tasks/:id/thread          # resolve thread via instance id

# Task instances
GET    /api/tasks/:id
POST   /api/tasks/:id/submit            # multipart: proof, note
POST   /api/tasks/:id/vote              # { vote: "approve"|"reject", reason? }
GET    /api/tasks/:id/votes
POST   /api/tasks/:id/comments          # { body, submissionId?, parentId? }

# Expenses
GET    /api/houses/:id/expenses
POST   /api/houses/:id/expenses
POST   /api/houses/:id/expenses/splits/:splitId/settle
```

Responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { },
  "error": null
}
```

---

## Background jobs

BullMQ workers run inside the API process on startup (non-test environments):

```mermaid
flowchart LR
  subgraph queues [BullMQ queues]
    Sweeper[task-sweeper]
    Recurring[recurring-tasks]
  end

  Sweeper -->|hourly| Expire[Mark overdue tasks expired]
  Recurring -->|hourly| Rotate[Spawn missed rotation instances]
```

| Job | Schedule | Purpose |
|-----|----------|---------|
| Task sweeper | Cron (via BullMQ) | Expire `pending` tasks past deadline |
| Recurring tasks | Every hour | Safety net: rotate completed recurring chores that missed immediate spawn |

---

## Development

### Backend scripts

```bash
npm run dev              # tsx watch + prisma generate
npm run build            # compile TypeScript
npm run lint             # ESLint
npm run test             # Jest + Supertest
npm run db:migrate       # prisma migrate dev
npm run db:studio        # Prisma Studio GUI
```

### Frontend scripts

```bash
npm run dev              # Next.js on :4000
npm run build
npm run lint
```

### Code conventions

- **Validation:** Zod schemas in `*.schema.ts` files
- **Errors:** `AppError`, `NotFoundError`, `ForbiddenError` → global error handler
- **Transactions:** Rotation and voting use Prisma interactive transactions with row locks
- **Caching:** Redis read-through cache for house dashboard (chores slice); vote statuses bypass cache

---

## Testing

```bash
cd backend
npm test                 # all tests
npm run test:coverage    # with coverage report
```

Tests use `NODE_ENV=test` and a separate database configuration via `backend/src/__tests__/setup.ts`.

---

## Database migrations

Migrations live in `backend/prisma/migrations/`. Production deploy:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### Chore model migration

Migration `20260616120000_add_chores` introduces the `chores` table and links existing tasks. After deploying:

```bash
npx tsx scripts/backfill-chores.ts
```

The backfill:
- Groups tasks by rotation lineage (`spawnedFromTaskId` chains)
- Merges duplicate titles in the same house
- Creates one `Chore` per group and sets `chore_id` + `cycle_number` on each task

---

## Production notes

- Set strong `JWT_*` secrets and restrict `CORS_ORIGIN` to your frontend domain
- Use Neon pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations
- Configure Cloudinary for durable proof/receipt image storage
- Ensure Redis is reachable; workers share the API process unless you split them
- Run `npm run start:prod` in backend (build → migrate → start)

---

## License

ISC (see `backend/package.json`).

---

## Credits

UI components from third-party libraries, copied into the frontend with their notices intact (full license texts in [`frontend/THIRD_PARTY_NOTICES.md`](frontend/THIRD_PARTY_NOTICES.md)):

- **[Rare UI](https://rareui.com)** by Swami Malode — hook sidebar, rail TOC (app sidebar), task list, delete button, animated counter, duration picker and folder (`frontend/src/components/ui/rare/`).
- **[React Bits](https://reactbits.dev)** by David Haz — comet dial, glide select, status mark and bell toggle (`frontend/src/components/ui/reactbits/`).
- **[oxyn](https://oxyn.space)** by lokidotdev — dot-circle loader (`frontend/src/components/ui/oxyn/`).
