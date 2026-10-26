# Security

Gatefold is a demonstration implementation of an event operations platform. This document describes the threat model that shaped the code, the controls that are present, and the risks that remain. It is not a certification and it does not claim that the system is secure against every attacker.

## Supported versions

Only the current `main` branch is maintained. There are no long-term support branches.

## Reporting

Use GitHub private vulnerability reporting on this repository. Do not open a public issue with exploit details. Because this is a demo, there is no paid bounty and no guaranteed response time.

## Assets

- Organizer accounts and sessions.
- Ticket inventory and reservation state.
- Issued tickets and check-in records.
- Buyer names, email addresses, optional phone numbers, and attendee names.
- Ticket-signing and session-pepper secrets.
- Audit history and operational records.

## Actors

- Anonymous visitor: can browse published events, create holds, complete demo checkout, and view a reservation or ticket through its capability link.
- Buyer: an anonymous visitor who created a reservation and holds its signed link.
- Check-in staff: an organizer member who can verify tickets and look up attendees, but cannot manage prices, events, or users.
- Event manager: can manage events, tickets, attendees, and check-in, but cannot manage the team or organizer settings.
- Owner: full organizer control, including team and settings.

## Threat model and controls

| Threat | Control | Residual risk |
| --- | --- | --- |
| Account takeover | scrypt password hashes, opaque sessions, per-IP and per-email login limits, session revocation on account deletion | No MFA, no password reset, no breached-password check |
| Broken object-level authorization | Every organizer operation resolves membership from the signed-in user and the target event or organizer; client-supplied organizer IDs are not trusted | CHECKIN is organizer-wide rather than per-event |
| Reservation tampering | Access references are HMAC-derived over reservation id and access version; changing the id or version invalidates the link; organizer cancellation rotates the version | The link is a bearer capability. Anyone with it can view the record |
| Inventory abuse | Atomic conditional update in SQL, affected-row checks, ten-minute holds, per-IP and per-email limits, database CHECK constraint | Attackers with many addresses or accounts can still create noise |
| Ticket forgery | Ticket QR payloads carry an HMAC-SHA256 signature; verification resolves the ticket against authoritative state | A leaked `TICKET_SIGNING_SECRET` compromises every ticket until rotation |
| QR replay | One successful check-in per ticket enforced by a unique constraint; repeat scans return the first scan time | A screenshot can be used once before the legitimate holder arrives |
| Staff privilege escalation | Capability matrix checked server-side for every organizer and event operation | Staff are not restricted to assigned events |
| Rate-limit evasion | Fixed-window counters stored in PostgreSQL; buyer emails are hashed in limit keys; Vercel forwarding headers are preferred | A distributed attacker can spread requests across addresses |
| CSRF | `SameSite=Lax` session cookie; mutating API routes check the Origin header; Next.js server actions perform their own origin checks | Requests without an Origin header are allowed because they are not browser cross-site requests |
| XSS | React escapes rendered content; there is no user-controlled HTML; no `dangerouslySetInnerHTML` beyond a constant theme boot script | No Content Security Policy is configured yet |
| SQL injection | Prisma parameterization and tagged raw SQL parameters; no string concatenation of user input | A future raw query could regress this |
| Leaked access links | Session tokens are stored hashed; reservation references are derived, not stored raw; links are excluded from robots and sitemap | Links can be forwarded, logged by proxies, or captured in screenshots |
| PII exposure | Attendee data is restricted to owners and managers; check-in staff see a narrower lookup; logs avoid raw buyer data | The demo runs on a shared Neon host and does not automate retention |
| Secret exposure | Secrets live only in environment variables; `.env` is ignored; values are never rendered to clients | Secret rotation invalidates sessions or tickets |
| Denial of service | Request body caps, bounded list queries, rate limits, ownership-scoped lookups | No dedicated WAF, CDN tuning, or global circuit breaker |
| Supply chain | Committed lockfile, `npm audit`, Dependabot for npm and Actions | No reproducible-build verification or lockfile signing |

## Security headers

Responses set `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and `X-DNS-Prefetch-Control`. Vercel supplies HSTS for production HTTPS. A strict CSP is deferred until it can be staged without breaking Next runtime behavior.

## Data handling

- Session tokens are random 32-byte values. Only a SHA-256 hash with a server pepper is stored.
- Passwords are scrypt hashes with per-password salts.
- Buyer emails are normalized and stored in reservation records. They are hashed when used as rate-limit keys.
- Reservation access references are HMAC-derived and are not stored in plaintext.
- Audit events store small metadata objects, not raw request bodies.
- Account deletion revokes sessions, removes memberships, and anonymizes the user row. Owners are blocked from deletion while they own an organizer. Check-in and audit history remain attached to the anonymized account.
- The demo does not send email and does not connect an analytics or advertising service.

## Demo boundaries

The seeded accounts, events, buyers, and tickets are fictional. The demo passwords are public by design. Do not enter real personal data, do not use the demo for a real event, and do not treat the shared database as durable storage.

## Known gaps

- No independent security audit.
- No MFA, password reset, or email delivery.
- No CSP yet.
- No per-event staff assignment.
- No automated retention or backup policy.
- The shared Neon host must be replaced with a dedicated project before paid or real-event use.
