export default function OrganizerLoading() {
  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="h-3 w-32 bg-paper-3" />
      <div className="mt-5 h-14 w-2/3 bg-paper-3" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-24 bg-paper-3" />)}
      </div>
      <div className="mt-8 h-64 bg-paper-3" />
      <p className="sr-only" role="status">Loading organizer console</p>
    </div>
  );
}
