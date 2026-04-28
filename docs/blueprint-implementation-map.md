# Blueprint Implementation Map

Source of truth: repo uses `blueprint/` rather than `blueprints/`.

| Blueprint file | Requirement | Code module |
|---|---|---|
| `blueprint/proposal.md` | Client-server architecture, student web, admin web, check-in mobile-first experience | `apps/web`, `apps/api`, `apps/worker` |
| `blueprint/proposal.md` | PostgreSQL transaction source of truth, Redis rate limit/cache/idempotency, async queue | `packages/db/prisma/schema.prisma`, `apps/api/src/common/middleware/rate-limit.ts`, `apps/worker/src/main.ts` |
| `blueprint/design.md` | Backend API REST, RBAC, validation, audit log, central error handling | `apps/api/src/app.ts`, `apps/api/src/common`, `apps/api/src/modules/auth`, `apps/api/src/modules/users` |
| `blueprint/design.md` | Worker service for notification, AI, CSV import, payment reconciliation | `apps/worker/src/processors`, `apps/worker/src/providers`, `apps/worker/src/queues.ts` |
| `blueprint/design.md` | Database schema for users/workshops/registrations/payments/QR/check-ins/import/audit | `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260428000000_init/migration.sql` |
| `blueprint/tasks.md` | Monorepo foundation and shared packages | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/shared-types`, `packages/shared-utils`, `packages/api-client`, `packages/db` |
| `blueprint/specs/auth.md` | Demo login, JWT access token, RBAC roles, 401/403 handling, role change audit | `apps/api/src/modules/auth`, `apps/api/src/modules/users`, `apps/web/src/components/RoleGuard.tsx`, `apps/web/src/features/auth` |
| `blueprint/specs/workshop.md` | List/detail workshops, CRUD, room/time validation, capacity validation, cancel, notification event | `apps/api/src/modules/workshops`, `apps/api/src/modules/rooms`, `apps/web/src/features/workshops`, `apps/web/src/features/admin` |
| `blueprint/specs/registration.md` | Free registration, idempotency key, unique student/workshop registration, PostgreSQL atomic seat update, QR generation | `apps/api/src/modules/registrations`, `apps/api/src/common/utils/idempotency.ts`, `apps/api/src/common/utils/qr-token.ts`, `packages/db/prisma/schema.prisma` |
| `blueprint/specs/payment.md` | Paid registration, payment idempotency, mock provider, webhook callback audit, circuit breaker, degraded mode | `apps/api/src/modules/payments`, `apps/api/src/modules/registrations/registration.service.ts`, `packages/db/prisma/schema.prisma`, `apps/worker/src/processors/payment.processor.ts`, `apps/worker/src/providers/payment.provider.ts` |
| `blueprint/specs/checkin.md` | QR validation, online check-in, offline IndexedDB queue, batch sync, idempotent `clientCheckinId`, duplicate/conflict statuses | `apps/api/src/modules/checkins`, `apps/web/src/features/checkin`, `apps/web/src/features/offline`, `apps/worker/src/processors/checkin-sync.processor.ts` |
| `blueprint/specs/notification.md` | Notification abstraction, in-app notification, email mock provider, retry/backoff, dedupe key | `apps/api/src/modules/notifications`, `apps/worker/src/processors/notification.processor.ts`, `apps/worker/src/providers/email.provider.ts` |
| `blueprint/specs/ai-summary.md` | PDF metadata upload, AI summary status lifecycle, async worker, mock AI provider | `apps/api/src/modules/ai-summary`, `apps/worker/src/processors/ai-summary.processor.ts`, `apps/worker/src/providers/ai-summary.provider.ts`, `apps/web/src/features/ai-summary` |
| `blueprint/specs/student-import.md` | CSV import job, required headers, row validation, upsert student, import errors, idempotent file hash | `apps/api/src/modules/student-import`, `apps/worker/src/processors/student-import.processor.ts`, `packages/db/prisma/schema.prisma` |
| `blueprint/specs/admin.md` | Admin route guard, statistics, audit logs, import status, payment circuit visibility | `apps/api/src/modules/admin`, `apps/web/src/features/admin`, `apps/web/src/features/ai-summary` |

## ASSUMPTION

- The repo's canonical blueprint folder is `blueprint/`; no duplicate `blueprints/` folder was created.
- A single React PWA serves student, organizer/admin, and check-in staff routes. This follows the user request to avoid React Native and SSR.
- BullMQ on Redis is used as the "Message Broker / Job Queue" equivalent mentioned in the blueprint.
- PDF upload is scaffolded as metadata upload plus local storage key. Binary multipart/object storage can be added later without changing the worker contract.
- QR token is a random opaque token and contains no student email/MSSV. The scaffold stores the random token for demo QR retrieval; production can replace this with encrypted storage or one-time display.

## UNSPECIFIED BY BLUEPRINT

- Exact UI design system and visual branding.
- Exact payment gateway API, webhook signature scheme, and refund policy.
- Exact AI provider, prompt wording, model version, and PDF text extraction library.
- Exact CSV dialect beyond required headers `student_code`, `email`, `full_name`.
- Exact assignment model for which check-in staff can scan which workshop/room.
- Exact token refresh strategy; scaffold uses short-lived access token only and clears local session on 401.
