import {
  activeTagQuery,
  completeTag,
  harvestTags,
  openTag,
  suggestTags,
} from "./tags";



describe("openTag", () => {
  it("adds a hash with one space in front", () => {
    expect(openTag("Buy milk")).toBe("Buy milk #");
    expect(openTag("Buy milk ")).toBe("Buy milk #");
    expect(openTag("")).toBe("#");
  });
  it("does nothing when one is already waiting", () => {
    expect(openTag("Buy milk #")).toBe("Buy milk #");
  });
});

describe("activeTagQuery", () => {
  it("finds the tag being typed at the end", () => {
    expect(activeTagQuery("Buy milk #er")).toBe("er");
    expect(activeTagQuery("Buy milk #")).toBe("");
    expect(activeTagQuery("#GYM")).toBe("gym");
  });
  it("is null once the tag is finished or was never started", () => {
    expect(activeTagQuery("Buy milk #errands ")).toBeNull();
    expect(activeTagQuery("Buy milk")).toBeNull();
    expect(activeTagQuery("")).toBeNull();
  });
  it("ignores a tag earlier in the sentence", () => {
    expect(activeTagQuery("#work then buy milk")).toBeNull();
  });
});

describe("completeTag", () => {
  it("replaces what was typed and closes the tag with a space", () => {
    expect(completeTag("Buy milk #er", "errands")).toBe("Buy milk #errands ");
    expect(completeTag("Buy milk #", "gym")).toBe("Buy milk #gym ");
  });
});

describe("suggestTags", () => {
  it("offers the app's own tags before yours", () => {
    expect(suggestTags("", ["admin"], [])).toEqual(["gym", "food", "learning", "admin"]);
  });
  it("filters by what has been typed", () => {
    expect(suggestTags("g", ["garden", "admin"], [])).toEqual(["gym", "garden"]);
  });
  it("leaves out tags the task already carries", () => {
    expect(suggestTags("", ["admin"], ["gym", "admin"])).toEqual(["food", "learning"]);
  });
  it("never repeats a tag that is both reserved and in use", () => {
    expect(suggestTags("gy", ["gym"], [])).toEqual(["gym"]);
  });
});

describe("harvestTags", () => {
  it("lifts a tag out once a space closes it", () => {
    expect(harvestTags("Buy milk #errands ")).toEqual({ title: "Buy milk ", tags: ["errands"] });
  });
  it("leaves the tag still being typed alone", () => {
    expect(harvestTags("Buy milk #err")).toEqual({ title: "Buy milk #err", tags: [] });
  });
  it("keeps the words either side apart", () => {
    expect(harvestTags("Buy #shop milk")).toEqual({ title: "Buy milk", tags: ["shop"] });
  });
  it("takes several at once, deduped and lowercased", () => {
    expect(harvestTags("Plan #Work #work #home ")).toEqual({
      title: "Plan ",
      tags: ["work", "home"],
    });
  });
  it("leaves a plain title untouched", () => {
    expect(harvestTags("Buy milk")).toEqual({ title: "Buy milk", tags: [] });
  });
  it("ignores a bare hash", () => {
    expect(harvestTags("Read # this ")).toEqual({ title: "Read # this ", tags: [] });
  });
});
