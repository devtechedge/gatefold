# Architecture decisions

## ADR-001: Atomic conditional inventory updates

Status: accepted.

Inventory is updated with a single conditional SQL statement whose `WHERE` clause checks remaining capacity. The affected row count is the success signal. This avoids read-then-write races under concurrent holds, keeps the decision in the database, and works with row locks without requiring serializable isolation. Lines are sorted by inventory id to reduce deadlocks. A CHECK constraint enforces `held + sold <= capacity` as a second defense.

Rejected alternatives: application-level mutex (does not work across serverless instances), serializable transactions (more retries and contention), read then update with a version check (two round trips and a larger failure surface).

## ADR-002: Demo checkout is a recorded simulation

Status: accepted.

Checkout writes a `DemoConfirmation` row with method `demo`, amount, currency, and a reference. It never calls a payment provider and never represents a payment as captured. Every public surface states that checkout is simulated. This keeps the inventory and ticket state machines real while making the payment boundary explicit.

## ADR-003: HMAC-signed ticket references

Status: accepted.

A ticket QR payload is `GF1.<publicId>.<hmac>`. The HMAC covers the public ticket id with `TICKET_SIGNING_SECRET`. Verification recomputes the signature and then checks authoritative ticket, reservation, occurrence, and event state. A screenshot of a valid ticket can be used once before the holder arrives; after the first check-in, the unique check-in record produces `ALREADY_USED`. A signed payload alone never authorizes entry.

## ADR-004: Ten-minute holds with opportunistic and protected expiry

Status: accepted.

A hold lasts ten minutes from creation. It is never extended by a page refresh. Expiry runs opportunistically on reads, hold creation, and checkout, and is also exposed by a bearer-protected maintenance endpoint. Both paths lock the reservation row and re-check state, so repeated workers cannot release the same inventory twice. The invariant does not depend on a scheduler existing.

## ADR-005: Derived, revocable reservation references

Status: accepted.

A reservation access reference is `id.signature`, where the signature is HMAC-derived from the reservation id and an access version using the session pepper. The reference is not stored raw. Rotating the access version, which happens when an organizer cancels a reservation, revokes the old link. A reservation id alone is not sufficient to view the record.

## ADR-006: Shared Neon host for the demo

Status: accepted for the demo, revisit before real use.

The production, test, and e2e databases live on an existing shared Neon host to avoid creating paid infrastructure for a demo. Database names and connection strings are separated. The host is not appropriate for real-event or paid use. Move to a dedicated Neon project, enable backups, and rehearse a restore before that change.

## ADR-007: Bearer capability links for buyers

Status: accepted.

Buyers do not have accounts. Reservation and ticket links are unguessable capabilities. Anyone with the link can view that record. This is a deliberate tradeoff for a no-email demo. Links are excluded from robots and sitemap, and organizer cancellation can rotate the reservation reference. The README and security document state the risk.

## ADR-008: Organizer-wide roles

Status: accepted for the demo, revisit before larger teams.

The CHECKIN role applies to the whole organizer rather than to assigned events. This keeps the role model small and keeps check-in staff out of pricing, attendee exports, team management, and event cancellation. Per-event assignment would be the next step for venues with many concurrent events and separate door crews.

## ADR-009: No email delivery

Status: accepted.

No mail provider is connected. Invitation links are displayed once after creation and must be shared by the organizer. Signed-out password reset is not offered because the product cannot deliver a reset message and will not pretend that it did. Signed-in users can change their password. Add email delivery only when a real provider exists.

## ADR-010: Event completion status is reserved

Status: accepted.

`COMPLETED` remains in the event lifecycle and database check constraint but no automatic transition writes it. Published events stay published after their final occurrence so their pages and ticket history remain reachable. A future sweep can mark events complete without changing reservation or ticket semantics.
