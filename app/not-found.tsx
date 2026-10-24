import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center"><Logo /></div>
        <p className="eyebrow mt-8">404 / Nothing here</p>
        <h1 className="display-l mt-3">This page is between editions.</h1>
        <p className="mt-4 text-sm muted">
          The event, reservation, or ticket may have been removed, or the link may be incomplete.
          Reservation and ticket links are long on purpose.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/events" className="btn btn-primary">Browse events</Link>
          <Link href="/" className="btn">Home</Link>
        </div>
      </div>
    </div>
  );
}
