# API reference

All endpoints return JSON. Success bodies use `{ "data": ... }`. Failures use:

```json
{
  "error": {
    "code": "SOLD_OUT",
    "message": "Those tickets just sold out. Choose a different quantity or ticket type.",
    "requestId": "8f4b0c2e-..."
  }
}
```

Every response includes `x-request-id`. Mutating requests from browsers are checked against the request origin. Sensitive endpoints are rate-limited in PostgreSQL. Organizer endpoints require the organizer session cookie.

## Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400/413 | Invalid or oversized request |
| `UNAUTHORIZED` | 401 | No valid session or credentials |
| `FORBIDDEN` | 403 | Role or origin does not allow the action |
| `NOT_FOUND` | 404 | Missing record or invalid capability |
| `CONFLICT` | 409 | State or uniqueness conflict |
| `SOLD_OUT` | 409 | Conditional inventory update affected no row |
| `HOLD_EXPIRED` | 409 | Hold deadline passed |
| `INVALID_STATE` | 409 | Operation not allowed in the current state |
| `RATE_LIMITED` | 429 | Fixed-window limit exceeded |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key used with a different payload |
| `POLICY_DENIED` | 409 | Cancellation policy refused |
| `INVALID_SIGNATURE` | 400 | QR payload signature mismatch |
| `WRONG_EVENT` | 409 | Ticket belongs to another event |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

## Public catalogue

`GET /api/events?q=night&category=Music&from=2026-11-01&to=2026-11-30&price=25_50&availability=AVAILABLE&cursor=0&take=12`

Returns published events with a future occurrence, minimum price, and remaining inventory.

## Event detail

`GET /api/events/night-market-sessions`

Returns the event, organizer, venue, occurrences, ticket types, and display availability. Draft events return 404.

## Create a hold

`POST /api/events/night-market-sessions/reservations`

Headers: `Content-Type: application/json`, optional `Idempotency-Key`.

```json
{
  "eventId": "cm...",
  "occurrenceId": "cm...",
  "items": [{ "ticketTypeId": "cm...", "quantity": 2 }],
  "buyer": {
    "name": "Ari Voss",
    "email": "ari@example.test",
    "phone": ""
  }
}
```

Response `201`:

```json
{
  "data": {
    "id": "uuid",
    "ref": "uuid.signature",
    "holdExpiresAt": "2026-11-01T12:10:00.000Z",
    "totalMinor": 6400,
    "currency": "USD",
    "state": "PENDING_HOLD"
  }
}
```

Repeating the same key and payload returns the original reference. Reusing the key with a different payload returns `IDEMPOTENCY_CONFLICT`.

## Reservation status

`GET /api/reservations/uuid.signature`

Returns the buyer-facing reservation view with lines, tickets, state, and demo confirmation state.

## Demo checkout

`POST /api/reservations/uuid.signature/demo-checkout`

```json
{
  "attendees": [
    { "lineId": "cm...", "names": ["Ari Voss", "Tess Alvi"] }
  ]
}
```

Issues one ticket per confirmed quantity in the same transaction. Repeating the request after confirmation returns the existing tickets and does not issue more.

## Cancel

`POST /api/reservations/uuid.signature/cancel`

```json
{ "reason": "Change of plans" }
```

Pending holds release held inventory. Confirmed reservations release sold inventory and void tickets if the buyer is inside the 24-hour policy window.

## Verify a ticket

`POST /api/tickets/verify` with a staff session.

```json
{
  "payload": "GF1.GF-7K2M-...-5W0Z.signature",
  "eventId": "cm...",
  "gateLabel": "Main door",
  "method": "SCAN"
}
```

A first scan returns `CHECKED_IN`. A repeat scan returns `ALREADY_USED` with the original time. The endpoint returns `INVALID_SIGNATURE`, `WRONG_EVENT`, `NOT_FOUND`, or `INVALID_STATE` for the other cases.

## Organizer events

- `GET /api/organizer/events?organizerId=cm...`
- `POST /api/organizer/events` with an `organizerId` and the event fields used by the event form.
- `GET /api/organizer/events/[id]`
- `PATCH /api/organizer/events/[id]` with `{ "action": "publish" | "unpublish" | "cancel" | "update", ... }`.

## Organizer tickets

- `GET /api/organizer/events/[id]/tickets` returns ticket types, occurrences, and inventory.
- `POST` with `{ "action": "add", "label", "description", "price", "capacity" }`.
- `POST` with `{ "action": "capacity", "inventoryId", "capacity" }`.
- `POST` with `{ "action": "status", "ticketTypeId", "status": "ACTIVE" | "ARCHIVED" }`.
- `POST` with `{ "action": "visibility", "ticketTypeId", "visibility": "PUBLIC" | "HIDDEN" }`.

## Schedule

`GET /api/organizer/events/[id]/schedule` returns occurrences. Occurrence editing is intentionally not exposed after creation in this version.

## Attendees

`GET /api/organizer/events/[id]/attendees?q=ari&state=CONFIRMED&cursor=0&take=25`

Requires the attendee read capability. Check-in staff receive `FORBIDDEN`.

## Check-in statistics

`GET /api/organizer/events/[id]/check-in` returns issued and checked-in counts plus recent scans. Requires `checkin:perform`.

## Event staff assignments

- `GET /api/organizer/events/[id]/staff` returns CHECKIN members with an `assigned` flag.
- `POST /api/organizer/events/[id]/staff` with `{ "userId": "...", "assigned": true }`.
  Owners and managers can assign. A CHECKIN account without an assignment cannot open the
  event check-in, attendee or verification endpoints.

## Team

- `GET /api/organizer/team?organizerId=cm...`
- `POST /api/organizer/team` with `{ "organizerId", "email", "role": "MANAGER" | "CHECKIN" }`.
  The raw invitation token is returned once so it can be shared; email is not sent.

## Maintenance expiry

`POST /api/internal/expire-holds`

Requires `Authorization: Bearer <CRON_SECRET>`. Returns `{ "data": { "expired": 3, "at": "..." } }`.

## Health

`GET /api/health`

```json
{ "status": "ok", "database": "up", "version": "abc1234", "checkedAt": "2026-11-01T12:00:00.000Z" }
```

The response never includes a host, database name, or configuration value.
