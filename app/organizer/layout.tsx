import { requirePageUser } from "@/lib/auth/session";
import { requireMembershipForPage } from "@/lib/auth/organizer";
import { OrganizerShell } from "@/components/organizer-shell";
import type { Role } from "@/domain/permissions";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("/organizer");
  const membership = await requireMembershipForPage(user.id);
  return (
    <OrganizerShell
      organizerName={membership?.organizer.name ?? null}
      organizerSlug={membership?.organizer.slug ?? null}
      role={(membership?.role as Role | undefined) ?? null}
      userName={user.displayName}
    >
      {children}
    </OrganizerShell>
  );
}
