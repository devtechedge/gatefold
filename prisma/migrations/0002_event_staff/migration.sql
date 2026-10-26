-- Per-event check-in assignments. Owners and managers still reach every event;
-- CHECKIN members only reach events they are assigned to.

CREATE TABLE "event_staff_assignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_staff_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_staff_assignment_eventId_userId_key" ON "event_staff_assignment"("eventId", "userId");
CREATE INDEX "event_staff_assignment_userId_idx" ON "event_staff_assignment"("userId");

ALTER TABLE "event_staff_assignment"
  ADD CONSTRAINT "event_staff_assignment_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_staff_assignment"
  ADD CONSTRAINT "event_staff_assignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
