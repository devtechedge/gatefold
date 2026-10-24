export function EventArtwork({
  artwork,
  title,
  className = "",
}: {
  artwork: string;
  title: string;
  className?: string;
}) {
  const initials = title
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div className={`art-frame art-${artwork} ${className}`} aria-hidden="true">
      <span className="art-grid" />
      <span className="art-shape-a" />
      <span className="art-shape-b" />
      <span className="art-mark">{initials}</span>
    </div>
  );
}
