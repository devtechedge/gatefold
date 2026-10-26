# Contributing

Gatefold is a demo product. Contributions are welcome when they preserve the core invariants below.

## Invariants

1. `held + sold <= capacity` is enforced by SQL and the database.
2. Inventory decisions use the affected row count from a conditional update.
3. Confirmation, inventory movement, demo confirmation, and ticket issuance share one transaction.
4. A ticket admits one person once.
5. Reservation and ticket state is never derived from client-side values.

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
ALLOW_PROD_SEED=1 npm run db:seed
npm run dev
```

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run e2e
```

`npm run e2e` builds the application and runs browser tests against `DATABASE_URL_E2E`. Never point test or e2e URLs at a production database. Do not commit `.env`, secrets, generated Prisma output, screenshots of personal data, or database dumps.

## Style

- Small, purposeful commits with product-specific messages.
- Strict TypeScript. No `any` without a documented reason.
- Business rules belong in `domain/` or `services/`, not in components.
- Server actions and route handlers must check authorization on the server.
- Public copy uses no em dashes and no audience framing.
- Tests must fail before the fix and pass after it.

## Security

Read [SECURITY.md](SECURITY.md) before changing authentication, authorization, inventory, ticket signing, or rate limiting. Report vulnerabilities through GitHub private vulnerability reporting, not a public issue.
