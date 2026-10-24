import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Accessibility targets, keyboard support, and known limits in the Gatefold demo.",
};

export default function AccessibilityPage() {
  return (
    <div className="shell-narrow py-12 sm:py-16 prose-block">
      <p className="eyebrow">Policy</p>
      <h1 className="display-l mt-3">Accessibility</h1>
      <p className="lede mt-4">
        Gatefold targets WCAG 2.2 AA on the public programme, checkout, ticket, organizer, and
        check-in surfaces. This page describes what is in place and what is not yet proven.
      </p>

      <h2 className="display-m">What is in place</h2>
      <ul className="muted">
        <li>Semantic landmarks, one main region per page, and a skip link on public pages.</li>
        <li>Labelled form controls, visible focus rings, and keyboard-operable buttons and links.</li>
        <li>Polite or assertive error announcements through live regions where the interface changes.</li>
        <li>Reduced-motion support, with transitions reduced to almost zero when the operating system asks.</li>
        <li>Contrast-checked color tokens for body text, muted text, controls, and status chips.</li>
        <li>Manual ticket-code entry as an alternative to the camera scanner at the door.</li>
        <li>Text status labels alongside color, so sold-out, void, and checked-in states do not rely on color alone.</li>
      </ul>

      <h2 className="display-m">Check-in at the door</h2>
      <p className="muted">
        The check-in console can use a camera where the browser supports it and permission is
        granted. Camera access is never required: staff can type or paste a ticket code into the same
        verification service. The scanner frame has a visible border and the result is announced as
        text.
      </p>

      <h2 className="display-m">Known limits</h2>
      <ul className="muted">
        <li>This build has not been independently audited against WCAG 2.2 AA.</li>
        <li>Screen-reader behavior has been reviewed by structure and labels, not by a formal assistive-technology test matrix.</li>
        <li>Printed tickets depend on the browser&apos;s print dialog; paper size and margins are not controlled by the app.</li>
        <li>Third-party browser extensions can alter focus order and contrast.</li>
      </ul>

      <h2 className="display-m">Feedback</h2>
      <p className="muted">
        If something blocks you, describe the page and the step to the organizer running this demo.
        Accessibility issues are treated as product defects, not feature requests.
      </p>

      <p className="mt-10 border-t border-line pt-5 text-sm faint">
        <Link href="/events" className="link">Browse the programme</Link> or{" "}
        <Link href="/terms" className="link">read the terms</Link>.
      </p>
    </div>
  );
}
