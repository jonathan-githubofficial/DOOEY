/// <reference path="../pb_data/types.d.ts" />

// Rambler: turns a spoken or typed ramble into a draft of tasks and entries.
// Stateless by design — the client sends the whole transcript on every call and
// gets back the complete intended state, so a mid-ramble correction
// ("...actually not the beach, the gym") needs no edit protocol: the next draft
// simply doesn't contain the beach.
//
// The client also sends the speaker's own trackers, and they are the ONLY
// vocabulary an entry may be routed into. The model does not get to invent an
// aspect: "food" is not special here, it is just the tracker most people happen
// to make first. Adding a tracker in the app is what teaches this route a word.
//
// The model is any OpenAI-compatible chat endpoint, configured by env:
//   RAMBLER_API_URL   e.g. https://api.deepseek.com/chat/completions
//   RAMBLER_API_KEY
//   RAMBLER_MODEL     e.g. deepseek-chat
//
// Nothing is written here. The client renders the draft and creates real
// records through the normal collections when the user confirms.

routerAdd(
  "POST",
  "/api/rambler/parse",
  (e) => {
    const body = e.requestInfo().body || {};
    const transcript = (typeof body.transcript === "string" ? body.transcript : "").trim();
    const rev = typeof body.rev === "number" ? body.rev : 0;
    const now = typeof body.now === "string" ? body.now.slice(0, 64) : "";
    const trackers = cleanTrackers(body.trackers);

    if (transcript.length > 4000) {
      throw new BadRequestError("transcript too long");
    }
    if (!transcript) {
      return e.json(200, { rev, entities: [] });
    }

    const messages = [
      { role: "system", content: systemPrompt(now, trackers) },
      { role: "user", content: transcript },
    ];

    let content = callModel(messages);
    let entities;
    try {
      entities = normalizeDraft(extractJson(content), trackers);
    } catch (err) {
      // One corrective round trip; the model sees its own bad output.
      content = callModel(
        messages.concat([
          { role: "assistant", content: content },
          {
            role: "user",
            content: "That reply was invalid (" + err + "). Reply again with only the corrected JSON object.",
          },
        ]),
      );
      entities = normalizeDraft(extractJson(content), trackers);
    }

    return e.json(200, { rev, entities });
  },
  $apis.requireAuth(),
);

function systemPrompt(now, trackers) {
  const lines = [
    "You turn one person's spoken rambling into planner items. You reply with a single JSON object and nothing else.",
    "",
    "The speaker's local date and time: " + (now || "unknown") + ".",
    "",
    'Shape: {"entities":[Entity,...]} — at most 12 entities, in the order they were settled on.',
    "",
    "Task — something to do:",
    '{"kind":"task","title":string,"date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"duration_min":number|null,"checklist":[string,...],"note":string|null}',
  ];

  if (trackers.length > 0) {
    lines.push(
      "",
      "Entry — something the speaker already did, ate, felt or measured:",
      '{"kind":"entry","tracker":<one of the slugs below>,"body":string,"value":number|null,"date":"YYYY-MM-DD","time":"HH:MM"|null}',
      "",
      "The ONLY trackers that exist. Never invent a slug; if what was said fits none of these, it is not an entry:",
    );
    for (const t of trackers) lines.push("- " + describeTracker(t));
  }

  lines.push(
    "",
    "Rules:",
    '- Return the COMPLETE final state for the whole transcript every time. When the speaker backtracks ("...actually not the beach, the gym"), only the final intent survives; the abandoned version does not appear at all.',
    '- Things to buy, bring, pack, or sub-steps of one errand belong in that task\'s "checklist", not as separate tasks.',
    '- "title" is short and plain, in the speaker\'s own language. Details that fit nowhere else go in "note".',
    '- "date" only when anchored ("today", "tomorrow", "on Friday" — resolve against the local date above); otherwise null.',
    '- "time" only when a clock time or clear moment is spoken; "duration_min" only when a length is stated.',
  );

  if (trackers.length > 0) {
    lines.push(
      '- A task is something still to be done; an entry is something already done. "I should eat better" is neither.',
      '- Entry "body" is the speaker\'s own words, kept as spoken — never itemized, never scored, never turned into nutrition or health data. It may be empty when a bare number was spoken.',
      '- Entry "date" is when it happened (usually today); "time" the moment if inferable ("breakfast" ~ "08:00", "lunch" ~ "12:30", "dinner" ~ "19:00", "before bed" ~ "22:30"), else null.',
    );
  }

  lines.push(
    "- Filler, greetings, and thinking out loud that asks for nothing produce no entity.",
    "- The transcript may end mid-sentence; parse only what is settled and ignore the dangling fragment.",
  );

  return lines.join("\n");
}

