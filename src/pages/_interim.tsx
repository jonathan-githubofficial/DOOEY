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
