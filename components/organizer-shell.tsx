import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions";
import { can, ROLE_LABELS, type Role } from "@/domain/permissions";

export function OrganizerShell({
  children,
  organizerName,
  organizerSlug,
  role,
  userName,
}: {
  children: React.ReactNode;
  organizerName: string | null;
  organizerSlug: string | null;
  role: Role | null;
  userName: string;
}) {
  const links = [
    { href: "/organizer", label: "Overview" },
    { href: "/organizer/events/new", label: "New event" },
    { href: "/organizer/team", label: "Team", owner: true },
    { href: "/organizer/settings", label: "Settings", owner: true },
    { href: "/organizer/account", label: "Account" },
  ];
  return (
    <div className="org-shell">
      <a className="skip-link" href="#organizer-main">Skip to content</a>
      <aside className="org-aside flex flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Logo compact />
            <ThemeToggle />
          </div>
          <div className="mt-5 border-t border-white/15 pt-4">
            <p className="eyebrow" style={{ color: "color-mix(in srgb, var(--paper) 65%, transparent)" }}>
              Organizer desk
            </p>
            <p className="mt-1 text-sm" style={{ fontFamily: "var(--type-display)" }}>
              {organizerName ?? "No organizer yet"}
            </p>
            {role ? (
              <p className="mt-1 text-xs" style={{ color: "color-mix(in srgb, var(--paper) 65%, transparent)" }}>
                {ROLE_LABELS[role]}
              </p>
            ) : null}
          </div>
          <nav aria-label="Organizer" className="mt-4 flex flex-wrap gap-1 lg:block">
            {links.map((link) => {
              if (link.owner && role && !can(role, "team:manage")) return null;
              if (link.owner && !role) return null;
              return (
                <Link key={link.href} href={link.href} className="org-nav-link">
                  {link.label}
                </Link>
              );
            })}
            {organizerSlug ? (
              <Link href={`/events`} className="org-nav-link">
                Public programme
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="mt-6 border-t border-white/15 pt-4">
          <p className="text-xs" style={{ color: "color-mix(in srgb, var(--paper) 62%, transparent)" }}>
            {userName}
          </p>
          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="btn btn-sm w-full"
              style={{ borderColor: "color-mix(in srgb, var(--paper) 35%, transparent)", color: "var(--paper)" }}
            >
              Sign out
            </button>
          </form>
          <p className="mt-4 text-[0.65rem]" style={{ color: "color-mix(in srgb, var(--paper) 45%, transparent)" }}>
            Demo environment. No payments are processed.
          </p>
        </div>
      </aside>
      <main id="organizer-main" className="min-w-0 bg-paper">
        {children}
      </main>
    </div>
  );
}
