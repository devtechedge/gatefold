-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_membership" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CHECKIN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_invitation" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CHECKIN',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizer_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "accessibility" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "timezone" TEXT NOT NULL,
    "artwork" TEXT NOT NULL DEFAULT 'vermilion',
    "cancellationPolicy" TEXT NOT NULL DEFAULT 'Confirmed tickets can be cancelled by the buyer until 24 hours before the occurrence starts. If the organizer cancels the event, every issued ticket is voided.',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_occurrence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_type" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceMinor" INTEGER NOT NULL,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_inventory" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "held" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" TEXT NOT NULL,
    "accessVersion" INTEGER NOT NULL DEFAULT 1,
    "organizerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING_HOLD',
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_line" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,

    CONSTRAINT "reservation_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_ticket" (
    "id" TEXT NOT NULL,
    "reservationLineId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "attendeeName" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "issued_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gateLabel" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT 'SCAN',

    CONSTRAINT "check_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_confirmation" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'demo',
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "responseJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_slug_key" ON "organizer"("slug");

-- CreateIndex
CREATE INDEX "organizer_ownerId_idx" ON "organizer"("ownerId");

-- CreateIndex
CREATE INDEX "organizer_membership_userId_idx" ON "organizer_membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_membership_organizerId_userId_key" ON "organizer_membership"("organizerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_invitation_tokenHash_key" ON "organizer_invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "organizer_invitation_organizerId_email_idx" ON "organizer_invitation"("organizerId", "email");

-- CreateIndex
CREATE INDEX "venue_organizerId_idx" ON "venue"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "event_slug_key" ON "event"("slug");

-- CreateIndex
CREATE INDEX "event_organizerId_status_idx" ON "event"("organizerId", "status");

-- CreateIndex
CREATE INDEX "event_status_category_idx" ON "event"("status", "category");

-- CreateIndex
CREATE INDEX "event_occurrence_startsAt_idx" ON "event_occurrence"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_occurrence_eventId_startsAt_key" ON "event_occurrence"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "ticket_type_eventId_status_idx" ON "ticket_type"("eventId", "status");

-- CreateIndex
CREATE INDEX "ticket_inventory_ticketTypeId_idx" ON "ticket_inventory"("ticketTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_inventory_occurrenceId_ticketTypeId_key" ON "ticket_inventory"("occurrenceId", "ticketTypeId");

-- CreateIndex

-- CreateIndex
CREATE INDEX "reservation_eventId_state_idx" ON "reservation"("eventId", "state");

-- CreateIndex
CREATE INDEX "reservation_organizerId_state_idx" ON "reservation"("organizerId", "state");

-- CreateIndex
CREATE INDEX "reservation_state_holdExpiresAt_idx" ON "reservation"("state", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "reservation_line_occurrenceId_idx" ON "reservation_line"("occurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_line_reservationId_ticketTypeId_occurrenceId_key" ON "reservation_line"("reservationId", "ticketTypeId", "occurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "issued_ticket_publicId_key" ON "issued_ticket"("publicId");

-- CreateIndex
CREATE INDEX "issued_ticket_reservationLineId_idx" ON "issued_ticket"("reservationLineId");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_ticketId_key" ON "check_in"("ticketId");

-- CreateIndex
CREATE INDEX "check_in_staffUserId_scannedAt_idx" ON "check_in"("staffUserId", "scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "demo_confirmation_reservationId_key" ON "demo_confirmation"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "demo_confirmation_reference_key" ON "demo_confirmation"("reference");

-- CreateIndex
CREATE INDEX "audit_event_organizerId_createdAt_idx" ON "audit_event"("organizerId", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_record_createdAt_idx" ON "idempotency_record"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_scope_key_key" ON "idempotency_record"("scope", "key");

-- CreateIndex
CREATE INDEX "rate_limit_windowStart_idx" ON "rate_limit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_windowStart_key" ON "rate_limit"("key", "windowStart");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer" ADD CONSTRAINT "organizer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_membership" ADD CONSTRAINT "organizer_membership_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_membership" ADD CONSTRAINT "organizer_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_membership" ADD CONSTRAINT "organizer_membership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_invitation" ADD CONSTRAINT "organizer_invitation_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_invitation" ADD CONSTRAINT "organizer_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue" ADD CONSTRAINT "venue_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_occurrence" ADD CONSTRAINT "event_occurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_type" ADD CONSTRAINT "ticket_type_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_inventory" ADD CONSTRAINT "ticket_inventory_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_inventory" ADD CONSTRAINT "ticket_inventory_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_line" ADD CONSTRAINT "reservation_line_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_line" ADD CONSTRAINT "reservation_line_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_line" ADD CONSTRAINT "reservation_line_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "event_occurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_ticket" ADD CONSTRAINT "issued_ticket_reservationLineId_fkey" FOREIGN KEY ("reservationLineId") REFERENCES "reservation_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "issued_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_confirmation" ADD CONSTRAINT "demo_confirmation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Gatefold database invariants
ALTER TABLE "ticket_inventory"
  ADD CONSTRAINT "ticket_inventory_capacity_nonnegative" CHECK ("capacity" >= 0),
  ADD CONSTRAINT "ticket_inventory_held_nonnegative" CHECK ("held" >= 0),
  ADD CONSTRAINT "ticket_inventory_sold_nonnegative" CHECK ("sold" >= 0),
  ADD CONSTRAINT "ticket_inventory_within_capacity" CHECK ("held" + "sold" <= "capacity");

ALTER TABLE "reservation_line"
  ADD CONSTRAINT "reservation_line_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "reservation_line_price_nonnegative" CHECK ("unitPriceMinor" >= 0);

ALTER TABLE "ticket_type"
  ADD CONSTRAINT "ticket_type_price_nonnegative" CHECK ("priceMinor" >= 0);

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_state_valid" CHECK ("state" IN ('PENDING_HOLD', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
  ADD CONSTRAINT "reservation_total_nonnegative" CHECK ("totalMinor" >= 0);

ALTER TABLE "event"
  ADD CONSTRAINT "event_status_valid" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'));

ALTER TABLE "organizer_membership"
  ADD CONSTRAINT "organizer_membership_role_valid" CHECK ("role" IN ('OWNER', 'MANAGER', 'CHECKIN')),
  ADD CONSTRAINT "organizer_membership_status_valid" CHECK ("status" IN ('ACTIVE', 'SUSPENDED'));

ALTER TABLE "issued_ticket"
  ADD CONSTRAINT "issued_ticket_status_valid" CHECK ("status" IN ('VALID', 'VOID'));

ALTER TABLE "event_occurrence"
  ADD CONSTRAINT "event_occurrence_status_valid" CHECK ("status" IN ('SCHEDULED', 'CANCELLED'));

ALTER TABLE "ticket_type"
  ADD CONSTRAINT "ticket_type_status_valid" CHECK ("status" IN ('ACTIVE', 'ARCHIVED')),
  ADD CONSTRAINT "ticket_type_visibility_valid" CHECK ("visibility" IN ('PUBLIC', 'HIDDEN'));

ALTER TABLE "organizer_invitation"
  ADD CONSTRAINT "organizer_invitation_role_valid" CHECK ("role" IN ('MANAGER', 'CHECKIN'));

ALTER TABLE "check_in"
  ADD CONSTRAINT "check_in_method_valid" CHECK ("method" IN ('SCAN', 'MANUAL'));

ALTER TABLE "demo_confirmation"
  ADD CONSTRAINT "demo_confirmation_method_valid" CHECK ("method" = 'demo');
