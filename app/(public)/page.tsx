import Link from "next/link";
import { EventArtwork } from "@/components/event-artwork";
import { EventCard } from "@/components/event-card";
import { catalogue } from "@/repositories/events";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, formatTime } from "@/lib/dates";

export default async function HomePage() {
  const [catalogueResult, sampleTicket] = await Promise.all([
    catalogue({
      q: "",
      category: "",
      from: "",
      to: "",
      price: "ALL",
      availability: "AVAILABLE",
      offset: 0,
      take: 6,
    }),
    prisma.issuedTicket.findUnique({
      where: { publicId: "GF-7K2M-9Q4X-3B8N-6T1V-5W0Z" },
      select: { publicId: true },
    }),
  ]);
  const rows = catalogueResult.rows;
  const featured = rows[0] ?? null;

  return (
    <>
      <section className="border-b-2 border-ink">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="shell py-16 sm:py-24 lg:py-28">
            <p className="eyebrow">Independent event operations / demo edition</p>
            <h1 className="display-xl mt-5 max-w-[12ch]">
              The room is <span style={{ color: "var(--accent-ink)" }}>the product.</span>
            </h1>
            <p className="lede mt-7">
              Gatefold publishes the programme, protects the inventory, issues the tickets, and runs
              the door. Every hold is a database transaction. Every ticket is signed. Every scan is
              checked against the live record.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/events" className="btn btn-primary">
                Find something to attend
              </Link>
              <Link href="/organizer" className="btn">
                Open the organizer desk
              </Link>
            </div>
            <p className="mt-8 max-w-lg border-l-2 border-accent pl-4 text-sm muted">
              Checkout is explicitly simulated. No card form, no payment provider, no money collected.
              The reservation, ticket, and check-in state are real.
            </p>
          </div>

          <div className="relative border-t border-line bg-paper-2 lg:border-l lg:border-t-0">
            <div className="grid-lines absolute inset-0 opacity-40" aria-hidden="true" />
            <div className="relative flex h-full items-center justify-center p-6 sm:p-10">
              {featured ? (
                <div className="ticket-notch w-full max-w-[430px] border-ink">
                  <div className="flex items-stretch">
                    <div className="min-w-0 flex-1 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="eyebrow">Next in the room</span>
                        <span className="chip chip-outline">{featured.category}</span>
                      </div>
                      <EventArtwork
                        artwork={featured.artwork}
                        title={featured.title}
                        className="mt-4 aspect-[16/9] w-full border border-ink"
                      />
                      <h2 className="mt-5 text-[1.9rem] leading-none" style={{ fontFamily: "var(--type-display)" }}>
                        {featured.title}
                      </h2>
                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-3 border-t border-line pt-2">
                          <dt className="faint">When</dt>
                          <dd className="text-right">
                            {formatDate(featured.nextStart, featured.timezone)}
                            <br />
                            {formatTime(featured.nextStart, featured.timezone)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-line pt-2">
                          <dt className="faint">Where</dt>
                          <dd className="text-right">
                            {featured.venueName}
                            <br />
                            <span className="faint">{featured.venueAddress}</span>
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-line pt-2">
                          <dt className="faint">Tickets</dt>
                          <dd className="mono text-right">
                            {featured.minPrice === 0
                              ? "Free"
                              : `From ${formatMoney(featured.minPrice, featured.currency)}`}
                          </dd>
                        </div>
                      </dl>
                      <Link href={`/events/${featured.slug}`} className="btn btn-primary mt-5 w-full">
                        Read the programme
                      </Link>
                    </div>
                    <div className="perforation w-12 shrink-0 p-3">
                      <div className="flex h-full items-center justify-center">
                        <span
                          className="mono whitespace-nowrap text-[0.6rem] uppercase tracking-[0.22em] faint"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          Gatefold / admit one / demo
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="barcode mx-5 my-4 border-t-2 border-dashed border-line-strong"
                  />
                </div>
              ) : (
                <div className="card-hard max-w-sm p-6">
                  <p className="eyebrow">Quiet week</p>
                  <p className="mt-3 text-lg">No events are on sale yet. Start the demo seed to open the doors.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">01 / Currently on sale</p>
            <h2 className="display-l mt-3">Worth leaving the house for.</h2>
          </div>
          <Link href="/events" className="btn">
            All events
          </Link>
        </div>
        {rows.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="card mt-10 p-8">
            <p className="text-lg">The programme is between editions. Run the demo seed to populate it.</p>
            <code className="mono mt-3 block text-sm">ALLOW_PROD_SEED=1 npm run db:seed</code>
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {sampleTicket ? (
            <p className="text-sm muted">
              The sample ticket is available at{" "}
              <Link className="link" href={`/ticket/${sampleTicket.publicId}`}>
                /ticket/{sampleTicket.publicId}
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm muted">
              Reservation links are saved by the buyer.{" "}
              <Link href="/reservation" className="link">Retrieve a reservation</Link>.
            </p>
          )}
          <Link href="/reservation" className="eyebrow link">
            Retrieve a reservation
          </Link>
        </div>
      </section>

      <section className="border-y-2 border-ink bg-ink text-paper" data-section="principles">
        <div className="shell py-16 sm:py-20">
          <p className="eyebrow" style={{ color: "var(--lime)" }}>02 / What holds up</p>
          <h2 className="display-l mt-3 max-w-[18ch]">Built for the moment the room gets full.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            <article>
              <p className="mono text-sm" style={{ color: "var(--lime)" }}>01</p>
              <h3 className="mt-3 text-2xl">Honest inventory</h3>
              <p className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--paper) 78%, transparent)" }}>
                The last ticket cannot be sold twice. Holds are conditional updates in Postgres, not
                numbers rendered in a browser tab. Expired holds release their seats without a cron
                dependency.
              </p>
            </article>
            <article>
              <p className="mono text-sm" style={{ color: "var(--lime)" }}>02</p>
              <h3 className="mt-3 text-2xl">Tickets that verify</h3>
              <p className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--paper) 78%, transparent)" }}>
                QR payloads are signed and resolved against the live ticket, reservation, occurrence,
                and event. A screenshot of a cancelled ticket does not get through the door.
              </p>
            </article>
            <article>
              <p className="mono text-sm" style={{ color: "var(--lime)" }}>03</p>
              <h3 className="mt-3 text-2xl">A door that moves</h3>
              <p className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--paper) 78%, transparent)" }}>
                Camera scans and typed codes call the same verification service. Two simultaneous
                scans produce one check-in, and the second one tells staff exactly when the first
                happened.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="shell py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">03 / For the organizer</p>
            <h2 className="display-l mt-3 max-w-[14ch]">Run the room, not the spreadsheet.</h2>
            <p className="lede mt-5">
              Publish an event, configure ticket types and capacity, watch the holds move, search
              attendees, and open a check-in desk on a phone. Roles keep pricing and buyer data away
              from the door staff.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?next=/organizer" className="btn btn-primary">
                Sign in to the desk
              </Link>
              <Link href="/register" className="btn">
                Create an organizer account
              </Link>
            </div>
            <p className="mt-5 text-sm faint">
              Demo owner: demo@gatefold.test / demo-password-1
            </p>
          </div>
          <div className="card-hard p-0">
            <div className="flex items-center justify-between border-b border-ink bg-paper-3 px-5 py-3">
              <span className="eyebrow">The desk, in five moves</span>
              <span className="mono text-xs">ops / 01-05</span>
            </div>
            <ol className="divide-y divide-line">
              {[
                ["01", "Publish the programme", "Draft, preview, publish, or cancel without losing reservation history."],
                ["02", "Configure the inventory", "Ticket types, prices, sales windows, and capacity per occurrence."],
                ["03", "Watch holds resolve", "Ten-minute holds either confirm into tickets or release their seats."],
                ["04", "Find the attendee", "Search by name, email, or ticket code with reservation state in view."],
                ["05", "Open the door", "Camera or manual verification, scoped to check-in staff and written to the audit log."],
              ].map(([number, title, detail]) => (
                <li key={number} className="grid grid-cols-[2.2rem_1fr] gap-3 px-5 py-4">
                  <span className="mono text-xs faint">{number}</span>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs faint">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-line px-5 py-3">
              <p className="text-xs faint">
                Every action is scoped to the signed-in organizer membership.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
