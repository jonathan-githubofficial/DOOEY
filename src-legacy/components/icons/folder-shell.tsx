/** The folder silhouette shared by project folders and board folders: a
 * contoured tab flowing into the body, stretched to whatever box it fills. */
export function FolderShell({ fill, className }: { fill: string; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 88"
      preserveAspectRatio="none"
      className={className ?? "absolute inset-0 h-full w-full"}
    >
      <path
        d="M 0 78 V 10 Q 0 0 8 0 H 30 Q 36 0 40 5 L 44 10 Q 47 14 53 14 H 92 Q 100 14 100 24 V 78 Q 100 88 92 88 H 8 Q 0 88 0 78 Z"
        fill={fill}
      />
    </svg>
  );
}
