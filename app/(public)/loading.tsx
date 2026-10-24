export default function PublicLoading() {
  return (
    <div className="shell py-16">
      <div className="h-3 w-32 bg-paper-3" />
      <div className="mt-5 h-16 w-3/4 bg-paper-3" />
      <div className="mt-4 h-4 w-1/2 bg-paper-3" />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="border border-line bg-paper-2">
            <div className="aspect-[5/3] w-full bg-paper-3" />
            <div className="space-y-3 p-4">
              <div className="h-3 w-24 bg-paper-3" />
              <div className="h-6 w-3/4 bg-paper-3" />
              <div className="h-3 w-1/2 bg-paper-3" />
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only" role="status">Loading events</p>
    </div>
  );
}
