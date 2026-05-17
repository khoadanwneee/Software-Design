# UniHub Workshop

UniHub Workshop is a TypeScript monorepo scaffold for the workshop registration, payment, admin, and offline check-in system described in `blueprint/`.

The repo currently uses `blueprint/` as the source of truth rather than `blueprints/`.

## Why Mobile + Web

UniHub needs a student-facing surface, an organizer/admin web app, and a phone-first check-in experience. The current setup uses:

- a React web app for admin/organizer and student flows;
- a React Native (Expo) mobile app optimized for check-in.

This keeps the admin experience on the web while providing a dedicated mobile workflow for scanning and on-site operations.

## Architecture

- `apps/web`: React + Vite web app (admin/organizer/student).
- `apps/mobile`: Expo + React Native check-in app.
- `apps/api`: Node.js + Express REST API.
- `apps/worker`: BullMQ workers for notification, payment reconciliation, AI summary, CSV import, and check-in maintenance.
- `packages/db`: Prisma schema, migration, seed, and Prisma client export.
- `packages/shared-types`: shared DTOs/enums.
- `packages/shared-utils`: error codes, date helpers, QR/idempotency helpers.
- `packages/api-client`: fetch wrapper and typed API methods.
- `infra/compose.yaml`: PostgreSQL, Redis, Mailpit.

PostgreSQL is the source of truth for registrations, payment state, QR/check-in uniqueness, import logs, and audit logs. Redis backs rate limits and BullMQ queues.

## Tech Stack

- Frontend (web): React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod.
- Frontend (mobile): Expo, React Native, TypeScript, `expo-camera`.
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
│   ├── mobile/
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

Redis must be running for BullMQ workers, notification jobs, rate-limit state, and realtime seat SSE/pub-sub. If Redis is offline, the API can still boot for basic read-only development, but Redis-backed features are degraded and worker jobs will not run.

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
pnpm --filter @unihub/mobile dev
```

Default URLs:

- Web app: `http://localhost:5173`
- Web app: `http://192.168.1.5:5173`
- API: `http://192.168.1.5:4000/api`
- API docs: `http://192.168.1.5:4000/docs`
- Health: `http://192.168.1.5:4000/health`
- Mailpit: `http://localhost:8025`
- Mobile: Expo dev server opens in the terminal when running `pnpm --filter @unihub/mobile dev`.

## Run AI Summary Locally

AI summary is asynchronous:

1. The web app uploads a workshop PDF to the API.
2. The API stores the PDF and creates an `ai-summary` BullMQ job in Redis.
3. The worker extracts text from the PDF.
4. The worker calls the configured AI summary endpoint through `NGROK_AI_SUMMARY_URL`.
5. The worker saves the final summary back to PostgreSQL.

For local development, the repo includes a small dev AI service at `POST /summarize`.
It returns a deterministic summary in the same JSON shape expected by the worker.

### AI environment

Use these values in `.env`:

```env
REDIS_URL=redis://127.0.0.1:6379

AI_PROVIDER=ngrok
NGROK_AI_SUMMARY_URL=https://your-ngrok-domain.ngrok-free.app/summarize
NGROK_AI_SUMMARY_API_KEY=
NGROK_AI_SUMMARY_MODEL=ngrok-ai-summary
AI_SUMMARY_PDF_MAX_MB=10
AI_SUMMARY_TIMEOUT_MS=30000
AI_SUMMARY_MAX_INPUT_CHARS=30000
AI_SUMMARY_MAX_OUTPUT_WORDS=250
```

`NGROK_AI_SUMMARY_API_KEY` is optional. Leave it empty when using the built-in dev AI service without auth.

If ngrok generates a new public URL, update `NGROK_AI_SUMMARY_URL` and restart the worker.

### Terminal order

Run these in separate terminals from the repo root.

Terminal 1: infrastructure:

```sh
pnpm compose:up
```

If Docker reports a container-name conflict but the containers already exist, start them directly:

```sh
docker start unihub-postgres unihub-redis unihub-mailpit
docker compose -f infra/compose.yaml ps
```

Terminal 2: local AI summary service:

```sh
pnpm ai-summary:dev-server
```

Expected output:

```text
Dev AI summary server listening on http://127.0.0.1:8000/summarize
```

Terminal 3: ngrok tunnel:

```sh
ngrok http http://127.0.0.1:8000
```

Copy the HTTPS forwarding URL and set `.env` like this:

```env
NGROK_AI_SUMMARY_URL=https://your-ngrok-domain.ngrok-free.app/summarize
```

Terminal 4: API:

```sh
pnpm --filter @unihub/api dev
```

Terminal 5: worker:

```sh
pnpm --filter @unihub/worker dev
```

Terminal 6: web:

```sh
pnpm --filter @unihub/web dev
```

### Test the AI service

Test the local service first:

```powershell
$body = @{
  title = "AI Summary Test"
  description = "Local AI summary smoke test."
  pdfText = "Workshop helps students prepare CVs, practice interviews, build portfolios, and use AI for career planning."
  language = "vi"
  prompt = "Summarize the workshop in Vietnamese."
  maxOutputWords = 250
} | ConvertTo-Json -Depth 5

Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://127.0.0.1:8000/summarize" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Expected response:

```json
{
  "model": "dev-ai-summary-server",
  "summary": "..."
}
```

Then test the public ngrok URL:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "https://your-ngrok-domain.ngrok-free.app/summarize" `
  -Method Post `
  -Headers @{ "ngrok-skip-browser-warning" = "true" } `
  -ContentType "application/json" `
  -Body $body
```

### Upload a PDF

1. Login as `organizer@unihub.local` or `admin@unihub.local`.
2. Open `/admin/ai-summary`.
3. Select a workshop and upload a PDF.
4. The page shows a processing message and polls `GET /api/ai-summary/:id`.
5. When the worker finishes, the page shows the formatted AI summary.

Workshops with completed summaries are also marked with an AI summary badge in:

- `/workshops`
- `/workshops/:id`
- `/admin/workshops`

### Troubleshooting AI summary

Check Redis:

```sh
docker exec unihub-redis redis-cli ping
```

Expected:

```text
PONG
```

Check API health:

```sh
curl http://localhost:4000/health
curl http://localhost:4000/health/redis
curl http://localhost:4000/health/db
```

Check the local AI service:

```sh
curl -X POST http://127.0.0.1:8000/summarize \
  -H "content-type: application/json" \
  -d '{"title":"Ping","pdfText":"hello","language":"vi"}'
```

`ERR_NGROK_8012` or `502 Bad Gateway` means ngrok is running, but nothing is listening behind it at `127.0.0.1:8000`. Start `pnpm ai-summary:dev-server` and run ngrok again.

If an AI summary stays `PENDING`, check that the worker is running:

```sh
pnpm --filter @unihub/worker dev
```

After changing `.env`, always restart the worker because it reads `NGROK_AI_SUMMARY_URL` only at startup.

## Demo Accounts

Student accounts (from `tmp/student-csv/students_valid.csv`) use password format `KHTN@` + last 2 digits of student code.

| Role | Email | Password |
|---|---|---|
| STUDENT | `sv202610@unihub.local` | `KHTN@10` |
| STUDENT | `sv202611@unihub.local` | `KHTN@11` |
| STUDENT | `sv202612@unihub.local` | `KHTN@12` |

## Mobile Setup

1. Install Expo Go on your phone (iOS/Android).
2. Run `pnpm --filter @unihub/mobile dev`.
3. Scan the QR code shown in the terminal to open the app.

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
- Realtime seat updates use SSE over Redis pub/sub with short-polling fallback in the web app.
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
