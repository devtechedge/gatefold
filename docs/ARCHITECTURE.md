# Architecture

Gatefold is a single Next.js App Router application with a PostgreSQL database. There is no queue, no microservice, and no client-side authority over inventory or ticket state.

## Layers

```
app/            routes, pages, route handlers, server actions
components/     accessible UI, client interaction, check-in scanner
domain/         pure rules: state machine, inventory, sales, permissions, ticket signing
services/       use cases and transactions
repositories/   narrow database access and conditional updates
validation/     Zod request contracts
lib/            env, db, auth, rate limits, HTTP envelope, dates, ids
prisma/         schema, migration, seed
tests/          unit and PostgreSQL integration
e2e/            Playwright journeys and accessibility audits
```

Dependencies point inward. A domain module never imports Prisma. A route handler never writes SQL directly. Services coordinate repositories, domain rules, audit events, and transactions.

## Request flow: creating a hold

1. `POST /api/events/[slug]/reservations` checks origin, IP and email rate limits, parses the body, and resolves the event by slug or id.
2. `createHold` verifies the event is published and the occurrence is in the future, then checks each ticket type's status, visibility, and sales window.
3. The request hash is computed from the event, occurrence, buyer, and sorted line items. A supplied `Idempotency-Key` is looked up first.
4. In one transaction, the event row is locked with `FOR SHARE`, an idempotency record is claimed, and inventory rows are updated in a stable order with a conditional SQL statement.
5. A reservation and its lines are inserted with an HMAC-derived access reference. The idempotency record stores the response.
6. The client receives a reservation reference and is sent to checkout.

## Request flow: demo checkout

1. The reference is parsed and its HMAC verified against the stored reservation id and access version.
2. A transaction locks the reservation row with `FOR UPDATE`.
3. A confirmed reservation returns its existing tickets. A cancelled or expired reservation is refused.
4. An expired pending hold releases held inventory, is marked `EXPIRED`, and returns `HOLD_EXPIRED`.
5. Otherwise each line moves `held` to `sold`, the reservation becomes `CONFIRMED`, a `DemoConfirmation` is recorded, and one ticket per quantity is issued with an unpredictable public id.
6. Audit metadata records the ticket count, demo amount, and demo method.

## Request flow: check-in

1. A staff member is authorized against the event with `checkin:perform`.
2. A signed payload is verified with HMAC. An unsigned manual code is normalized.
3. The ticket is resolved with its line, reservation, occurrence, event, and check-in.
4. Ticket status, reservation state, event state, occurrence state, and expected event are checked.
5. A check-in row is inserted. The unique constraint on `ticketId` guarantees one record. A concurrent loser receives `ALREADY_USED` with the first scan time.

## Concurrency

Inventory is protected by a conditional update:

```sql
UPDATE ticket_inventory
SET held = held + $1, version = version + 1
WHERE id = $2
  AND capacity - sold - held >= $1
RETURNING id, capacity, held, sold;
```

The affected row count is the decision. No read-then-write race is possible. Lines are sorted by inventory id before updates. Confirmation and cancellation lock the reservation row first, then inventory, so expiry workers and checkout serialize on the same reservation.

The database enforces `held + sold <= capacity` with a CHECK constraint as a second line of defense.

## Expiry

Expired holds are released in two ways:

- Opportunistically when a reservation is read, a hold is created, or checkout is attempted.
- By `POST /api/internal/expire-holds`, protected by `CRON_SECRET` with a constant-time comparison.

Both paths lock the reservation row and re-check that it is still pending and due before releasing inventory. A second worker cannot release the same quantity twice.

## Authentication and authorization

- Opaque 32-byte session tokens in an HttpOnly, SameSite=Lax cookie, stored as SHA-256 hashes with a server pepper.
- scrypt password hashing with per-password salts.
- Capability checks on every organizer and event operation. Owner, manager, and check-in staff have different capability sets.
- Buyer access uses signed reservation references. Ticket access uses unpredictable public ids plus authoritative state checks.

## Data model

| Table | Purpose |
| --- | --- |
| `user`, `session` | Accounts and hashed sessions |
| `organizer`, `organizer_membership`, `organizer_invitation` | Tenant, roles, invitations |
| `venue`, `event`, `event_occurrence` | Programme and schedule |
| `ticket_type`, `ticket_inventory` | Prices, sales windows, capacity, held and sold |
| `reservation`, `reservation_line` | Buyer holds, state, price snapshots |
| `issued_ticket`, `check_in` | Ticket identity, status, one check-in per ticket |
| `demo_confirmation` | Simulated checkout record |
| `audit_event` | Organizer-scoped operational history |
| `idempotency_record`, `rate_limit` | Duplicate request protection and abuse limits |

## UI split

Public pages are server components that read through repositories. Interactive booking, checkout, and scanning are small client components that call APIs. The client never owns authoritative availability. Organizer mutations use server actions with server-side capability checks and `revalidatePath`.

## Test strategy

- Pure domain rules are unit-tested without a database.
- Services are integration-tested against PostgreSQL, including real concurrent transactions.
- Playwright runs against a production build and a dedicated seeded e2e database. It covers booking, checkout, tickets, check-in, organizer publishing, role restrictions, security headers, print, responsive widths, and axe accessibility audits.

## Deployment

Vercel runs the Next.js build. Neon hosts PostgreSQL. The application reads pooled `DATABASE_URL` at runtime and unpooled `DATABASE_URL_UNPOOLED` for migrations. Migrations run before serving new code. The seed is deliberately guarded and never runs automatically.
