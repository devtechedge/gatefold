import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="shell flex min-h-[68px] flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="eyebrow hidden md:inline border-l border-line pl-3">
            Independent event operations
          </span>
        </div>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 sm:gap-2">
          <Link href="/events" className="btn btn-ghost btn-sm">
            Discover
          </Link>
          <Link href="/events?availability=AVAILABLE" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            On sale
          </Link>
          <Link href={user ? "/organizer" : "/login?next=/organizer"} className="btn btn-ghost btn-sm">
            Organizer
          </Link>
          <ThemeToggle />
          {user ? (
            <>
              <span className="eyebrow hidden lg:inline px-1">{user.displayName}</span>
              <form action={logoutAction}>
                <button type="submit" className="btn btn-outline btn-sm">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
