# Project handoff — "Launch": a personal command center

*Single-file export of the full design session. Paste this whole document into a Claude Code session as context, then use the build brief in Section 3.*

---

## 0 · Quick-start prompt for Claude Code

> Copy the block below into your Claude Code session to kick it off:

```
I'm turning a single-file HTML prototype into a real, synced web app. This document
contains the full context, the seed data, and the complete current source (Section 4).

Goal: a personal "command center" that tracks four parallel efforts converging on a
trip to Paris on 2026-08-16 — (1) learning French, (2) a gym program, (3) studying for
the AWS SAA-C03 exam, and (4) planning a France/Portugal/Spain/Germany trip.

Please read Sections 1–3, then scaffold the project described in the build brief
(Section 3). Start by proposing a stack and folder structure, then implement the data
model and port the existing UI from Section 4. Keep the "trust" principles in Section 2.
```

---

## 1 · Context & goals

One person, four efforts, one deadline. Everything converges on **Aug 16, 2026**, when they fly to Paris to meet their girlfriend for a long stay. The window runs **Jul 13 → Aug 16, 2026**.

| Track | Goal (observable) | Deadline | Reality check (agreed) |
|---|---|---|---|
| **French** | Go from "simple sentences, slowly" to confidently ordering, shopping, asking directions, and basic social interaction on the trip | **Aug 15** (day before flight) | Realistic with ~25 min/day |
| **Gym** | Rebuild the habit, master technique, gain measurable strength ("gain muscle") | **Aug 14** | Honest framing: a month = habit + technique + strength base; **visible size is a 3+ month arc** |
| **AWS SAA-C03** | Cover all 4 exam domains and **book the exam** | User-set target | ~60–120 hrs study; Security domain (30%) is the #1 failure point |
| **Euro trip** | Places, stays, day-by-day plan, live budget + student savings | Flexible (from Paris) | Planning deliverable, not daily practice |

Constraints: works 9–5 with a 12–1 lunch break (used as a French micro-review slot); gym 3–4×/week (programmed Mon/Wed/Fri).

---

## 2 · Design principles to preserve

The original ask was for something **robust and trustworthy** — the opposite of a generic AI-generated planner. Three pillars drove every decision and should survive the rewrite:

1. **Grounding** — curricula are built from cited authoritative sources, never invented. Sources used:
   - *French A2 ordering* — Alliance Française A2 breakdown; Language Teams A1→A2 course modules; Lawless French CEFR sequencing.
   - *Gym* — evidence-based hypertrophy consensus: full-body 3×/week, non-consecutive days, compound-focused, 6–12 reps, 10–20 sets/muscle/week, double progression (Science for Sport, Weightology, beginner full-body guides).
   - *AWS* — official SAA-C03 exam guide: **65 questions, 130 min, pass 720/1000, $150, valid 3 yrs.** Domains & weights: Design Secure Architectures **30%**, Resilient **26%**, High-Performing **24%**, Cost-Optimized **20%**.
2. **Verification** — progress is gated by tests with pass criteria written *up front* (see TESTS.md, Section 5), not by days elapsed. Failing a gate triggers remediation, never silent advancement.
3. **Honesty** — unrealistic goals are named and reframed (the gym example above). No fantasy plans.

**App design direction** (keep or evolve deliberately): the interface spine is the convergence on Aug 16 — a live launch countdown and a "runway" timeline where all deadlines sit on one axis, with a shaded *launch-window* band (Aug 14–16) instead of overlapping pins. Cool-paper palette (#EAEEF4), ink #141C2B, per-track accents (French #4C6EF5, Gym #E64980, AWS #F08C00, Trip #0CA678). Type: Space Grotesk (display), Inter (body), JetBrains Mono (data/countdown). Deliberately avoids the cream+serif+terracotta AI-default look.

---

## 3 · Build brief for Claude Code

Turn the single-file prototype (Section 4) into a real product.

**Suggested stack:** Next.js (App Router) + TypeScript + Tailwind, with a small persistence layer (SQLite/Prisma locally, or Supabase for cross-device sync + auth). Keep it deployable to Vercel.

**Milestones**
1. **Scaffold & port** — project structure, design tokens from Section 2, port the four track views + dashboard from Section 4 as components.
2. **Data model** — entities: `Track`, `Session` (French day / gym session), `Gate` (with pass criteria), `LogEntry` (append-only), `AwsTopic`, `TripPlace`, `TripStay`, `ItineraryLeg`, `CostLine`. Seed from Sections 5–6.
3. **Persistence & sync** — replace the in-browser store with real storage; add auth so it syncs across phone + laptop.
4. **Editable schedule → calendar** — let the user shift/skip sessions; regenerate a downloadable `.ics` on change (generator logic is in Section 6).
5. **Live data (stretch)** — trip: flight/hostel price lookups + a map; study: link resources; reminders/notifications for "today's session".
6. **Keep the trust mechanics** — gates with pre-written criteria, append-only log, cited sources visible in the UI.

**Non-negotiables:** append-only history; gate criteria never softened at runtime; cost numbers are user-editable estimates, labelled as such.

---

## 4 · Current single-file app — full source

Save as `command-center.html` to run as-is. This is the reference implementation to port.

````html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Launch — personal command center</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root{
  --bg:#EAEEF4; --surface:#FFFFFF; --surface-2:#F5F7FB;
  --ink:#141C2B; --ink-2:#4A5568; --ink-3:#8A94A6;
  --line:#DCE2EC; --line-2:#EDF1F7;
  --french:#4C6EF5; --gym:#E64980; --aws:#F08C00; --trip:#0CA678;
  --cobalt:#2952E3; --signal:#141C2B;
  --shadow:0 1px 2px rgba(20,28,43,.04),0 8px 24px rgba(20,28,43,.06);
  --disp:'Space Grotesk',system-ui,sans-serif;
  --body:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:24px 20px 80px}
h1,h2,h3{font-family:var(--disp);margin:0;letter-spacing:-.01em}
a{color:var(--cobalt)}
button{font-family:var(--body);cursor:pointer}
.mono{font-family:var(--mono)}

/* ---- Header / hero ---- */
.hero{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);padding:26px 28px;margin-bottom:18px;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle at center,rgba(41,82,227,.10),transparent 70%)}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3)}
.hero h1{font-size:30px;margin:6px 0 2px;font-weight:700}
.hero .sub{color:var(--ink-2);font-size:14px}
.count-row{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-end;margin-top:20px}
.count-main{display:flex;align-items:baseline;gap:4px}
.count-main .num{font-family:var(--mono);font-weight:700;font-size:56px;line-height:.9;color:var(--ink);letter-spacing:-.02em}
.count-main .lbl{font-family:var(--mono);font-size:12px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.1em;margin-left:6px}
.count-sub{font-size:13px;color:var(--ink-2)}
.count-sub b{font-family:var(--mono);color:var(--ink)}

