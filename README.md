# UniHub Workshop

UniHub Workshop is a TypeScript monorepo scaffold for the workshop registration, payment, admin, and offline check-in system described in `blueprint/`.

The repo currently uses `blueprint/` as the source of truth rather than `blueprints/`.

## Why PWA Instead Of React Native

UniHub needs a student web app, an organizer/admin web app, and a phone-friendly check-in interface. A React PWA keeps those surfaces in one deployable client-side app:

- runs on desktop and mobile browsers;
- can be installed to the home screen;
- can use the camera through the browser for QR scanning;
- can persist offline check-ins in IndexedDB;
- can sync pending check-ins when the network returns.

This avoids a separate React Native app while still supporting the mobile check-in workflow required by the blueprint.

## Architecture

- `apps/web`: React + Vite client-side PWA.
- `apps/api`: Node.js + Express REST API.
- `apps/worker`: BullMQ workers for notification, payment reconciliation, AI summary, CSV import, and check-in maintenance.
- `packages/db`: Prisma schema, migration, seed, and Prisma client export.
- `packages/shared-types`: shared DTOs/enums.
- `packages/shared-utils`: error codes, date helpers, QR/idempotency helpers.
- `packages/api-client`: fetch wrapper and typed API methods.
- `infra/compose.yaml`: PostgreSQL, Redis, Mailpit.

PostgreSQL is the source of truth for registrations, payment state, QR/check-in uniqueness, import logs, and audit logs. Redis backs rate limits and BullMQ queues.

## Tech Stack

- Frontend: React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Dexie, `html5-qrcode`.
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis, Zod, JWT, Helmet, CORS, Swagger.
- Worker: BullMQ on Redis.
- Local development: Docker Compose.
- Package manager: pnpm workspace.

## Directory Structure

```text
.
├── blueprint/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   ├── api-client/
│   └── db/
├── infra/
├── docs/
├── .github/workflows/ci.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── .env.example
```

## Local Development

If `pnpm` is not installed:

```sh
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

Install dependencies:

```sh
pnpm install
```

Copy env:

```sh
cp .env.example .env
```

Start infrastructure:

```sh
docker compose -f infra/compose.yaml up -d
```

Run Prisma:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Run services:

```sh
pnpm --filter @unihub/api dev
pnpm --filter @unihub/worker dev
pnpm --filter @unihub/web dev
```

Default URLs:

- Web PWA: `http://localhost:5173`
- API: `http://localhost:4000/api`
- API docs: `http://localhost:4000/docs`
- Health: `http://localhost:4000/health`
- Mailpit: `http://localhost:8025`

## Demo Accounts

All seed accounts use password `password123`.

| Role | Email |
|---|---|
| ADMIN | `admin@unihub.local` |
| ORGANIZER | `organizer@unihub.local` |
| CHECKIN_STAFF | `staff@unihub.local` |
| STUDENT | `student1@unihub.local` |
| STUDENT | `student2@unihub.local` |
| STUDENT | `student3@unihub.local` |
| STUDENT | `student4@unihub.local` |

## PWA Install

On Android Chrome or desktop Chrome/Edge, open `http://localhost:5173`, then use the browser install button. On iOS Safari, use Share → Add to Home Screen. Camera QR scanning requires HTTPS in production; localhost is allowed by browsers for development.

## Flow Tests

Student:

1. Login as `student1@unihub.local`.
2. Open `/workshops`.
3. Open a free workshop and register.
4. Open the QR page.
5. Open a paid workshop and create a mock payment.

Payment mock:

1. Create a paid registration.
2. Trigger `POST /api/payments/webhook/mock` with `signature=unihub-dev-signature`, a matching `providerOrderId`, a unique `providerTransactionId`, and `status=success`.
3. Refresh the registration QR route after webhook success.

Check-in:

1. Login as `staff@unihub.local`.
2. Open `/checkin`.
3. Select a workshop.
4. Scan or paste a QR payload.
5. Turn network off and scan again to create an IndexedDB queue item.
6. Open `/checkin/queue`.
7. Turn network on and press retry.

Admin:

1. Login as `organizer@unihub.local`.
2. Open `/admin/workshops`.
3. Create/edit/cancel a workshop.
4. Open `/admin/statistics`.
5. Open `/admin/ai-summary` and choose a PDF file to create an AI summary job.
6. Call `POST /api/student-import/jobs` with CSV text to create an import job.

## Tests

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database-backed test cases are scaffolded in `apps/api/tests/integration-blueprint-flows.test.ts` and are marked skipped until a test database lifecycle is wired into CI.

## Implemented

- pnpm monorepo and Turbo tasks.
- React client-side PWA with manifest, service worker, offline fallback, app-shell caching, and API response no-store behavior.
- IndexedDB check-in queue with `PENDING`, `SYNCED`, `FAILED`, `DUPLICATE`, `CONFLICT` statuses and retry cap.
- Express API with JWT auth, RBAC, Zod validation, centralized errors, Helmet, CORS, logging, Swagger.
- Redis-backed rate limits with endpoint-specific registration/payment/check-in sync policies.
- Prisma schema, migration, and seed data.
- PostgreSQL atomic seat reservation for registration.
- Payment idempotency, mock provider, webhook, and circuit breaker.
- BullMQ workers with retry/backoff and mock providers.
- CSV import worker with row validation and upsert.

## Known Limitations

- Binary PDF storage is represented by metadata and a local storage key; object storage/multipart upload is not fully implemented.
- The UI is functional scaffold quality, not final product design.
- Payment provider and AI provider are mocks.
- Staff-to-workshop assignment is not modeled yet.
- Realtime seat updates use refetch/polling-ready structure rather than SSE/WebSocket.
- Test database lifecycle is not wired into CI.

## ASSUMPTION

- BullMQ on Redis is the required job queue implementation.
- One React PWA contains student, admin, and check-in routes.
- Seed data uses future workshop dates relative to the current project date.
- QR payload uses an opaque random token and does not include student email/MSSV.

## UNSPECIFIED BY BLUEPRINT

- Exact visual design system.
- Exact payment gateway provider, webhook signature format, and refund behavior.
- Exact AI provider/model/prompt and PDF extraction implementation.
- Exact CSV quoting/escaping rules beyond required columns.
- Exact refresh token/session refresh policy.
- Exact check-in staff assignment policy per room/workshop.
