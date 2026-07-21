// Shared id helper (unit 4.2 SPEC 9). PrimJS may lack `crypto`/`crypto.randomUUID`, and the
// Lynx web worker has no guaranteed WebCrypto either, so the old `crypto.randomUUID()` calls
// (Checklist/Resources item ids) are replaced by this dependency-free generator: a base-36
// timestamp plus a monotonic in-process counter, which is unique enough for client-side record
// ids that PocketBase never keys on (they live inside the task's `checklist`/`resources` JSON).
let counter = 0;

/** A unique-per-process string id, no `crypto` dependency. */
export function newId(): string {
  counter = (counter + 1) % 0x100000;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
