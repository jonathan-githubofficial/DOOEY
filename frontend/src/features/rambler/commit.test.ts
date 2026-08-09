import { dayKeyOf, entryAtFrom, minutesOf, taskParamsFrom } from "./commit";
import type { EntryDraft, TaskDraft } from "./types";

const NOW = new Date("2026-07-29T18:30:00");

const task = (over: Partial<TaskDraft>): TaskDraft => ({
  kind: "task",
  title: "Groceries",
  date: null,
  time: null,
  duration_min: null,
  checklist: [],
  note: null,
  ...over,
});

const entry = (over: Partial<EntryDraft>): EntryDraft => ({
  kind: "entry",
  tracker: "food",
  body: "two eggs and toast",
  value: null,
  date: null,
  time: null,
  ...over,
});

describe("minutesOf", () => {
  it("converts HH:MM to minutes from midnight", () => {
    expect(minutesOf("07:30")).toBe(450);
    expect(minutesOf("19:00")).toBe(1140);
  });

  it("treats no time as unscheduled", () => {
    expect(minutesOf(null)).toBe(0);
    expect(minutesOf("00:00")).toBe(0);
  });
});

describe("taskParamsFrom", () => {
  it("leaves an unanchored task unscheduled", () => {
    const params = taskParamsFrom(task({}), NOW);
    expect(params.due_date).toBeUndefined();
    expect(params.start_min).toBeUndefined();
    expect(params.dur_min).toBeUndefined();
    expect(params.checklist).toEqual([]);
  });

  it("stores a spoken date in PB's date-only form", () => {
    const params = taskParamsFrom(task({ date: "2026-07-30" }), NOW);
    expect(params.due_date).toBe("2026-07-30 00:00:00.000Z");
  });

  it("lands a time with no date on today", () => {
    const params = taskParamsFrom(task({ time: "19:00" }), NOW);
    expect(params.due_date).toBe(`${dayKeyOf(NOW)} 00:00:00.000Z`);
    expect(params.start_min).toBe(1140);
    expect(params.dur_min).toBe(60);
  });

  it("honours a spoken duration", () => {
    const params = taskParamsFrom(task({ time: "07:00", duration_min: 45 }), NOW);
    expect(params.dur_min).toBe(45);
  });

  it("turns spoken items into unchecked checklist entries with unique ids", () => {
    const params = taskParamsFrom(task({ checklist: ["milk", "eggs", "bread"] }), NOW);
    expect(params.checklist!.map((c) => c.label)).toEqual(["milk", "eggs", "bread"]);
    expect(params.checklist!.every((c) => !c.done)).toBe(true);
    expect(new Set(params.checklist!.map((c) => c.id)).size).toBe(3);
  });

  it("carries the note into the task's notes", () => {
    expect(taskParamsFrom(task({ note: "the good bakery" }), NOW).notes).toBe("the good bakery");
  });
});

describe("entryAtFrom", () => {
  it("uses the spoken time on the spoken day", () => {
    const at = entryAtFrom(entry({ date: "2026-07-28", time: "12:30" }), NOW);
    expect(at).toEqual(new Date("2026-07-28T12:30:00"));
  });

  it("falls back to right now for today", () => {
    expect(entryAtFrom(entry({}), NOW)).toEqual(NOW);
  });

  it("files a past day without a time at local noon, keeping it on that day", () => {
    const at = entryAtFrom(entry({ date: "2026-07-27" }), NOW);
    expect(at).toEqual(new Date("2026-07-27T12:00:00"));
    expect(dayKeyOf(at)).toBe("2026-07-27");
  });
});