/** One tracker as the model needs to read it: what to call it, what the speaker
 * says out loud, and what belongs in "value". */
function describeTracker(t) {
  const head = '"' + t.slug + '" (' + t.name + "): ";
  if (t.shape === "scale") {
    return head + "a rating from 1 to " + t.max + '. Put the number in "value".';
  }
  if (t.shape === "amount") {
    return head + "an amount" + (t.unit ? " in " + t.unit : "") + '. Put the number in "value".';
  }
  if (t.shape === "duration") {
    return head + 'a length of time. Put the number of MINUTES in "value" (7 hours is 420).';
  }
  if (t.shape === "tick") {
    return head + 'that it happened, nothing measured. Leave "value" null.';
  }
  return head + 'words. Put what they said in "body" and leave "value" null.';
}

/** The client's tracker list, trusted only for its shape. A slug the model is
 * offered is a slug the client will resolve, so anything malformed is dropped
 * here rather than reaching the prompt. */
function cleanTrackers(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value.slice(0, 24)) {
    if (!raw || typeof raw !== "object") continue;
    const slug = cleanText(raw.slug, 30);
    const name = cleanText(raw.name, 40);
    if (!slug || !name) continue;
    out.push({
      slug: slug,
      name: name,
      shape: cleanText(raw.shape, 12) || "text",
      unit: cleanText(raw.unit, 12),
      max: typeof raw.max === "number" ? Math.round(raw.max) : 0,
    });
  }
  return out;
}

function callModel(messages) {
  const url = $os.getenv("RAMBLER_API_URL");
  const key = $os.getenv("RAMBLER_API_KEY");
  const model = $os.getenv("RAMBLER_MODEL");
  if (!url || !key || !model) {
    throw new ApiError(503, "rambler is not configured", null);
  }

  const res = $http.send({
    method: "POST",
    url: url,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      stream: false,
    }),
    timeout: 25,
  });

  if (res.statusCode !== 200) {
    throw new ApiError(502, "rambler provider error", null);
  }
  const choice = res.json && res.json.choices && res.json.choices[0];
  const content = choice && choice.message && choice.message.content;
  if (typeof content !== "string" || !content) {
    throw new ApiError(502, "rambler provider returned no content", null);
  }
  return content;
}

// Providers in JSON mode still occasionally wrap the object in prose or fences.
function extractJson(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(content.slice(start, end + 1));
}

// Lenient: a malformed entity is dropped, not fatal. Only a wrong top-level
// shape throws (and earns the corrective retry).
function normalizeDraft(value, trackers) {
  if (!value || typeof value !== "object" || !Array.isArray(value.entities)) {
    throw new Error('top level must be {"entities":[...]}');
  }
  const shapes = {};
  for (const t of trackers) shapes[t.slug] = t.shape;
  const out = [];
  for (const raw of value.entities.slice(0, 12)) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.kind === "task") {
      const title = cleanText(raw.title, 200);
      if (!title) continue;
      out.push({
        kind: "task",
        title: title,
        date: cleanDate(raw.date),
        time: cleanTime(raw.time),
        duration_min: cleanMinutes(raw.duration_min),
        checklist: cleanList(raw.checklist),
        note: cleanText(raw.note, 1000) || null,
      });
    } else if (raw.kind === "entry") {
      // An invented slug is the one failure worth being strict about: the
      // client resolves it to a real record, and there is nothing sensible to
      // file "sleep" under when the speaker never made a sleep tracker.
      const slug = cleanText(raw.tracker, 30);
      const shape = shapes[slug];
      if (!shape) continue;
      const measures = shape === "scale" || shape === "amount" || shape === "duration";
      const text = cleanText(raw.body, 2000);
      const value = measures ? cleanValue(raw.value) : null;
      // Words or a number; an entry carrying neither says nothing. A tick is
      // the exception: that it happened is the whole record.
      if (!text && value === null && shape !== "tick") continue;
      out.push({
        kind: "entry",
        tracker: slug,
        body: text,
        value: value,
        date: cleanDate(raw.date),
        time: cleanTime(raw.time),
      });
    }
  }
  return out;
}

function cleanText(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function cleanDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function cleanTime(v) {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

function cleanMinutes(v) {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 480 ? n : null;
}

// A measured value. Rounded to one decimal because that is as fine as anything
// spoken aloud gets, and negative readings are a misparse, not a measurement.
function cleanValue(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 10) / 10;
}

function cleanList(v) {
  if (!Array.isArray(v)) return [];
  const items = [];
  for (const item of v.slice(0, 20)) {
    const text = cleanText(item, 200);
    if (text) items.push(text);
  }
  return items;
}
