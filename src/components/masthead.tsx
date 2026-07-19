/** Slim page header: the doodled avatar, a space title (string gets display
 * type; pass a node for richer headers), and per-space actions on the right.
 * The wordmark lives in the dock now — this strip stays out of the way. */
export function Masthead({
  avatar,
  title,
  children,
}: {
  avatar?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {avatar}
        {typeof title === "string" ? (
          <h1 className="truncate font-display text-3xl font-black leading-none tracking-tight text-ink">
            {title}
          </h1>
        ) : (
          title
        )}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
