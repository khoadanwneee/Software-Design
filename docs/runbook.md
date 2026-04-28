# UniHub Workshop Runbook

## Local Startup

1. Enable pnpm via Corepack if needed:

```sh
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

2. Install dependencies:

```sh
pnpm install
```

3. Create local env:

```sh
cp .env.example .env
```

4. Start infrastructure:

```sh
docker compose -f infra/compose.yaml up -d
```

5. Generate Prisma client, migrate, and seed:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

6. Run services in separate terminals:

```sh
pnpm --filter @unihub/api dev
pnpm --filter @unihub/worker dev
pnpm --filter @unihub/web dev
```

## Health Checks

```sh
curl http://localhost:4000/health
curl http://localhost:4000/health/db
curl http://localhost:4000/health/redis
```

## Payment Mock Webhook

After creating a paid registration, copy `providerOrderId` from the database or API logs and call:

```sh
curl -X POST http://localhost:4000/api/payments/webhook/mock \
  -H "Content-Type: application/json" \
  -d '{"signature":"unihub-dev-signature","providerOrderId":"mock_order_REGISTRATION_ID","providerTransactionId":"txn_001","status":"success"}'
```

## Offline Check-in

1. Login as `staff@unihub.local`.
2. Open `/checkin`.
3. Turn off network in browser devtools or device settings.
4. Scan or paste a QR payload.
5. Open `/checkin/queue` and verify a `PENDING` IndexedDB record.
6. Restore network and press retry or wait for the `online` event.

## Rate Limit Tuning

Change these environment variables in `.env`:

- `RATE_LIMIT_DEFAULT_POINTS`
- `RATE_LIMIT_DEFAULT_DURATION_SECONDS`
- `RATE_LIMIT_REGISTRATION_POINTS`
- `RATE_LIMIT_PAYMENT_POINTS`
- `RATE_LIMIT_CHECKIN_SYNC_POINTS`

The middleware is in `apps/api/src/common/middleware/rate-limit.ts`.
