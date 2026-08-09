import { changed, failed, fire, initialLoop, landed } from "./loop";

describe("rambler parse loop", () => {
  it("fires with a rising rev and refuses while one is in flight", () => {
    const first = fire(initialLoop);
    expect(first).not.toBeNull();
    expect(first!.rev).toBe(1);
    expect(fire(first!.state)).toBeNull();

    const after = landed(first!.state, 1);
    const second = fire(after.state);
    expect(second!.rev).toBe(2);
  });

  it("applies a landing that is the newest sent", () => {
    const { state } = fire(initialLoop)!;
    const result = landed(state, 1);
    expect(result.apply).toBe(true);
    expect(result.state.applied).toBe(1);
    expect(result.refire).toBe(false);
  });

  it("never applies a stale or repeated landing", () => {
    const { state } = fire(initialLoop)!;
    const once = landed(state, 1);
    // The same rev arriving again (or anything older) must not reapply.
    const again = landed(once.state, 1);
    expect(again.apply).toBe(false);
    const stale = landed(once.state, 0);
    expect(stale.apply).toBe(false);
  });

  it("refires when the transcript moved mid-flight", () => {
    const { state } = fire(initialLoop)!;
    const moved = changed(state);
    expect(moved.dirty).toBe(true);

    const result = landed(moved, 1);
    expect(result.apply).toBe(true);
    expect(result.refire).toBe(true);

    const next = fire(result.state);
    expect(next!.rev).toBe(2);
    expect(next!.state.dirty).toBe(false);
  });

  it("ignores changes while idle — the debounce handles those", () => {
    expect(changed(initialLoop)).toEqual(initialLoop);
  });

  it("keeps the last good draft on failure and refires if dirty", () => {
    const { state } = fire(initialLoop)!;
    const clean = failed(state);
    expect(clean.refire).toBe(false);
    expect(clean.state.applied).toBe(0);

    const { state: flying } = fire(clean.state)!;
    const result = failed(changed(flying));
    expect(result.refire).toBe(true);
  });
});
