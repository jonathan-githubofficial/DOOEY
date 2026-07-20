/** Interim guarded index for "/" until unit 4.1 lands the real Today page.
 *
 * SPEC step 6 (incremental-tree rule): the index MUST stay inside the guard (a signed-in
 * landing), so it cannot redirect out to /gallery; instead it renders a bare, nameless
 * authenticated placeholder. Unit 4.1 REPLACES this component with the real Today page.
 * Do NOT build product UI here.
 *
 * Crib "Elements, not HTML": <text> does not inherit CSS, so colour + size are set
 * explicitly on the node. */
export function InterimIndex() {
  return (
    <view>
      <text className="font-sans text-ink" style={{ color: "hsl(28 12% 14%)", fontSize: "16px" }}>
        loading...
      </text>
    </view>
  );
}

/** Interim space screens registered by unit 3.3 so the dock's typed navigations compile and
 * land somewhere real. Each is a bare <view><text> that the owning layer REPLACES with the real
 * page: /calendar -> 5.1, /boards -> 7.1, /projects -> 6.1. (/style was replaced by unit 3.4's
 * real Style page.) Do NOT build product UI here. The `data-testid` is the @l3 dock spec's
 * "target rendered" assertion hook. */
function InterimSpace({ title, testid }: { title: string; testid: string }) {
  return (
    <view data-testid={testid}>
      <text className="font-display text-3xl font-black tracking-tight text-ink">{title}</text>
    </view>
  );
}

export function InterimCalendar() {
  return <InterimSpace title="Calendar" testid="page-calendar" />;
}

export function InterimBoards() {
  return <InterimSpace title="Boards" testid="page-boards" />;
}

export function InterimProjects() {
  return <InterimSpace title="Projects" testid="page-projects" />;
}
