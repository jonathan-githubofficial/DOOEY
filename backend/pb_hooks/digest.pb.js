/// <reference path="../pb_data/types.d.ts" />

// The week, read back in words.
//
// **Every number in the request was already counted by the client**, by a pure
// function under test (`features/digest/digest.ts`). This route exists to
// choose words, and it is told so in the strongest terms the prompt can manage:
// it may not do arithmetic, it may not add a number that is not in front of it,
// and it may not explain why anything happened.
//
// That last one is the whole reason this is a narrow endpoint and not a chat.
// One person logging for a year is fifty-two data points. "You sleep worse when
// you train late" drawn from six of them is a guess wearing the clothes of a
// finding, and it is exactly the kind of sentence a language model produces
// happily and a reader believes immediately.
//
// The client shows the numbers before this is ever called and keeps showing
// them if it fails. Nothing here is load-bearing.
//
// Same provider config as the rambler:
//   RAMBLER_API_URL, RAMBLER_API_KEY, RAMBLER_MODEL

routerAdd(
  "POST",
  "/api/digest/narrate",
  (e) => {
    const body = e.requestInfo().body || {};
    const digest = body.digest;
    if (!digest || typeof digest !== "object") {
      throw new BadRequestError("digest required");
    }

    const facts = JSON.stringify(digest);
    // A digest is a few hundred bytes of counted numbers. Anything approaching
    // this size is not one.
    if (facts.length > 20000) {
      throw new BadRequestError("digest too large");
    }

    const url = $os.getenv("RAMBLER_API_URL");
    const key = $os.getenv("RAMBLER_API_KEY");
    const model = $os.getenv("RAMBLER_MODEL");
    if (!url || !key || !model) {
      throw new ApiError(503, "the writer is not configured", null);
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
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: facts },
        ],
        // Not zero: this is the one call in the app whose job is wording, and
        // a little room makes the difference between a sentence and a
        // spreadsheet read aloud. Low enough that it stays factual.
        temperature: 0.4,
        max_tokens: 260,
        stream: false,
      }),
      timeout: 25,
    });

    if (res.statusCode !== 200) {
      throw new ApiError(502, "the writer is unavailable", null);
    }
    const choice = res.json && res.json.choices && res.json.choices[0];
    const text = choice && choice.message && choice.message.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new ApiError(502, "the writer returned nothing", null);
    }

    return e.json(200, { text: text.trim() });
  },
  $apis.requireAuth(),
);

const SYSTEM = [
  "You read one person's week back to them. You are given a JSON object of numbers that have ALREADY been counted. Reply with plain prose and nothing else: no JSON, no markdown, no headings, no bullet points.",
  "",
  "Two or three sentences. Forty to seventy words. Second person, past tense, the tone of a friend who kept the score and is handing it back, not a coach and not a wellness app.",
  "",
  "Hard rules:",
  "- Never calculate anything. Every number you use must appear in the object exactly as given. If a number is not there, you do not know it.",
  "- Never explain WHY. No causes, no correlations, no 'because', no 'which suggests', no linking two things that both happened. You have one person and one week; that is not evidence of anything.",
  "- Never advise, encourage, congratulate, worry, or tell them to keep it up. Report the week. They will decide how it went.",
  "- `meanDelta: null` means there were too few readings to compare. Say nothing at all about the change. Do not call it steady, flat, or unchanged.",
  "- `quiet` lists things they logged last week and not this week. Worth one clause, stated plainly, with no suggestion that it matters.",
  "- `words` are their own phrases. You may quote one if it is vivid. Never rewrite, interpret, score, or draw conclusions from what they ate, felt or did.",
  "- Lead with whatever is largest or most changed. If the week is thin, say so briefly rather than padding it.",
  "",
  "Units: `duration` values are MINUTES (420 is seven hours) and read as hours and minutes. `volume` is total weight moved. `minutes` under workouts is time trained.",
].join("\n");
