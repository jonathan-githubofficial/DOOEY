/** A hashtag is a way of *typing* a tag, not a way of keeping one.
 *
 * You write `buy milk #errands`, and the moment the space lands the word leaves
 * the sentence and becomes a chip beneath it. Titles are stored plain, and
 * every screen that shows one shows it plain, with the tags as their own
 * objects under the title and its one-liner.
 *
 * That is also what keeps this free of the two things React Native cannot do
 * inside a text field: styled runs and caret geometry. By the time a tag is a
 * tag, it isn't text any more, so there is nothing to highlight in place and
 * nothing to anchor a popup to.
 *
 * Tag bodies are "anything that isn't a space or another hash" rather than a
 * unicode property escape (`\p{L}`) — Hermes hasn't always carried those, and
 * this tags "#travail" and "#日本語" just as well.
 */

/** Punctuation that ends a sentence rather than belonging to the tag, so
 * "call mum #family." tags "family". */
const TRAILING = /[.,;:!?)\]}'"]+$/;

function clean(raw: string): string {
  return raw.replace(TRAILING, "").toLowerCase();
}




/** Append a fresh `#` for someone about to type a tag, with exactly one space
 * in front of it and nothing doubled up if they tap twice. */
export function openTag(title: string): string {
  if (title.endsWith("#")) return title;
  return title.length === 0 || title.endsWith(" ") ? `${title}#` : `${title} #`;
}

/** The tags the app itself means something by.
 *
 * Everything else is yours and comes into being the moment you type it. These
 * three exist up front because a space in the app answers to them: a task
 * tagged `#gym` is training, `#food` is the journal, `#learning` is a programme
 * session. They are offered first in the picker and can't be un-invented by
 * deleting the last task that used one. */
export const RESERVED_TAGS: { tag: string; hint: string }[] = [
  { tag: "gym", hint: "training" },
  { tag: "food", hint: "what you ate" },
  { tag: "learning", hint: "a programme session" },
];

const RESERVED_SET = new Set(RESERVED_TAGS.map((r) => r.tag));

export function isReserved(tag: string): boolean {
  return RESERVED_SET.has(tag);
}

/** The tag being typed right now, or null.
 *
 * Only ever the one at the very end of the title, which is where a tag is
 * being written — a `#` earlier in the sentence is already finished. That
 * keeps the picker off the caret API entirely: no selection tracking, no
 * platform differences, and it can never open over a tag you aren't editing.
 * An empty string means the `#` is there with nothing after it yet. */
export function activeTagQuery(title: string): string | null {
  const m = title.match(/#([^\s#]*)$/);
  return m ? m[1].toLowerCase() : null;
}

/** Swap the tag being typed for a finished one, with the trailing space that
 * closes it — so the picker shuts and the next word is plain text again. */
export function completeTag(title: string, tag: string): string {
  return `${title.replace(/#[^\s#]*$/, "")}#${tag} `;
}

/** The picker's list: reserved tags first, then yours, filtered by what has
 * been typed so far. Anything already on the task is left out — offering a tag
 * a second time would just be a no-op you had to read past. */
export function suggestTags(query: string, known: string[], already: string[]): string[] {
  const seen = new Set(already);
  const ordered = [...RESERVED_TAGS.map((r) => r.tag), ...known];
  const out: string[] = [];
  for (const tag of ordered) {
    if (seen.has(tag) || !tag.startsWith(query)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Lift the finished tags out of a title.
 *
 * A tag is finished the moment it is followed by a space — that keystroke is
 * what turns `#gym` from text you are typing into a thing the task carries. So
 * the composer harvests on every change: the word leaves the field and appears
 * as a coloured chip beneath it, and the title you are left with is the plain
 * sentence.
 *
 * The tag still being typed (no space after it yet) is deliberately left in
 * place — pulling it out mid-word would fight the person writing it.
 *
 * This is also why nothing in the app has to render styled runs inside a
 * TextInput or find the caret: by the time a tag is a tag, it isn't in the
 * text any more. */
export function harvestTags(title: string): { title: string; tags: string[] } {
  const tags: string[] = [];
  const rest = title.replace(/#([^\s#]+)(\s)/g, (_m, body: string, space: string) => {
    const tag = clean(body);
    if (!tag) return `#${body}${space}`;
    if (!tags.includes(tag)) tags.push(tag);
    // Keep the separator, or "buy #a milk" would close up into "buymilk".
    return space;
  });
  // Collapse the double spaces a lifted tag leaves behind, but never trim the
  // trailing one — that space is the caret's position.
  return { title: rest.replace(/ {2,}/g, " ").replace(/^ /, ""), tags };
}