/* ---- Runway timeline ---- */
.runway{margin-top:22px;padding-top:18px;border-top:1px dashed var(--line)}
.runway-track{position:relative;height:46px;margin-top:30px}
.runway-line{position:absolute;left:0;right:0;top:22px;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 8px,transparent 8px 16px)}
.runway-fill{position:absolute;left:0;top:21px;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--cobalt),#5B7BFF)}
.runway-start{position:absolute;top:30px;left:0;font-family:var(--mono);font-size:10px;color:var(--ink-3);letter-spacing:.05em}
.runway-window{position:absolute;top:14px;height:18px;border-radius:9px;background:rgba(20,28,43,.05);border:1px dashed var(--ink-3)}
.runway-window .wlab{position:absolute;bottom:24px;right:0;font-family:var(--mono);font-size:10px;color:var(--ink-2);white-space:nowrap;letter-spacing:.04em}
.today-pin{position:absolute;top:22px;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:var(--cobalt);border:3px solid #fff;box-shadow:0 0 0 4px rgba(41,82,227,.18);z-index:3}
.today-pin .plabel{position:absolute;top:22px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:var(--mono);font-size:10px;font-weight:700;color:var(--cobalt)}
.today-pin.near-end .plabel{left:auto;right:0;transform:none}
.runway-legend{display:flex;gap:8px 18px;flex-wrap:wrap;margin-top:16px;font-family:var(--mono);font-size:11px}
.runway-legend span{display:flex;align-items:center;gap:7px;color:var(--ink-2)}
.runway-legend i{width:9px;height:9px;border-radius:3px;flex:none}
.runway-legend b{color:var(--ink);font-weight:500}

/* ---- Nav ---- */
.nav{display:flex;gap:6px;flex-wrap:wrap;margin:18px 0}
.nav button{border:1px solid var(--line);background:var(--surface);color:var(--ink-2);padding:9px 15px;border-radius:11px;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;transition:.15s}
.nav button .swatch{width:9px;height:9px;border-radius:3px;background:var(--ink-3)}
.nav button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.nav button.active .swatch{background:#fff}
.nav button:hover:not(.active){border-color:var(--ink-3)}

/* ---- Cards grid (dashboard) ---- */
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:20px 22px}
.card.click{cursor:pointer;transition:.15s}
.card.click:hover{transform:translateY(-2px);box-shadow:0 4px 8px rgba(20,28,43,.06),0 16px 40px rgba(20,28,43,.09)}
.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.tag{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:4px 8px;border-radius:6px;font-weight:500}
.card h3{font-size:19px;margin-top:12px}
.card .goal{color:var(--ink-2);font-size:13.5px;margin-top:3px;min-height:38px}
.card .next{margin-top:14px;padding:11px 13px;background:var(--surface-2);border-radius:11px;font-size:13px}
.card .next .k{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
.card .next .v{color:var(--ink);font-weight:500;margin-top:2px}

/* progress ring */
.ring-wrap{display:flex;align-items:center;gap:12px;margin-top:16px}
.ring{position:relative;width:52px;height:52px;flex:none}
.ring svg{transform:rotate(-90deg)}
.ring .pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:13px;font-weight:700}
.ring-meta{font-size:12.5px;color:var(--ink-2)}
.ring-meta b{color:var(--ink)}

/* ---- Detail panels ---- */
.panel-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.panel-head h2{font-size:24px}
.panel-head .desc{color:var(--ink-2);font-size:14px;margin-top:4px;max-width:640px}
.bar{height:8px;border-radius:6px;background:var(--line-2);overflow:hidden;margin-top:14px}
.bar > i{display:block;height:100%;border-radius:6px}

/* checklist rows */
.list{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.phase-h{padding:12px 18px;background:var(--surface-2);font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);border-top:1px solid var(--line)}
.phase-h:first-child{border-top:none}
.row{display:flex;align-items:center;gap:14px;padding:12px 18px;border-top:1px solid var(--line-2)}
.row:hover{background:var(--surface-2)}
.row.gate{background:linear-gradient(90deg,rgba(240,140,0,.06),transparent)}
.row.done .txt{color:var(--ink-3);text-decoration:line-through}
.row.today-row{box-shadow:inset 3px 0 0 var(--cobalt)}
.cb{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);flex:none;display:flex;align-items:center;justify-content:center;transition:.12s}
.cb.on{background:var(--ok,var(--cobalt));border-color:var(--ok,var(--cobalt));color:#fff}
.cb svg{width:13px;height:13px;opacity:0;transition:.12s}
.cb.on svg{opacity:1}
.row .idx{font-family:var(--mono);font-size:12px;color:var(--ink-3);width:52px;flex:none}
.row .txt{flex:1;font-size:14px}
.row .date{font-family:var(--mono);font-size:11.5px;color:var(--ink-3);white-space:nowrap}
.row .badge{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:5px;color:#fff}

/* ---- AWS domains ---- */
.dom{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:18px 20px;margin-bottom:12px}
.dom-h{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dom-h h3{font-size:16px}
.weight{font-family:var(--mono);font-size:12px;color:#fff;background:var(--aws);padding:3px 9px;border-radius:6px;font-weight:700}
.dom .topics{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chip{border:1px solid var(--line);background:var(--surface-2);border-radius:9px;padding:7px 11px;font-size:12.5px;display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none}
.chip .mini{width:15px;height:15px;border-radius:5px;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center}
.chip.on{border-color:var(--aws);background:rgba(240,140,0,.08)}
.chip.on .mini{background:var(--aws);border-color:var(--aws)}
.chip.on .mini::after{content:"✓";color:#fff;font-size:10px;line-height:1}
.chip.on .lab{color:var(--ink-3);text-decoration:line-through}

/* ---- Trip sub tabs ---- */
.subnav{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.subnav button{border:1px solid var(--line);background:var(--surface);color:var(--ink-2);padding:7px 13px;border-radius:9px;font-size:13px;font-weight:500}
.subnav button.active{background:var(--trip);color:#fff;border-color:var(--trip)}
.country-h{font-family:var(--disp);font-weight:600;font-size:15px;margin:16px 0 8px;display:flex;align-items:center;gap:9px}
.flag{font-size:18px}
.places{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px}
.place{border:1px solid var(--line);background:var(--surface);border-radius:11px;padding:11px 13px;cursor:pointer;display:flex;gap:10px;align-items:flex-start}
.place.on{border-color:var(--trip);background:rgba(12,166,120,.06)}
.place .mini{width:18px;height:18px;border-radius:6px;border:2px solid var(--line);flex:none;margin-top:1px;display:flex;align-items:center;justify-content:center}
.place.on .mini{background:var(--trip);border-color:var(--trip)}
.place.on .mini::after{content:"✓";color:#fff;font-size:11px}
.place .nm{font-weight:600;font-size:13.5px}
.place .ds{font-size:12px;color:var(--ink-2);margin-top:1px}

/* cost table */
.costs{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.ctr{display:grid;grid-template-columns:1fr 70px 90px 100px;gap:10px;align-items:center;padding:11px 16px;border-top:1px solid var(--line-2)}
.ctr.head{background:var(--surface-2);font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);border-top:none}
.ctr input{border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--mono);font-size:13px;width:100%;text-align:right;color:var(--ink)}
.ctr input.label{text-align:left;font-family:var(--body);font-size:13.5px}
.ctr .line-tot{font-family:var(--mono);font-size:13px;text-align:right;color:var(--ink)}
.cost-total{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;background:var(--ink);color:#fff}
.cost-total .lbl{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
.cost-total .amt{font-family:var(--mono);font-size:26px;font-weight:700}
.note{font-size:12.5px;color:var(--ink-2);margin-top:10px}

/* tips */
.tips{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.tips li{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 15px;font-size:13.5px;display:flex;gap:11px}
.tips li .t{font-family:var(--mono);font-size:11px;color:var(--trip);font-weight:700;flex:none;margin-top:1px}

/* itinerary */
.leg{display:grid;grid-template-columns:26px 1fr 70px;gap:12px;align-items:center;padding:11px 16px;border-top:1px solid var(--line-2)}
.leg .n{font-family:var(--mono);color:var(--ink-3);font-size:12px}
.leg input{border:1px solid var(--line);border-radius:8px;padding:7px 9px;font-size:13px;width:100%;font-family:var(--body)}
.leg input.nights{font-family:var(--mono);text-align:center}

.small-input{border:1px solid var(--line);border-radius:9px;padding:8px 11px;font-family:var(--mono);font-size:13px}
.hint{font-size:12px;color:var(--ink-3);margin-top:6px;font-family:var(--mono)}
.saved-flash{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:9px 18px;border-radius:10px;font-size:13px;font-family:var(--mono);opacity:0;transition:.25s;pointer-events:none;z-index:20}
.saved-flash.show{opacity:1;transform:translateX(-50%) translateY(0)}
.foot{margin-top:26px;font-size:12px;color:var(--ink-3);text-align:center;line-height:1.7}
.reset{background:none;border:1px solid var(--line);color:var(--ink-3);padding:6px 12px;border-radius:8px;font-size:12px}
@media(max-width:720px){
  .grid{grid-template-columns:1fr}
  .count-main .num{font-size:44px}
  .ctr{grid-template-columns:1fr 54px 74px 78px;gap:6px}
  .hero{padding:20px}
}
</style>

<div class="wrap">
  <div class="hero">
    <div class="eyebrow">Personal command center</div>
    <h1>Everything points to Paris.</h1>
    <div class="sub">Four efforts, one launch window. Here's where you stand.</div>
    <div class="count-row">
      <div>
        <div class="count-main"><span class="num" id="cd-days">–</span><span class="lbl">days<br>to&nbsp;flight</span></div>
      </div>
      <div class="count-sub" id="cd-detail"></div>
    </div>
    <div class="runway">
      <div class="eyebrow">Runway · Jul 13 → Aug 16</div>
      <div class="runway-track" id="runway"></div>
      <div class="runway-legend" id="legend"></div>
    </div>
  </div>

  <div class="nav" id="nav"></div>
  <div id="view"></div>

  <div class="foot">
    Progress saves automatically on this device. Content is grounded in cited sources (CEFR A2 course structure, evidence-based hypertrophy guidance, and the official AWS SAA-C03 exam guide).<br>
    <button class="reset" id="reset">Reset all progress</button>
  </div>
</div>
<div class="saved-flash" id="flash">saved ✓</div>

<script>
/* ============ storage (window.storage with in-memory shim) ============ */
const KEY='launch-command-center-v1';
const mem={};
const store={
  async get(k){ if(window.storage) return window.storage.get(k); return mem[k]?{value:mem[k]}:null; },
  async set(k,v){ if(window.storage) return window.storage.set(k,v); mem[k]=v; return {value:v}; }
};

/* ============ dates ============ */
const FLIGHT=new Date('2026-08-16T00:00:00');
function d(y,m,day){return new Date(y,m-1,day);}
function iso(dt){return dt.toISOString().slice(0,10);}
function fmt(dt){return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}
function today(){const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate());}
function addDays(dt,n){const x=new Date(dt);x.setDate(x.getDate()+n);return x;}
function daysBetween(a,b){return Math.round((b-a)/864e5);}

/* ============ seed data ============ */
const START=d(2026,7,13);
const frTopics=["Politesse: bonjour, merci, s'il vous plaît, excusez-moi; tu vs vous","Numbers 0–69; asking « c'est combien ? »","Numbers 70–100; prices, paying, coins & notes","Café basics: « je voudrais un café, s'il vous plaît »","Restaurant: menu words, « l'addition », water, allergies","Café/restaurant full order practice + polite requests","GATE 1 — Order a full café/restaurant meal (roleplay)","Directions: « où est…? », gauche / droite / tout droit","Transport: métro, billet, « un aller simple / retour »","Train station & buying tickets; times & schedules","Shops: « je cherche… », « vous avez…? », sizes","Quantities & groceries: un peu, beaucoup, une bouteille de","Getting-around review + shop roleplay practice","GATE 2 — Navigate a route + shop for items (roleplay)","Meeting people: introductions, « enchanté », origin, job","Small talk: weather, weekend, responding to « ça va ? »","Likes / dislikes: « j'aime / je n'aime pas », preferences","Meeting your girlfriend's family & friends: polite phrases","Making plans: « on peut…? », proposing, agreeing","Phone / reservation: « je voudrais réserver une table »","GATE 3 — Social scene: meet, small talk, make a plan","Passé composé basics: « j'ai mangé, je suis allé »","Talking about your day / what you did","Problems & complaints: « il y a une erreur », service issues","Pharmacy & health: « j'ai mal à… », basic needs","Emergencies & help: « pouvez-vous m'aider ? »","Combined scenario A: arrival, taxi, apartment / hotel","Combined scenario B: café + shopping + directions","Heavy spaced review: weakest items from your log","Combined scenario C: social evening + making plans","Listening focus: fast speech, asking someone to repeat","Full dry-run of the final gate (practice, untested)","Targeted review of any remaining weak items","FINAL GATE — Sustained multi-scene travel roleplay"];
const frGates=new Set([7,14,21,34]);
const frPhases=[[1,"Phase 1 · Survival & politeness"],[8,"Phase 2 · Getting around & shops"],[15,"Phase 3 · Social interaction"],[22,"Phase 4 · Consolidation & real scenarios"]];

// gym M/W/F Jul13→Aug14
const gymDates=[];{let x=new Date(START);while(x<=d(2026,8,14)){if([1,3,5].includes(x.getDay()))gymDates.push(new Date(x));x=addDays(x,1);}}
const gym=gymDates.map((dt,i)=>{
  const ab=i%2===0?'A':'B';
  const gate=iso(dt)===iso(d(2026,8,14));
  let label=`Workout ${ab} — progressive overload`;
  if(dt<addDays(START,7)) label=`Workout ${ab} — technique focus (light, learn the lifts)`;
  if(gate) label=`GATE — Workout ${ab} + technique & progress check`;
  return {dt,label,gate};
});
const workoutA=["Squat (goblet/back) 3×8–12","Bench / DB press 3×8–12","Lat pulldown / assisted pull-up 3×8–12","Seated row 3×10–12","DB shoulder press 2×10–12","Plank 3×30–45s"];
const workoutB=["Romanian deadlift 3×8–12","Incline DB press 3×8–12","One-arm DB row 3×8–12","Leg press 3×10–15","Lateral raise 2×12–15","Curls + triceps pushdown 2×12"];

const awsDomains=[
 {n:"Design Secure Architectures",w:30,topics:["IAM least-privilege policies & roles","VPC design; Security Groups vs NACLs","Encryption: KMS, ACM (at rest & in transit)","Secrets Manager & credential rotation","VPC endpoints (private service access)","WAF, Shield, GuardDuty basics"]},
 {n:"Design Resilient Architectures",w:26,topics:["Multi-AZ vs Multi-Region trade-offs","RDS Multi-AZ vs read replicas","Auto Scaling (target/step/scheduled)","ELB types: ALB / NLB / GLB","Route 53 routing policies & health checks","Backup & disaster-recovery patterns"]},
 {n:"Design High-Performing Architectures",w:24,topics:["EC2 instance families & selection","CloudFront + caching strategies","ElastiCache (Redis/Memcached)","EBS volume types & storage choice","S3 performance & transfer acceleration","Decoupling: SQS, SNS, EventBridge"]},
 {n:"Design Cost-Optimized Architectures",w:20,topics:["S3 storage classes & Intelligent-Tiering","EC2 pricing: On-Demand/RI/Spot/Savings Plans","Budgets, Cost Explorer, Trusted Advisor","Right-sizing & auto-scaling for cost","Data-transfer cost awareness (NAT, regions)"]}
];
const awsBooking=["Create / sign in to AWS Certification account (aws.amazon.com/certification)","Check for a 50%-off retake or partner/employer voucher first","Choose delivery: Pearson VUE test center or OnlineProctored","Pick and lock your exam date","Pay the $150 USD fee","Request +30 min ESL accommodation if English isn't your first language","Confirm valid photo ID matches your registration name"];
const awsResources=["AWS Skill Builder — free official SAA-C03 exam-prep path","Stephane Maarek's SAA-C03 course (Udemy, ~$12–15 on sale)","Adrian Cantrill's course — deeper architecture diagrams","freeCodeCamp full SAA-C03 video (~16h, free)","AWS Free Tier — build/break real architectures (labs)","Practice exams — aim for 4–6 full sets before booking"];

const trip={
 places:{
  "🇫🇷 France (your base)":[["Paris — Louvre, Eiffel, Montmartre, Seine walks","Home base with your girlfriend"],["Versailles day trip","Easy train from Paris"],["Lyon","Food capital, midway south"],["Nice / Provence","Riviera + lavender country"]],
  "🇪🇸 Spain":[["Barcelona — Sagrada Família, Gothic Quarter","Direct trains/flights from France"],["Madrid — Prado, Retiro Park","Central hub, high-speed rail"],["Seville","Andalusian heat & flamenco"],["San Sebastián","Beaches + pintxos"]],
  "🇵🇹 Portugal":[["Lisbon — Alfama, Belém, trams","Cheapest capital of the four"],["Porto — Ribeira, port cellars","Riverside + wine"],["Sintra","Fairytale palaces, day trip"]],
  "🇩🇪 Germany":[["Berlin — Brandenburg Gate, museums","History + nightlife"],["Munich","Bavaria, gateway to Alps"],["Cologne","Cathedral + easy rail hub"]]
 },
 stays:["Lock your travel dates for the loop","Book Paris base (with your girlfriend or nearby)","Reserve refundable/free-cancellation rooms first","Book hostels/dorms in Barcelona, Lisbon, Porto","Book hostels/dorms in Madrid, Berlin","Prefer central-but-near-transit locations","Confirm each check-in time & luggage storage"],
 itinerary:[["Paris (base) → warm up, plan","2"],["Paris → Barcelona","3"],["Barcelona → Lisbon (flight)","3"],["Lisbon → Porto","2"],["Porto → Madrid (flight)","3"],["Madrid → Berlin (flight)","3"],["Berlin → Paris (flight)","1"]],
 costs:[["Intercity transport (rail pass / budget flights)",1,320],["Accommodation (nights × avg)",15,32],["Food & drink (per day)",17,25],["Local transit & city cards",1,120],["Activities & museums",1,140],["Buffer / emergencies",1,150]],
 tips:[
  ["ID","Get an ISIC student card — discounts on museums, transport, and many attractions across all four countries."],
  ["FLY","Book budget airlines early (Ryanair, easyJet, Vueling, Transavia). Travel carry-on only to dodge checked-bag fees."],
  ["RAIL","Compare a youth Interrail pass (under-28 price) against point-to-point tickets. Overnight trains save you a hotel night."],
  ["STAY","Hostel dorms + free-cancellation bookings keep you flexible. Kitchens let you cook a few meals and cut food costs."],
  ["EAT","Lunch menus (menu du jour / menú del día) are far cheaper than dinner. Tap water is fine; picnic from markets."],
  ["SEE","Use city tourist cards and free-museum days (many EU museums are free the first Sunday of the month). Free walking tours everywhere."],
  ["TIME","Fly midweek (Tue–Thu) for cheaper fares. Set Google Flights / Skyscanner price alerts on your routes now."],
  ["TRAIN","Spain's Renfe and France's SNCF have youth discount cards — worth it if you take several long trains."]
 ]
};

/* ============ state ============ */
let state={fr:{},gym:{},aws:{topics:{},book:{},date:'2026-09-30'},trip:{places:{},stays:{},itinerary:trip.itinerary.map(x=>x[1]),costs:trip.costs.map(x=>[x[1],x[2]])}};
let tab='home', subtab='places';

async function load(){
  try{const r=await store.get(KEY); if(r&&r.value){const s=JSON.parse(r.value);state=Object.assign(state,s);
    state.aws=Object.assign({topics:{},book:{},date:'2026-09-30'},s.aws||{});
    state.trip=Object.assign({places:{},stays:{},itinerary:trip.itinerary.map(x=>x[1]),costs:trip.costs.map(x=>[x[1],x[2]])},s.trip||{});
  }}catch(e){}
}
let flashT;
async function save(){
  try{await store.set(KEY,JSON.stringify(state));const f=document.getElementById('flash');f.classList.add('show');clearTimeout(flashT);flashT=setTimeout(()=>f.classList.remove('show'),1200);}catch(e){}
}

/* ============ progress helpers ============ */
function frDone(){return frTopics.reduce((a,_,i)=>a+(state.fr[i+1]?1:0),0);}
function gymDone(){return gym.reduce((a,_,i)=>a+(state.gym[i]?1:0),0);}
function awsTotal(){return awsDomains.reduce((a,dm)=>a+dm.topics.length,0)+awsBooking.length;}
function awsDone(){let n=0;awsDomains.forEach((dm,di)=>dm.topics.forEach((_,ti)=>{if(state.aws.topics[di+'-'+ti])n++;}));awsBooking.forEach((_,i)=>{if(state.aws.book[i])n++;});return n;}
function tripTotal(){let n=0;Object.values(trip.places).forEach(a=>n+=a.length);return n+trip.stays.length;}
function tripDone(){let n=0;Object.keys(trip.places).forEach(c=>trip.places[c].forEach((_,i)=>{if(state.trip.places[c+'|'+i])n++;}));trip.stays.forEach((_,i)=>{if(state.trip.stays[i])n++;});return n;}

const TRACKS=[
 {id:'fr',name:'French',color:'var(--french)',tag:'Deadline Aug 15',goal:'From simple sentences to ordering, shopping & socializing on the trip.',done:frDone,total:()=>frTopics.length,unit:'sessions'},
 {id:'gym',name:'Gym',color:'var(--gym)',tag:'Deadline Aug 14',goal:'Rebuild the habit, master technique, build the strength base muscle grows on.',done:gymDone,total:()=>gym.length,unit:'sessions'},
 {id:'aws',name:'AWS SAA-C03',color:'var(--aws)',tag:'Exam: you set the date',goal:'Cover all four exam domains and book the Solutions Architect Associate exam.',done:awsDone,total:awsTotal,unit:'items'},
 {id:'trip',name:'Euro trip',color:'var(--trip)',tag:'From Paris',goal:'Places, stays, a day-by-day plan, and a live budget with student savings.',done:tripDone,total:tripTotal,unit:'items'}
];

/* ============ next action per track ============ */
function nextFr(){const t=today();for(let i=0;i<frTopics.length;i++){const dt=addDays(START,i);if(!state.fr[i+1]){const rel=daysBetween(t,dt);const when=rel===0?'today':rel<0?`overdue ${-rel}d`:`in ${rel}d`;return `Day ${i+1} (${when}): ${frTopics[i].replace(/GATE.*—\s?/,'⛳ ')}`;}}return 'All sessions complete — bon voyage!';}
function nextGym(){for(let i=0;i<gym.length;i++){if(!state.gym[i]){const rel=daysBetween(today(),gym[i].dt);const when=rel===0?'today':rel<0?`overdue ${-rel}d`:`in ${rel}d`;return `Session ${i+1} (${when}): ${gym[i].label}`;}}return 'All 15 sessions logged — foundation built.';}
function nextAws(){if(!Object.values(state.aws.book).some(Boolean))return 'Start by booking the exam — locking a date drives everything.';for(const dm of awsDomains){for(let ti=0;ti<dm.topics.length;ti++){const di=awsDomains.indexOf(dm);if(!state.aws.topics[di+'-'+ti])return `${dm.n}: ${dm.topics[ti]}`;}}return 'All domains covered — take a full practice exam.';}
function nextTrip(){for(const c in trip.places)for(let i=0;i<trip.places[c].length;i++)if(state.trip.places[c+'|'+i]) {return 'Places chosen — move to Stays & Costs tabs.';}return 'Pick the cities you want to hit in the Places tab.';}
const NEXT={fr:nextFr,gym:nextGym,aws:nextAws,trip:nextTrip};

/* ============ render: countdown + runway ============ */
function renderTop(){
  const rel=daysBetween(today(),FLIGHT);
  document.getElementById('cd-days').textContent=rel>=0?rel:0;
  document.getElementById('cd-detail').innerHTML=
    `Gym gate <b>${fmt(d(2026,8,14))}</b> · French final <b>${fmt(d(2026,8,15))}</b> · AWS exam <b>${new Date(state.aws.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</b> (your pick)`;

  const a=START, b=FLIGHT, span=daysBetween(a,b), t=today();
  const pos=dt=>Math.max(0,Math.min(100,daysBetween(a,dt)/span*100));
  const tp=pos(t);
  const winStart=pos(d(2026,8,14));
  const rw=document.getElementById('runway');
  rw.innerHTML=`
    <div class="runway-line"></div>
    <div class="runway-fill" style="width:${tp}%"></div>
    <div class="runway-start">Jul 13 · start</div>
    <div class="runway-window" style="left:${winStart}%;right:0">
      <div class="wlab">launch window · Aug 14–16</div>
    </div>
    <div class="today-pin ${tp>78?'near-end':''}" style="left:${tp}%">
      <div class="plabel">TODAY · ${rel>=0?rel:0}d to go</div>
    </div>`;

  document.getElementById('legend').innerHTML=`
    <span><i style="background:var(--gym)"></i>Gym gate <b>Aug 14</b></span>
    <span><i style="background:var(--french)"></i>French final <b>Aug 15</b></span>
    <span><i style="background:var(--ink)"></i>✈ Fly to Paris <b>Aug 16</b></span>`;
}

/* ============ render: nav ============ */
function renderNav(){
  const n=document.getElementById('nav');
  const items=[['home','Mission control','var(--ink)'],...TRACKS.map(t=>[t.id,t.name,t.color])];
  n.innerHTML=items.map(([id,label,c])=>`<button class="${tab===id?'active':''}" data-tab="${id}"><span class="swatch" style="background:${c}"></span>${label}</button>`).join('');
  n.querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});});
}

/* ring svg */
function ring(pct,color){
  const r=22,c=2*Math.PI*r,off=c*(1-pct/100);
  return `<div class="ring"><svg width="52" height="52"><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="6"/><circle cx="26" cy="26" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg><div class="pct">${Math.round(pct)}%</div></div>`;
}

/* ============ render: dashboard ============ */
function viewHome(){
  return `<div class="grid">`+TRACKS.map(t=>{
    const done=t.done(),tot=t.total(),pct=tot?done/tot*100:0;
    return `<div class="card click" data-go="${t.id}">
      <div class="card-top">
        <span class="tag" style="color:${t.color};background:color-mix(in srgb, ${t.color} 14%, transparent)">${t.tag}</span>
        ${ring(pct,t.color)}
      </div>
      <h3>${t.name}</h3>
      <div class="goal">${t.goal}</div>
      <div class="ring-meta" style="margin-top:6px"><b>${done}</b> / ${tot} ${t.unit} done</div>
      <div class="next"><div class="k">Next up</div><div class="v">${NEXT[t.id]()}</div></div>
    </div>`;
  }).join('')+`</div>`;
}

/* ============ render: French ============ */
function viewFr(){
  const done=frDone(),pct=done/frTopics.length*100;
  let rows='';let lastPhase=-1;
  frTopics.forEach((tx,i)=>{
    const num=i+1, ph=frPhases.filter(p=>num>=p[0]).pop();
    if(ph&&ph[0]!==lastPhase){rows+=`<div class="phase-h">${ph[1]}</div>`;lastPhase=ph[0];}
    const dt=addDays(START,i),isToday=iso(dt)===iso(today()),gate=frGates.has(num),on=!!state.fr[num];
    rows+=`<div class="row ${on?'done':''} ${gate?'gate':''} ${isToday?'today-row':''}" data-fr="${num}">
      <div class="cb ${on?'on':''}" style="--ok:var(--french)">${chk()}</div>
      <div class="idx">Day ${num}</div>
      <div class="txt">${tx}${gate?' <span class="badge" style="background:var(--french)">gate</span>':''}</div>
      <div class="date">${fmt(dt)}</div>
    </div>`;
  });
  return head('French','A2 travel track · ~25 min/day, evenings, with lunch (12–1) for micro-review. Ordered the way real A2 courses build: politeness & prices first, then café, then getting around, then social, then real combined scenarios.',pct,'var(--french)')
    +`<div class="list">${rows}</div>`;
}

/* ============ render: Gym ============ */
function viewGym(){
  const done=gymDone(),pct=done/gym.length*100;
  let rows='';
  gym.forEach((g,i)=>{
    const isToday=iso(g.dt)===iso(today()),on=!!state.gym[i];
    const wk=(i%2===0)?'A':'B';
    rows+=`<div class="row ${on?'done':''} ${g.gate?'gate':''} ${isToday?'today-row':''}" data-gym="${i}">
      <div class="cb ${on?'on':''}" style="--ok:var(--gym)">${chk()}</div>
      <div class="idx">#${i+1}</div>
      <div class="txt">${g.label}${g.gate?' <span class="badge" style="background:var(--gym)">gate</span>':''}</div>
      <div class="date">${fmt(g.dt)}</div>
    </div>`;
  });
  const list=w=>w.map(x=>`<li>${x}</li>`).join('');
  return head('Gym','Full-body A/B, Mon·Wed·Fri — the evidence-based beginner path to muscle: compound-focused, 6–12 reps, double progression (add reps to the top of the range, then add load). Week 1 gates on technique before any weight goes up.',pct,'var(--gym)')
    +`<div class="list">${rows}</div>
      <div class="grid" style="margin-top:16px">
        <div class="card"><span class="tag" style="color:var(--gym);background:color-mix(in srgb, var(--gym) 14%, transparent)">Workout A</span><ul style="margin:12px 0 0;padding-left:18px;font-size:13.5px;line-height:1.9">${list(workoutA)}</ul></div>
        <div class="card"><span class="tag" style="color:var(--gym);background:color-mix(in srgb, var(--gym) 14%, transparent)">Workout B</span><ul style="margin:12px 0 0;padding-left:18px;font-size:13.5px;line-height:1.9">${list(workoutB)}</ul></div>
      </div>`;
}

/* ============ render: AWS ============ */
function viewAws(){
  const done=awsDone(),pct=done/awsTotal()*100;
  let doms=awsDomains.map((dm,di)=>{
    const chips=dm.topics.map((tp,ti)=>{
      const on=!!state.aws.topics[di+'-'+ti];
      return `<div class="chip ${on?'on':''}" data-aws="${di}-${ti}"><span class="mini"></span><span class="lab">${tp}</span></div>`;
    }).join('');
    return `<div class="dom"><div class="dom-h"><h3>${di+1}. ${dm.n}</h3><span class="weight">${dm.w}%</span></div><div class="topics">${chips}</div></div>`;
  }).join('');
  const bk=awsBooking.map((b,i)=>{const on=!!state.aws.book[i];return `<div class="row ${on?'done':''}" data-book="${i}"><div class="cb ${on?'on':''}" style="--ok:var(--aws)">${chk()}</div><div class="txt">${b}</div></div>`;}).join('');
  const res=awsResources.map(r=>`<li><span class="t">·</span>${r}</li>`).join('');
  return head('AWS Solutions Architect Associate','SAA-C03 · 65 questions, 130 min, pass 720/1000, $150, valid 3 years. Study weighted by domain — Security is 30% and the #1 place people fail, so give it the most time. Plan for ~60–120 hours total.',pct,'var(--aws)')
   +`<div class="card" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
       <div><div class="eyebrow">Target exam date</div><div style="font-size:13px;color:var(--ink-2);margin-top:3px">Set a date to anchor your study — locking it is the single biggest motivator.</div></div>
       <input type="date" id="aws-date" class="small-input" value="${state.aws.date}">
     </div>
     <div class="eyebrow" style="margin:4px 0 10px">Book the exam</div>
     <div class="list" style="margin-bottom:18px">${bk}</div>
     <div class="eyebrow" style="margin:4px 0 10px">Study by domain (tap to mark covered)</div>
     ${doms}
     <div class="card" style="margin-top:14px"><span class="tag" style="color:var(--aws);background:color-mix(in srgb, var(--aws) 14%, transparent)">Grounded resources</span><ul class="tips" style="margin-top:12px">${res}</ul></div>`;
}

/* ============ render: Trip ============ */
function viewTrip(){
  const done=tripDone(),pct=done/tripTotal()*100;
  const subs=[['places','Places'],['stays','Stays'],['itinerary','Itinerary'],['costs','Costs & savings']];
  let body='';
  if(subtab==='places'){
    body=Object.keys(trip.places).map(c=>{
      const items=trip.places[c].map((p,i)=>{const on=!!state.trip.places[c+'|'+i];
        return `<div class="place ${on?'on':''}" data-place="${c}|${i}"><span class="mini"></span><div><div class="nm">${p[0]}</div><div class="ds">${p[1]}</div></div></div>`;}).join('');
      return `<div class="country-h">${c}</div><div class="places">${items}</div>`;
    }).join('');
  } else if(subtab==='stays'){
    body=`<div class="list">`+trip.stays.map((s,i)=>{const on=!!state.trip.stays[i];
      return `<div class="row ${on?'done':''}" data-stay="${i}"><div class="cb ${on?'on':''}" style="--ok:var(--trip)">${chk()}</div><div class="txt">${s}</div></div>`;}).join('')+`</div>
      <div class="note">Tip: book refundable rooms first so you can rearrange the route as flight prices move. The Costs tab shows how nights drive your budget.</div>`;
  } else if(subtab==='itinerary'){
    body=`<div class="note" style="margin:0 0 12px">Suggested loop from Paris — dates are open, so edit nights freely. Flights between far-apart cities (Lisbon, Berlin) usually beat long trains on both time and cost.</div>
      <div class="costs">`+trip.itinerary.map((leg,i)=>`
        <div class="leg"><span class="n">${i+1}</span>
          <input value="${leg[0]}" data-leg="${i}" data-f="route">
          <input class="nights" value="${state.trip.itinerary[i]}" data-leg="${i}" data-f="nights" title="nights"></div>`).join('')+`</div>`;
  } else {
    let rows=state.trip.costs.map((c,i)=>{
      const label=trip.costs[i][0],qty=c[0],unit=c[1];
      return `<div class="ctr"><input class="label" value="${label}" data-cost="${i}" data-f="label"><input value="${qty}" data-cost="${i}" data-f="qty" inputmode="decimal"><input value="${unit}" data-cost="${i}" data-f="unit" inputmode="decimal"><div class="line-tot">€${(qty*unit).toLocaleString()}</div></div>`;
    }).join('');
    const total=state.trip.costs.reduce((a,c)=>a+c[0]*c[1],0);
    body=`<div class="costs">
        <div class="ctr head"><div>Line item</div><div>Qty</div><div>€ / unit</div><div>Subtotal</div></div>
        ${rows}
        <div class="cost-total"><span class="lbl">Estimated total · per person</span><span class="amt" id="grand">€${total.toLocaleString()}</span></div>
      </div>
      <div class="note">Editable estimates in euros — tune every number to your real quotes. Defaults assume budget/student travel (dorms, carry-on flights, cooking some meals).</div>
      <div class="eyebrow" style="margin:22px 0 10px">Money-saving playbook · student edition</div>
      <ul class="tips">${trip.tips.map(t=>`<li><span class="t">${t[0]}</span><div>${t[1]}</div></li>`).join('')}</ul>`;
  }
  return head('Euro trip','France · Portugal · Spain · Germany, launched from your Paris base. Pick places, track bookings, shape the route, and keep a live budget.',pct,'var(--trip)')
    +`<div class="subnav">`+subs.map(([id,l])=>`<button class="${subtab===id?'active':''}" data-sub="${id}">${l}</button>`).join('')+`</div>${body}`;
}

function head(title,desc,pct,color){
  return `<div class="panel-head"><div><h2>${title}</h2><div class="desc">${desc}</div></div>${ring(pct,color)}</div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div><div style="height:16px"></div>`;
}
function chk(){return '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';}

/* ============ main render + events ============ */
function render(){
  renderTop();renderNav();
  const v=document.getElementById('view');
  v.innerHTML = tab==='home'?viewHome():tab==='fr'?viewFr():tab==='gym'?viewGym():tab==='aws'?viewAws():viewTrip();
  bind();
}
function bind(){
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{tab=el.dataset.go;render();window.scrollTo({top:0,behavior:'smooth'});});
  document.querySelectorAll('[data-fr]').forEach(el=>el.onclick=()=>{const n=el.dataset.fr;state.fr[n]=!state.fr[n];save();render();});
  document.querySelectorAll('[data-gym]').forEach(el=>el.onclick=()=>{const n=el.dataset.gym;state.gym[n]=!state.gym[n];save();render();});
  document.querySelectorAll('[data-aws]').forEach(el=>el.onclick=()=>{const k=el.dataset.aws;state.aws.topics[k]=!state.aws.topics[k];save();render();});
  document.querySelectorAll('[data-book]').forEach(el=>el.onclick=()=>{const k=el.dataset.book;state.aws.book[k]=!state.aws.book[k];save();render();});
  document.querySelectorAll('[data-place]').forEach(el=>el.onclick=()=>{const k=el.dataset.place;state.trip.places[k]=!state.trip.places[k];save();render();});
  document.querySelectorAll('[data-stay]').forEach(el=>el.onclick=()=>{const k=el.dataset.stay;state.trip.stays[k]=!state.trip.stays[k];save();render();});
  document.querySelectorAll('[data-sub]').forEach(el=>el.onclick=()=>{subtab=el.dataset.sub;render();});
  const ad=document.getElementById('aws-date');if(ad)ad.onchange=()=>{state.aws.date=ad.value;save();render();};
  document.querySelectorAll('[data-cost]').forEach(inp=>inp.oninput=()=>{
    const i=+inp.dataset.cost,f=inp.dataset.f;
    if(f==='label'){trip.costs[i][0]=inp.value;} else {state.trip.costs[i][f==='qty'?0:1]=parseFloat(inp.value)||0;}
    const total=state.trip.costs.reduce((a,c)=>a+c[0]*c[1],0);
    const g=document.getElementById('grand');if(g)g.textContent='€'+total.toLocaleString();
    inp.closest('.ctr').querySelector('.line-tot').textContent='€'+(state.trip.costs[i][0]*state.trip.costs[i][1]).toLocaleString();
    save();
  });
  document.querySelectorAll('[data-leg]').forEach(inp=>inp.oninput=()=>{
    const i=+inp.dataset.leg,f=inp.dataset.f;
    if(f==='route')trip.itinerary[i][0]=inp.value; else state.trip.itinerary[i]=inp.value;
    save();
  });
}
document.getElementById('reset').onclick=async()=>{
  state={fr:{},gym:{},aws:{topics:{},book:{},date:'2026-09-30'},trip:{places:{},stays:{},itinerary:trip.itinerary.map(x=>x[1]),costs:trip.costs.map(x=>[x[1],x[2]])}};
  await save();render();
};

(async()=>{await load();render();})();
</script>
````

---

## 5 · The "Learning Architect" skill

The reusable Claude skill that generates programs like this one. `SKILL.md` plus its three reference files.

### 5.1 · SKILL.md
````markdown
---
name: learning-architect
description: Turns any learning or self-improvement goal into a complete, evidence-grounded program with a calendar, daily sessions, tests, and progress tracking — then runs it day by day. Use this skill whenever the user wants to learn a skill or subject (e.g. "I want to learn system design", "teach me statistics"), reach a physical goal ("build muscle", "run a 10k"), asks for a study plan, curriculum, roadmap, learning schedule, or training program, OR when they reference an existing program ("run day 12", "give me today's session", "test me on week 2", "I missed 3 days, replan"). Trigger even if they don't use the word "plan" — any goal of the form "get good at X by Y" belongs to this skill.
---

# Learning Architect

Build and run structured learning programs the user can actually trust. The core problem this skill solves: AI-generated curricula are usually unverifiable, unrealistically scoped, and abandoned because nothing tracks or tests progress. Every design decision below exists to fix one of those three failures.

## The three trust pillars (never skip these)

1. **Grounding** — The syllabus is never invented from memory alone. Before designing, search the web for how authoritative sources structure this subject (university course syllabi, canonical textbooks, respected programs/certifications, established training methodologies). The plan must cite its sources so the user can audit it. If sources disagree, say so and explain the choice made.
2. **Verification** — Progress is gated by tests, not by days elapsed. Every unit ends with an objective self-test; every phase ends with a mastery gate that has explicit pass criteria written *before* the user takes it. Failing a gate triggers remediation, never silent advancement.
3. **Honesty** — If the goal is unrealistic for the timeframe (e.g. "build a lot of muscle in a month"), say so plainly, cite the evidence, and offer the realistic version. Never write a fantasy plan to please the user. A plan the user can trust starts with a promise that can be kept.

## Operating modes

Detect which mode the user needs from their message:

| User says something like | Mode |
|---|---|
| "I want to learn X" / "get fit by Y" | **CREATE** — build a new program |
| "Run today" / "day 12" / "what's today's session" | **RUN DAY** — execute one daily session |
| "Test me" / end of a week or phase | **GATE** — administer and grade a mastery test |
| "I missed days" / "this is too easy/hard" / failed gate | **ADAPT** — replan without losing history |

## Mode: CREATE

### 1. Intake (keep it short — one round of questions)
Establish: the goal stated as an observable outcome ("design a system that passes a mock interview", not "understand system design"); the deadline; minutes available per day and days per week; current level (ask 2–3 quick diagnostic questions rather than trusting self-assessment); available equipment/resources; and where they'll keep files. If the interface has an option-buttons tool, use it for this.

### 2. Reality check
Compute total available hours. Compare against evidence for how long the goal actually takes (search if unsure). State the verdict in one of three forms: feasible as stated / feasible with reduced scope (propose the reduced scope explicitly) / not feasible (propose the nearest honest goal). Get agreement before building anything.

### 3. Ground the syllabus
Search for 2–4 authoritative structures for this subject. For cognitive skills, read `references/curriculum-design.md`. For physical goals, read `references/physical-training.md`. Extract the canonical topic ordering and the consensus fundamentals. Fundamentals are non-negotiable and come first — resist the temptation to skip to the exciting parts, and tell the user why.

### 4. Design backward
Define the final mastery gate first (what the user must demonstrably do at the end). Then define phase gates that build to it. Only then fill in weeks and days. Every day must trace upward to a gate — if a day's content isn't needed to pass any gate, cut it.

### 5. Generate the program files
Create the full file set exactly as specified in `references/file-formats.md` (read it before generating):
- `PLAN.md` — goal, sources cited, phase map, all gate criteria, the adaptation rules
- `calendar.ics` — a real importable calendar file with every session as an event
- `SCHEDULE.md` — the same calendar in readable form, checkbox per day
- `LOG.md` — the running progress log (append-only; never rewrite history)
- `TESTS.md` — every gate's questions/tasks and pass criteria, written up front so the user can verify tests aren't being softened later
- `DAILY-TEMPLATE.md` — the fixed session structure

Present all files to the user and tell them: import the .ics, and each day just say "run day N".

## Mode: RUN DAY

Follow the fixed session structure — its ordering is deliberate (retrieval before new input is the highest-evidence technique in learning science):
1. **Retrieval warm-up (5 min)** — quiz 3–5 items from previous days chosen by the spacing schedule in PLAN.md. Grade them. This is spaced repetition; do not skip it even if the user wants to.
2. **One new thing** — teach exactly one concept or run exactly one workout block, per the schedule. Depth over coverage.
3. **Active practice** — the user produces something: solves, explains back, diagrams, performs. Watching/reading alone never counts as a completed session.
4. **Exit ticket (2–3 min)** — 1–2 questions on today's material. This becomes tomorrow's retrieval pool.
5. **Log it** — append the day's result (done/partial/missed, exit-ticket score, user's difficulty rating 1–5) to LOG.md.

If no program files exist in the conversation or uploads, ask the user to paste or upload their PLAN.md and LOG.md — never reconstruct progress from memory.

## Mode: GATE

Administer the test exactly as written in TESTS.md — no substitutions, no hints during the test. Grade against the pre-written criteria and show the grading work. Pass → record in LOG.md, advance. Fail → this is signal, not shame: identify which specific items failed, prescribe a remediation block (typically 2–4 days re-covering only the failed items), reschedule the retake, and update SCHEDULE.md. Never lower the bar of a gate; adjust the time, not the standard.

## Mode: ADAPT

Missed days, pace problems, and failed gates all route here. Rules:
- LOG.md is append-only; adaptation edits the *future* schedule only.
- Missed 1–2 days → compress or push the schedule; fundamentals are never cut to save time, enrichment topics are cut first.
- Consistently too easy (difficulty ratings ≤2 and exit tickets ≥90%) → accelerate by tightening spacing, not by skipping gates.
- Consistently too hard (ratings ≥4 or exit tickets <60%) → halve new content per day and increase retrieval share.
- Regenerate calendar.ics after any schedule change.

## Tone rules

Be a coach, not a cheerleader: specific praise tied to logged evidence, direct about slippage, zero guilt-tripping. When the user is behind, the first response is always to shrink the next step, never to lecture.
````

### 5.2 · references/curriculum-design.md
````markdown
# Curriculum design for cognitive skills

Read this when building a program for a subject/skill of the mind (programming, system design, a language, math, an exam, etc.).

## Grounding checklist
Search for and skim at least two of: a university course syllabus for the subject, the table of contents of the canonical textbook(s), a respected certification's exam blueprint, or a widely-cited practitioner roadmap. Record source names + URLs in PLAN.md under "Sources". The topic *ordering* should follow the consensus of these sources; where you deviate, justify it in one line.

## Identify the fundamentals
Fundamentals are the concepts that appear in essentially every source AND that later topics depend on. Build a short dependency note in PLAN.md: "B requires A" chains. Anything with no dependents and appearing in few sources is enrichment — first to cut under time pressure, never the reverse.

## Evidence-based techniques to bake into the schedule
- **Retrieval practice**: testing beats re-reading. Every session starts with recall of old material.
- **Spacing**: schedule reviews of each concept at expanding intervals — next day, ~3 days, ~7 days, ~14 days after first learning. Encode this directly into which items appear in each day's warm-up.
- **Interleaving**: once 3+ topics exist, mix practice problems across topics rather than blocking one topic per session.
- **Deliberate practice at the edge**: exercises should sit slightly above current ability. Exit-ticket scores of 70–85% indicate the right difficulty band; adjust when outside it.
- **Production over consumption**: cap passive input (video/reading) at ~40% of session time. The rest is solving, writing, explaining aloud (Feynman technique), or building.

## Gate design
- Phase gates test *transfer*, not recall: novel problems the user hasn't seen, in the format of the real-world outcome (e.g. a timed mock system-design interview, not a vocabulary quiz).
- Write model answers or rubrics into TESTS.md at creation time. Pass threshold is explicit (e.g. "≥7/10 rubric points, all 3 fundamentals sections ≥ passing").
- Final gate = the goal statement itself, made observable.

## Common failure to design against
Tutorial hell: consuming without producing. If two consecutive logged sessions have no produced artifact, the next session must be 100% practice.
````

### 5.3 · references/physical-training.md
````markdown
# Program design for physical goals

Read this when the goal is physical (muscle, strength, endurance, weight, mobility, a race).

## Safety and scope
This skill produces general fitness education and structure, not medical advice. Ask about injuries/conditions during intake; if any exist, or the user is new to training and over ~40, add a line advising clearance from a professional and design conservatively. Never program through pain.

## Reality calibration (say the honest number)
Search for current consensus if unsure, but typical evidence-based expectations to check goals against:
- Muscle gain: beginners roughly 0.5–1 kg of actual muscle per month under good training/nutrition/sleep; far less for intermediates. "A lot of muscle in a month" is not achievable — say so and reframe to "build the habit, learn the lifts, gain measurable strength in a month; visible change in 3+ months".
- Fat loss: ~0.5–1% of body weight per week is sustainable.
- Endurance: meaningful aerobic adaptation shows in 6–8 weeks; couch-to-10k is a ~3 month arc.
Cite what you searched in PLAN.md.

## Programming principles
- **Progressive overload** is the fundamental: each week nudges one variable (load, reps, sets, or distance) by a small amount. Encode the exact progression rule in PLAN.md so the user can verify each week follows it.
- **Frequency**: each muscle group or quality trained ~2x/week beats 1x. Full-body or upper/lower splits for ≤4 days/week availability.
- **Recovery is programmed, not implied**: rest days and a deload (roughly every 4th–6th week, volume cut ~40%) go on the calendar as real events.
- **Technique before load** for beginners: first 1–2 weeks gate on movement quality (filmed self-checks against listed cues), not weight lifted.

## Measurement and gates
Physical gates are measurements, not vibes: e.g. week-4 gate = "goblet squat 3×10 at X kg with listed cues met; bodyweight trend logged 4 weeks; ≥85% session adherence". Track adherence %, key lift loads/reps, bodyweight weekly average, and a weekly photo/measurement if the goal is physique. Adherence below 70% over two weeks routes to ADAPT mode: shrink the program (fewer days, shorter sessions) rather than letting it silently die.

## Session structure mapping
The RUN DAY structure maps as: retrieval warm-up → general warm-up + technique cue recall quiz; one new thing → today's primary progression; active practice → the working sets; exit ticket → log loads/reps/RPE + one technique self-check question.
````

### 5.4 · references/file-formats.md
````markdown
# Program file formats

Generate every file below when creating a program. Save to the output directory and present them all to the user. Keep formats exact — the user will re-upload these files in later conversations and future sessions must be able to parse them.

## PLAN.md
```markdown
# Program: <goal, stated as observable outcome>
Created: <date> · Deadline: <date> · Budget: <min/day> × <days/week>
Feasibility verdict: <feasible / reduced scope agreed: ... / reframed to: ...>

## Sources
- <name — URL — what was taken from it>  (2–4 entries)

## Fundamentals & dependencies
<short list; "X requires Y" notes>

## Phases
### Phase 1: <name> (days 1–N)
Outcome: <what the user can do after>
Gate: <one-line pointer to TESTS.md#gate-1>
Topics/blocks: <ordered list>
(repeat per phase)

## Spacing schedule
New item reviewed at +1d, +3d, +7d, +14d (adjust per performance).

## Adaptation rules
<copy the ADAPT rules from the skill, plus any program-specific ones>
```

## SCHEDULE.md
One line per session: `- [ ] Day 12 — Tue 2026-07-28 — <topic> (30 min)`. Gates and rest/deload days appear as their own lines. Checkboxes get ticked as LOG.md fills.

## LOG.md
Append-only. One line per completed/missed day:
`Day 12 | 2026-07-28 | done | exit 2/2 | difficulty 3 | notes: ...`
Gates append: `GATE 1 | date | PASS 8/10 | weak: caching` 

## TESTS.md
For every gate: numbered questions/tasks, the rubric or model answers, and an explicit pass threshold. Written in full at creation time — this is a trust anchor; tests are never rewritten later, only retaken.

## DAILY-TEMPLATE.md
The 5-step RUN DAY structure with time boxes, personalized to the user's session length.

## calendar.ics
Write a valid iCalendar file by hand (no libraries needed). Rules:
- CRLF line endings (`\r\n`) are required by spec; write with a small Python script to get them right.
- One VEVENT per session, gate, and deload/rest marker.
- UID format: `day12-<slug>@learning-architect`
- Use DTSTART with VALUE=DATE for all-day events, or TZID-less UTC times if the user gave a preferred time of day.
- SUMMARY: `📚 Day 12: Caching fundamentals (30 min)` / `🏋️ Day 12: Upper body A`; gates get `⛳ GATE 2: Mock interview`.
- DESCRIPTION: the day's one-line agenda + "Open Claude and say: run day 12".

Skeleton:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//learning-architect//EN
BEGIN:VEVENT
UID:day1-example@learning-architect
DTSTAMP:20260713T000000Z
DTSTART;VALUE=DATE:20260714
SUMMARY:📚 Day 1: ...
DESCRIPTION:... Open Claude and say: run day 1
END:VEVENT
END:VCALENDAR
```
Validate before presenting: every line under 75 chars where practical, no blank lines inside VEVENTs, dates match SCHEDULE.md exactly.
````

---

## 6 · The generated program (seed data)

These files are the current program instance. Use them to seed the app's database. `calendar.ics` is generated from `SCHEDULE.md` (see file-formats.md for the generator rules) and is not inlined here.

### 6.1 · PLAN.md
````markdown
# Program: Trip-ready French + rebuild the gym habit & muscle foundation + a mini Euro trip plan
Created: 2026-07-13 · French deadline: 2026-08-15 (travel Aug 16) · Gym deadline: 2026-08-14
Budget: French ~25 min/day (evenings; lunch 12–1 for micro-review) · Gym Mon/Wed/Fri

## Feasibility verdict (honest)
- **French — feasible as stated.** From "simple sentences, slowly" (~A1→A2) to confidently ordering, shopping, asking directions, and basic social interaction in ~33 days of daily practice is a realistic, well-documented outcome.
- **Gym — reframed, agreed.** "Gain muscle" in ~4.5 weeks realistically means: rebuild the habit, master technique, and make measurable strength gains — the foundation muscle grows on. Visible size is a 3+ month arc. This program is month 1 of that arc.
- **Euro trip — deliverable, not daily practice.** Launched from Paris (long stay), dates open. Built as a flexible itinerary across two planning sessions.

## Sources
- Alliance Française — A2 skill breakdown (café/shop/directions, "je voudrais", "c'est combien") — afscv.org/blog/a2-french-level
- Language Teams — A1→A2 course module order (everyday → shopping/services → stories/opinions) — languageteams.com/en/french-language-levels-cefr-a2
- Lawless French — CEFR topic sequencing (greetings → survival → practical/travel → conversational) — lawlessfrench.com/faq/lessons-by-level
- Science for Sport / ScienceForSport & Weightology — hypertrophy: 6–12 reps, 3–6 sets, 10–20 sets/muscle/week, 2–3x frequency — scienceforsport.com/hypertrophy-training ; weightology.net
- TTrening / Strive — beginner full-body 3x/week, non-consecutive days, compound focus, double progression — ttrening.com/learn/articles/3-day-full-body-workout

## Fundamentals & dependencies
- French: politeness + numbers/prices come FIRST — every café, shop, and transport interaction requires them. Ordering requires numbers. Social/past-tense builds on present-tense survival phrases. Fundamentals are never cut.
- Gym: technique before load. Weeks 1 gates on movement quality; adding weight before that is not allowed.

## Phases
### French Phase 1 — Survival & politeness (Days 1–7)
Outcome: order food/drink and pay confidently. Gate: TESTS.md#fr-gate-1
### French Phase 2 — Getting around & shops (Days 8–14)
Outcome: navigate, buy tickets, shop. Gate: TESTS.md#fr-gate-2
### French Phase 3 — Social interaction (Days 15–21)
Outcome: meet people, small talk, make plans. Gate: TESTS.md#fr-gate-3
### French Phase 4 — Consolidation & real scenarios (Days 22–34)
Outcome: THE GOAL — handle a chain of real travel situations. Gate: TESTS.md#fr-final

### Gym Phase 1 — Technique (Week 1)
Outcome: correct form on squat/hinge/press/pull at light load. Gate feeds the final check.
### Gym Phase 2 — Progressive overload (Weeks 2–5)
Outcome: measurable load/rep increase via double progression. Gate: TESTS.md#gym-gate

## Progression rule (gym — double progression)
Work in a rep range (e.g. 8–12). When you hit the TOP of the range for ALL sets with good form, add the smallest load increment next session and drop back toward the bottom of the range. Log every set. This IS the plan — verify each week follows it.

## Spacing schedule (French)
Each new item is re-quizzed in the warm-up at roughly +1, +3, +7, +14 days. Days 29 & 33 are dedicated heavy-review of the weakest logged items.

## Adaptation rules
- LOG.md is append-only; adaptation only edits FUTURE days.
- Missed 1–2 French days → fold the missed vocab into the next warm-up; don't skip a gate.
- Missed a gym day → do it the next open day (incl. optional Saturday) or shift the week; never train through pain.
- Too easy (difficulty ≤2, exit ≥90% / hit top reps every set) → tighten French spacing / add gym load faster. Don't skip gates.
- Too hard (difficulty ≥4, exit <60% / failing reps) → halve new French content, raise review share / reduce gym volume a set.
- Regenerate calendar.ics after any schedule change.
````

### 6.2 · SCHEDULE.md
````markdown
# SCHEDULE  (Jul 13 – Aug 15, 2026)

Tick a box when done. Say "run <track> day N" to Claude to execute a session.

## French 🇫🇷 (deadline Aug 15 — you travel Aug 16)

- [ ] FR Day 1 — Mon 2026-07-13 — Politesse: bonjour, merci, s'il vous plaît, excusez-moi; tu vs vous
- [ ] FR Day 2 — Tue 2026-07-14 — Numbers 0-69; asking 'c'est combien ?'
- [ ] FR Day 3 — Wed 2026-07-15 — Numbers 70-100; prices, paying, coins/notes
- [ ] FR Day 4 — Thu 2026-07-16 — Café basics: 'je voudrais un café, s'il vous plaît'
- [ ] FR Day 5 — Fri 2026-07-17 — Restaurant: menu words, 'l'addition', water, allergies
- [ ] FR Day 6 — Sat 2026-07-18 — Café/restaurant full order practice + polite requests
- [ ] ⛳ FR Day 7 — Sun 2026-07-19 — GATE 1: Order a full café/restaurant meal (roleplay)
- [ ] FR Day 8 — Mon 2026-07-20 — Directions: 'où est...?', gauche/droite/tout droit
- [ ] FR Day 9 — Tue 2026-07-21 — Transport: métro, billet, 'un aller simple/retour'
- [ ] FR Day 10 — Wed 2026-07-22 — Train station & buying tickets; times/schedules
- [ ] FR Day 11 — Thu 2026-07-23 — Shops: 'je cherche...', 'vous avez...?', sizes
- [ ] FR Day 12 — Fri 2026-07-24 — Quantities & groceries: un peu, beaucoup, une bouteille de
- [ ] FR Day 13 — Sat 2026-07-25 — Getting-around review + shop roleplay practice
- [ ] ⛳ FR Day 14 — Sun 2026-07-26 — GATE 2: Navigate a route + shop for items (roleplay)
- [ ] FR Day 15 — Mon 2026-07-27 — Meeting people: introductions, 'enchanté', origin, job
- [ ] FR Day 16 — Tue 2026-07-28 — Small talk: weather, weekend, 'ça va ?' responses
- [ ] FR Day 17 — Wed 2026-07-29 — Likes/dislikes: 'j'aime / je n'aime pas', preferences
- [ ] FR Day 18 — Thu 2026-07-30 — Meeting girlfriend's family/friends: polite phrases
- [ ] FR Day 19 — Fri 2026-07-31 — Making plans: 'on peut... ?', proposing, agreeing
- [ ] FR Day 20 — Sat 2026-08-01 — Phone / reservation: booking a table, 'je voudrais réserver'
- [ ] ⛳ FR Day 21 — Sun 2026-08-02 — GATE 3: Social scene — meet, small talk, make a plan
- [ ] FR Day 22 — Mon 2026-08-03 — Passé composé basics: 'j'ai mangé, je suis allé'
- [ ] FR Day 23 — Tue 2026-08-04 — Talking about your day / what you did
- [ ] FR Day 24 — Wed 2026-08-05 — Problems & complaints: 'il y a une erreur', service issues
- [ ] FR Day 25 — Thu 2026-08-06 — Pharmacy & health: 'j'ai mal à...', basic needs
- [ ] FR Day 26 — Fri 2026-08-07 — Emergencies & help: 'pouvez-vous m'aider ?'
- [ ] FR Day 27 — Sat 2026-08-08 — Combined scenario A: arrival, taxi, apartment/hotel
- [ ] FR Day 28 — Sun 2026-08-09 — Combined scenario B: café + shopping + directions
- [ ] FR Day 29 — Mon 2026-08-10 — Heavy spaced review: weakest items from log
- [ ] FR Day 30 — Tue 2026-08-11 — Combined scenario C: social evening + making plans
- [ ] FR Day 31 — Wed 2026-08-12 — Listening focus: fast speech, asking to repeat
- [ ] FR Day 32 — Thu 2026-08-13 — Full dry-run of final gate (untested, for practice)
- [ ] FR Day 33 — Fri 2026-08-14 — Targeted review of any remaining weak items
- [ ] ⛳ FR Day 34 — Sat 2026-08-15 — FINAL GATE: Sustained multi-scene travel roleplay

## Gym 🏋️ (Mon/Wed/Fri, deadline Aug 14)

- [ ] Gym Day 1 — Mon 2026-07-13 — Workout A — technique focus (light, learn the lifts)
- [ ] Gym Day 2 — Wed 2026-07-15 — Workout B — technique focus (light, learn the lifts)
- [ ] Gym Day 3 — Fri 2026-07-17 — Workout A — technique focus (light, learn the lifts)
- [ ] Gym Day 4 — Mon 2026-07-20 — Workout B — progressive overload
- [ ] Gym Day 5 — Wed 2026-07-22 — Workout A — progressive overload
- [ ] Gym Day 6 — Fri 2026-07-24 — Workout B — progressive overload
- [ ] Gym Day 7 — Mon 2026-07-27 — Workout A — progressive overload
- [ ] Gym Day 8 — Wed 2026-07-29 — Workout B — progressive overload
- [ ] Gym Day 9 — Fri 2026-07-31 — Workout A — progressive overload
- [ ] Gym Day 10 — Mon 2026-08-03 — Workout B — progressive overload
- [ ] Gym Day 11 — Wed 2026-08-05 — Workout A — progressive overload
- [ ] Gym Day 12 — Fri 2026-08-07 — Workout B — progressive overload
- [ ] Gym Day 13 — Mon 2026-08-10 — Workout A — progressive overload
- [ ] Gym Day 14 — Wed 2026-08-12 — Workout B — progressive overload
- [ ] ⛳ Gym Day 15 — Fri 2026-08-14 — GYM GATE: Workout A + technique & progress check

## Euro trip 🗺️ (planning sessions)

- [ ] Sat 2026-07-25 — Euro trip planning session 1 (routing France/Portugal/Spain/Germany)
- [ ] Sat 2026-08-08 — Euro trip planning session 2 (bookings, day-by-day)
````

### 6.3 · TESTS.md
````markdown
# TESTS — written up front, never softened later

These are your trust anchors. On a gate day, say "test me on <gate>" and Claude administers exactly this, grades against the stated threshold, and shows its work. Failing a gate triggers remediation (retake), never silent advancement.

## fr-gate-1 — Café/Restaurant (Day 7)
Roleplay: Claude is a waiter; all in French, no English hints during the test.
Tasks: (1) greet politely, (2) order a drink + a dish using "je voudrais", (3) ask the price / ask for the bill, (4) handle one curveball ("we're out of that" → order something else), (5) pay and thank.
Pass: ≥4/5 tasks completed intelligibly with correct politeness (bonjour/s'il vous plaît/merci). Numbers understood when the total is said aloud.

## fr-gate-2 — Getting around & shopping (Day 14)
Tasks: (1) ask where something is and understand gauche/droite/tout droit, (2) buy a métro or train ticket (aller simple/retour), (3) in a shop, say what you're looking for and ask "vous avez...?", (4) ask + understand a price, (5) ask one clarifying question ("pouvez-vous répéter ?").
Pass: ≥4/5, and you correctly act on at least one set of spoken directions.

## fr-gate-3 — Social (Day 21)
Roleplay: meeting your girlfriend's friend.
Tasks: (1) introduce yourself + one fact about you, (2) small talk (how are you / weekend), (3) express a like/dislike, (4) propose a plan ("on peut... ?"), (5) agree on a time.
Pass: ≥4/5, conversation sustained ~2 min without switching to English.

## fr-final — Sustained travel roleplay (Day 34 = THE GOAL)
One continuous scene, ~6–8 min: arrive → taxi/metro → check in / meet at apartment → café order → a shop errand → short social chat → resolve one problem (wrong order or asking for help).
Pass: completes ALL 6 segments intelligibly; recovers from at least one misunderstanding using a clarifying phrase; politeness consistent throughout. This = "can order and deal with French people on the trip." 

## gym-gate — Technique + progression (Day 15 gym session, Aug 14)
Checked against LOG.md, not vibes.
Criteria (all four): (1) Technique cues met on squat/hinge/press/pull per your filmed self-checks; (2) at least one working lift shows a load OR rep increase vs Week 1 (double progression evidence in the log); (3) session adherence ≥ 80% (≥12 of 15 sessions done); (4) no training-through-pain incidents logged.
Fail on adherence → this routes to ADAPT (shrink the program), not shame.
````

### 6.4 · DAILY-TEMPLATE.md
````markdown
# Daily session structure

## French 🇫🇷 (~25 min) — say "run french day N"
1. Retrieval warm-up (5 min) — Claude quizzes 3–5 items from earlier days (spaced schedule). Graded.
2. One new thing (8 min) — the day's topic from SCHEDULE.md. Depth over coverage.
3. Active practice (10 min) — you SPEAK/produce: roleplay, say it aloud, build sentences. Not just reading.
4. Exit ticket (2 min) — 1–2 questions on today. Becomes tomorrow's warm-up pool.
5. Log — Claude appends result to LOG.md.
Lunch (12–1) optional: 5-min flashcard-style review of the morning's exit ticket.

## Gym 🏋️ (~45–60 min) — say "run gym day N"
1. Warm-up + cue recall (8 min) — general warm-up; Claude quizzes today's technique cues.
2. Primary progression — today's main lifts per double-progression rule.
3. Working sets (active practice) — log load × reps × RPE for every set.
4. Exit check — one technique self-check question + film your top set if unsure.
5. Log — append loads/reps + difficulty (1–5) to LOG.md.

## Trip 🗺️ — say "run trip planning"
Claude works the France/Portugal/Spain/Germany routing with you and can build the live itinerary with maps.
````

### 6.5 · LOG.md (append-only)
````markdown
# LOG — append-only. Never rewrite history; adaptation edits the future schedule only.

Format (French): FR Day N | date | done/partial/missed | exit X/Y | difficulty 1-5 | notes
Format (Gym):    Gym Day N | date | done/partial/missed | key lifts load×reps | difficulty 1-5 | notes
Format (Gate):   GATE <id> | date | PASS/FAIL score | weak areas

--- entries below ---
````

---

## 7 · File manifest

| File | Purpose |
|---|---|
| `command-center.html` | The working prototype (Section 4) |
| `learning-architect.skill` | Packaged Claude skill (Section 5) |
| `PLAN.md` | Goal, cited sources, phases, gate pointers, adaptation rules |
| `SCHEDULE.md` | Every session/gate with dates + checkboxes |
| `TESTS.md` | Gate tests & pass criteria, written up front |
| `DAILY-TEMPLATE.md` | The fixed 5-step session structure |
| `LOG.md` | Append-only progress log |
| `calendar.ics` | Importable calendar (51 events) |

*End of handoff.*
