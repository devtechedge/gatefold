import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-2 border-ink bg-paper-2">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm muted">
            Publishing, inventory, issued tickets, and a check-in desk for independent organizers,
            venues, and small festivals.
          </p>
          <p className="mt-5 eyebrow">Demo environment</p>
          <p className="mt-2 max-w-xs text-xs faint">
            Checkout is simulated. No payment provider is connected and no money is collected.
          </p>
        </div>
        <div>
          <p className="eyebrow">Discover</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="link" href="/events">All events</Link></li>
            <li><Link className="link" href="/events?availability=AVAILABLE">On sale now</Link></li>
            <li><Link className="link" href="/events?price=FREE">Free events</Link></li>
            <li><Link className="link" href="/reservation">Find a reservation</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Organizers</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="link" href="/organizer">Operations desk</Link></li>
            <li><Link className="link" href="/organizer/events/new">Publish an event</Link></li>
            <li><Link className="link" href="/login?next=/organizer">Organizer sign in</Link></li>
            <li><Link className="link" href="/register">Create an account</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Policy</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="link" href="/terms">Terms</Link></li>
            <li><Link className="link" href="/privacy">Privacy</Link></li>
            <li><Link className="link" href="/accessibility">Accessibility</Link></li>
            <li><Link className="link" href="/api/health">Service health</Link></li>
          </ul>
        </div>
      </div>
      <div className="shell flex flex-wrap items-center justify-between gap-2 border-t border-line py-5">
        <p className="eyebrow">Gatefold / demo edition / 2026</p>
        <p className="text-xs faint">
          Ticket QR codes are signed server-side. Demo checkout confirms no payment.
        </p>
      </div>
    </footer>
  );
}
