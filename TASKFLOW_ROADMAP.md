# TaskFlow — project execution plan (roadmap)

Step-by-step checklist to build the full-stack **TaskFlow** app: what to build, in what order, and which technologies to use — from backend through frontend to deployment.

---

## Phase 0 — Define the product (before code)

- [ ] Write a one-page product brief: who TaskFlow is for, core problem, and success criteria.
- [ ] List main features for v1 (e.g. tasks, lists, due dates, priorities, optional teams).
- [ ] Sketch main screens (wireframes) and a simple user flow (sign up → dashboard → create task → complete task).
- [ ] Choose **auth model** (email/password, magic link, OAuth) and **multi-tenant** approach (single user vs workspaces).

---

## Phase 1 — Backend foundation

**Suggested stack:** Node.js **20+**, **TypeScript**, **Express** or **Fastify**, **PostgreSQL**, **Prisma** ORM, **Zod** for request validation.

- [ ] Initialize repo: `server/` (or monorepo with `apps/api`).
- [ ] Add TypeScript, ESLint, Prettier, strict `tsconfig`.
- [ ] Connect **PostgreSQL** locally (Docker Compose recommended).
- [ ] Add **Prisma**: schema for `User`, `Workspace` (optional), `Task`, `TaskList` / tags as needed.
- [ ] Run first migration; seed script for local dev.
- [ ] Implement **health** route (`GET /health`).
- [ ] Central **error handler** + consistent JSON error shape.
- [ ] **Environment variables** documented (`.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`.

---

## Phase 2 — Auth & security

- [ ] **Register** + **login** (hash passwords with **bcrypt** or use **argon2**).
- [ ] Issue **JWT** (access token) or session cookies; document expiry and refresh strategy.
- [ ] **Auth middleware** protecting private routes.
- [ ] Rate limiting on auth endpoints (e.g. `@fastify/rate-limit` or `express-rate-limit`).
- [ ] HTTPS-only cookies if using cookie-based sessions.

---

## Phase 3 — TaskFlow API (core domain)

- [ ] **CRUD tasks** scoped to the authenticated user (and workspace if applicable).
- [ ] Filters: status (todo/done), list, due date range, search by title.
- [ ] Pagination or cursor-based lists for large task sets.
- [ ] Validation on all inputs (Zod); map domain errors to HTTP status codes (400/404/403).
- [ ] Optional: **audit log** or `updatedAt` for sync-friendly clients.

---

## Phase 4 — Frontend foundation

**Suggested stack:** **React 18+**, **Vite**, **TypeScript**, **TanStack Query** for server state, **React Router**, CSS **Modules** or **Tailwind CSS**.

- [ ] Initialize `client/` (or `apps/web`) with Vite + React + TS.
- [ ] Layout shell: header, main content, responsive navigation.
- [ ] API client module: `fetch` wrapper with base URL, attach JWT, handle 401 → redirect to login.
- [ ] Forms with accessible labels, loading and error states.

---

## Phase 5 — Frontend features (TaskFlow UI)

- [ ] **Auth pages:** login, register, logout.
- [ ] **Dashboard:** list tasks; empty state; loading skeletons.
- [ ] **Create / edit task** modal or page (title, description, due date, list).
- [ ] **Mark complete** / reopen; optimistic updates optional.
- [ ] **Delete** with confirmation.
- [ ] Optional: drag-and-drop reorder, filters, dark mode.

---

## Phase 6 — Integration & quality

- [ ] End-to-end happy path: register → create task → complete → refresh still shows state.
- [ ] **Unit tests** for critical server logic (auth, task rules).
- [ ] **API integration tests** (supertest) for main routes.
- [ ] **CI pipeline** (GitHub Actions): lint, typecheck, test on every push.
- [ ] README: how to run API, web, and database locally.

---

## Phase 7 — Deployment

**Typical pairing:** API on **Railway**, **Render**, or **Fly.io**; DB **managed PostgreSQL** (same provider or **Neon** / **Supabase**); frontend on **Vercel** or **Netlify**.

- [ ] Create production PostgreSQL; run migrations in CI/CD or release step.
- [ ] Deploy API; set secrets (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` pointing to web URL).
- [ ] Deploy SPA; set `VITE_API_URL` (or equivalent) to production API.
- [ ] Smoke test production: auth + tasks.
- [ ] Optional: custom domain, TLS, monitoring (Sentry), uptime check.

---

## Phase 8 — Post-v1 (backlog)

- [ ] Email verification / password reset.
- [ ] Teams, roles, invitations.
- [ ] Real-time updates (WebSockets or server-sent events).
- [ ] Mobile app or PWA offline support.

---

## Quick reference — suggested technologies

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| API          | Node.js + TypeScript + Express/Fastify          |
| Database     | PostgreSQL + Prisma                             |
| Auth         | JWT or secure sessions + bcrypt/argon2        |
| Web app      | React + Vite + TypeScript + TanStack Query      |
| Hosting API  | Railway / Render / Fly.io                       |
| Hosting DB   | Neon / Supabase / managed Postgres              |
| Hosting web  | Vercel / Netlify                                |
| CI           | GitHub Actions                                  |

Use this document as a living checklist: tick items as you complete them and adjust the stack if your team standardizes on something else (e.g. NestJS, Next.js full-stack, tRPC).
