// Binding geometry - MINIMAL forward-dependency stub (unit 4.3).
//
// The full <PlannerBook> pad component (static wire rings + page-flip motion) is OWNED BY UNIT 4.1
// (this unit's OUT OF BOUNDS list). But the L4 land order is 4.2 -> 4.3 -> 4.1 (ruling R4), so 4.3
// lands FIRST and its `AgendaSheet`/`TimeboxSheet` must compile against a real `./PlannerBook` for
// the shared binding-hole geometry (SPEC 6: the punched holes must line up with the pad's rings).
// So 4.3 ships ONLY the three shared layout constants here - the exact "stub ahead of the owner"
// pattern 4.2 used for `DueDateButton`. Unit 4.1 EXPANDS this file with the `<PlannerBook>`
// component (porting src-legacy/features/tasks/components/PlannerBook.tsx) and KEEPS these exports.
//
// Rings and the sheet's punched holes must agree: same slot count, same gutter, same slot width.

export const RING_COUNT = 3;
export const BINDING_ROW = "absolute inset-x-0 flex justify-between px-[16%]";
export const BINDING_SLOT = "flex w-3 justify-center";
