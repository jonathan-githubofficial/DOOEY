// =============================================================================
// DOOEY Lynx migration - CONTINUATION 1 (after run wf_746363cc-678 halted at L1).
// Hand-authored per the resume caveat: do not edit + resume the original harness.
// State at start: HEAD=a3c175f (1.3 committed; 1.1/1.2 committed earlier); units
// 1.4 + 1.5 complete-but-uncommitted in the worktree; 1.6 not started. Root cause
// and the fix are pinned as ruling R11 in orchestration-framework.md (read it).
// =============================================================================

export const meta = {
  name: 'dooey-lynx-migration-cont1',
  description: 'Continuation: repair L1 web-worker storage seam per R11, finish L1, then layers L2-L8, validation, digest',
  phases: [
    { title: 'L1 repair',      detail: 'apply ruling R11 (cross-thread storage seam), commit 1.4 + 1.5, run 1.6' },
    { title: 'Execute layers', detail: 'L2..L8 serial; one worker per unit; cheap gate per layer; heavy rescue' },
    { title: 'Validation',     detail: 'staged full-suite validation against disposable PocketBase' },
    { title: 'Digest',         detail: 'manifest + operator digest' },
  ],
}

const M = { brain: 'fable', heavy: 'opus', normal: 'sonnet', cheap: 'haiku' }

const REPO      = 'C:/Croesus/Central/Repos/test2/DOOEY'
const WORKTREE  = REPO + '/.worktrees/lynx'
const BRANCH    = 'lynx/migration'
const PACKAGE   = WORKTREE + '/docs/lynx-run'
const STORIES   = PACKAGE + '/stories'
const FRAMEWORK = PACKAGE + '/orchestration-framework.md'
const PLAN      = WORKTREE + '/docs/lynx-migration.md'

const SAFETY = [
  'HARD RULES (full charter in ' + FRAMEWORK + ' - read it FIRST, it is authoritative; rulings R1-R12 pre-answer STOPs):',
  `- Work ONLY inside ${WORKTREE} on branch ${BRANCH}. Never modify the main tree at ${REPO} outside the worktree.`,
  '- NEVER touch pb/pb_data (operator\'s real data). Disposable PB lives under .scratch/pb-e2e/ on port 8091 only.',
  '- Never push / PR / merge / tag. Commit locally per unit: "lynx(<unit-id>): <summary>". Never git stash.',
  '- Deletions: only `git rm` of files your story explicitly brooms out. Nothing else. Never clean .scratch.',
  '- Non-interactive always (--yes/CI=1/template flags). A TTY prompt freezes the run.',
  '- Credentials via env or gitignored files only; never inline in commands.',
  '- On ambiguity beyond your story AND the rulings, return status "blocked" with the exact question. Do not improvise.',
  '- Grep before read; read ranges not whole files; return the CONTRACT only.',
  '- Lynx APIs: when uncertain, FETCH the official doc page (crib sheet in the framework). Do not guess.',
  '',
  'YOU ARE THE EXECUTOR, NOT A DISPATCHER. Do the work yourself with foreground tools.',
  'Do NOT spawn sub-agents, do NOT dispatch background workers, do NOT wait for phantom agents.',
  'A dev/PB server may be ONE background process each; kill what you start unless the story says otherwise.',
].join('\n')

// Layers L2..L8 (L1 finishes in the repair phase). Identical to the original harness.
const LAYERS = [
  { id: 'L2-design', tier: M.normal, tag: '@l2',
    units: ['2.1-fonts.md', '2.2-grain-backdrop.md', '2.3-primitives.md', '2.4-icons.md'],
    note: 'Design system. Primitives gallery route is the E2E surface.' },
  { id: 'L3-shell-auth', tier: M.heavy, tag: '@l3',
    units: ['3.1-router-guard.md', '3.2-auth-ui-session.md', '3.3-dock-masthead-account.md', '3.4-style-theme.md'],
    note: 'HIGH-RISK: auth/session semantics. Ruling R11 applies: theme via root-view CSS vars, never document.' },
  { id: 'L4-tasks', tier: M.heavy, tag: '@l4',
    units: ['4.2-task-pages.md', '4.3-interactions-sheets.md', '4.1-today-composer-habits.md'],
    note: 'Core domain. Land order per ruling R4. Rulings R1 (habits gap) and R7 (file picking) apply.' },
  { id: 'L5-calendar', tier: M.heavy, tag: '@l5',
    units: ['5.1-calendar-views.md', '5.2-timebox-drag.md', '5.3-gcal-events.md'],
    note: 'MTS gesture work. Rulings R2/R3/R9 apply. gcal fixtures seeded as superuser, never real Google.' },
  { id: 'L6-learning', tier: M.normal, tag: '@l6',
    units: ['6.1-projects-page.md', '6.2-program-detail.md', '6.3-program-sync.md'],
    note: 'verify-program/push-program scripts must stay working against the disposable PB.' },
  { id: 'L7-boards', tier: M.heavy, tag: '@l7',
    units: ['7.1-boards-list.md', '7.2-board-canvas.md', '7.3-doodles.md'],
    note: 'Hardest layer (PLAN 5.5): <svg> + MTS freehand + drag. Ruling R9 applies to E2E gesture specs.' },
  { id: 'L8-cutover', tier: M.normal, tag: '@l8',
    units: ['8.1-web-deploy.md', '8.2-broom-audit.md', '8.3-claude-md-docs.md',
            '8.4-full-e2e-parity.md', '8.5-native-hosts-runbook.md'],
    note: 'Cutover prep. R11: prod host page registers NativeStorageModule + passes same-origin. R12: stop watchers before the src-legacy broom. 8.5 writes the manual native runbook.' },
]

const UNIT_RESULT = {
  type: 'object', additionalProperties: false, required: ['unit', 'status'],
  properties: {
    unit:    { type: 'string' },
    status:  { type: 'string', enum: ['done', 'noop', 'failed', 'blocked'] },
    verify:  { type: 'string' }, changed: { type: 'string' }, broom: { type: 'string' },
    parked:  { type: 'string' }, commit: { type: 'string' }, note: { type: 'string' },
  },
}
const GATE = {
  type: 'object', additionalProperties: false, required: ['green'],
  properties: { green: { type: 'boolean' }, ran: { type: 'string' },
                failures: { type: 'array', items: { type: 'string' } } },
}
const VALIDATION = {
  type: 'object', additionalProperties: false, required: ['passed'],
  properties: { passed: { type: 'boolean' }, envReset: { type: 'boolean' },
                stagesRun: { type: 'string' }, failures: { type: 'array', items: { type: 'string' } } },
}
const DIGEST = {
  type: 'object', additionalProperties: false, required: ['done', 'blocked', 'recommendation'],
  properties: { done: { type: 'number' }, blocked: { type: 'number' },
                remainingRisk: { type: 'array', items: { type: 'string' } },
                recommendation: { type: 'string' } },
}

function unitPrompt(layer, unitFile, priorNote) {
  return [
    `GOAL: Complete unit ${unitFile} of layer ${layer.id} on branch ${BRANCH}.`,
    ``,
    `SCOPE:`,
    `- Worktree: ${WORKTREE}. Lower layers and earlier units in this layer are already committed.`,
    `- Read ${FRAMEWORK} first (charter + rulings R1-R12 + Lynx crib), then your story: ${STORIES}/${unitFile}.`,
    `- The story is AUTHORITATIVE for this unit, EXCEPT where a ruling (R1-R12) overrides it. The PLAN (${PLAN}) is background.`,
    `- Out of bounds: every other unit's scope; anything the story lists as out of bounds.`,
    layer.note ? `- Layer note: ${layer.note}` : ``,
    priorNote ? `- PRIOR ATTEMPT EVIDENCE (do not rediscover): ${priorNote}` : ``,
    ``,
    SAFETY,
    ``,
    `EXECUTION: make the change, run the story's DONE MEANS commands yourself, then commit`,
    `("lynx(${unitFile.replace('.md', '')}): ..."). If verification fails after a genuine fix attempt,`,
    `return status "failed" with evidence. If blocked on ambiguity/high-risk, return "blocked" with the exact question.`,
    ``,
    `GREEN IS SCOPE-DEFINED: your unit's checks passing = green, even if not-yet-migrated files elsewhere`,
    `do not build. Note such expected breakage in "note", do not chase it.`,
    ``,
    `CONTRACT: return UNIT_RESULT json only.`,
  ].filter(Boolean).join('\n')
}

function gatePrompt(layer, tags) {
  return [
    `GOAL: Run layer gate for ${layer.id} in ${WORKTREE} and report facts. You change NOTHING.`,
    ``,
    `RUN (in order, stop at first hard failure):`,
    `  1. npm run typecheck`,
    `  2. npm run build`,
    `  3. Start the disposable PB + web server per e2e/README.md, then`,
    `     npx playwright test --grep "${tags}"   (cumulative tags: earlier layers must stay green)`,
    `  4. Stop servers you started.`,
    ``,
    SAFETY,
    ``,
    `CONTRACT: return GATE json only. failures[] = FAILURES ONLY with file:line.`,
  ].join('\n')
}

const ALL_TAGS = ['@l1', '@l2', '@l3', '@l4', '@l5', '@l6', '@l7', '@l8']
function cumulativeTags(layerIdx) { return ALL_TAGS.slice(0, layerIdx + 2).join('|') } // +2: @l1 always included

async function runUnit(layer, unitFile) {
  let res = await agent(unitPrompt(layer, unitFile),
    { label: `unit:${unitFile.replace('.md', '')}`, phase: 'Execute layers', model: layer.tier, schema: UNIT_RESULT })
  if (!res) { res = { unit: unitFile, status: 'failed', note: 'agent died' } }
  if ((res.status === 'failed' || res.status === 'blocked') && layer.tier !== M.heavy) {
    log(`escalating ${unitFile} (${res.status}) -> heavy`)
    const rescued = await agent(unitPrompt(layer, unitFile, `${res.status}: ${res.note || res.verify || 'n/a'}`),
      { label: `rescue:${unitFile.replace('.md', '')}`, phase: 'Execute layers', model: M.heavy, schema: UNIT_RESULT })
    if (rescued) { res = rescued }
  }
  return res
}

async function haltDigest(reason, evidence) {
  return agent(
    `GOAL: You are the top brain. Write the HALT digest for the operator. The run stopped: ${reason}\n` +
    `Evidence: ${JSON.stringify(evidence)}\n` +
    `CONTRACT: return DIGEST json - blocked count, remaining risk, and the EXACT human decision/action needed.`,
    { label: 'digest-halt', phase: 'Digest', model: M.brain, schema: DIGEST })
}

// =============================================================================
// PHASE: L1 repair (ruling R11)
// =============================================================================
phase('L1 repair')

const repair = await agent(
  `GOAL: Repair the L1 web-worker storage/BOM defect per ruling R11, then land units 1.4 and 1.5 as their own\n` +
  `green commits, in that order.\n` +
  `\n` +
  `CONTEXT (verified by the prior run - do NOT rediscover): HEAD=a3c175f (1.3). Units 1.4 (PB seam) and 1.5\n` +
  `(E2E oracle) are complete-but-uncommitted in the worktree. On the Lynx web target the app runs in a Web\n` +
  `Worker with NO window/document/localStorage; module-init reads of appStorage/localStorage and\n` +
  `applyTheme/applyStyle -> document.documentElement crash the background thread. The E2E harness itself is\n` +
  `green and correctly exposes this: @l1's SSE step is red because the worker dies at boot.\n` +
  `\n` +
  `SCOPE (in order):\n` +
  `1. Read ${FRAMEWORK} - ruling R11 is the AUTHORITATIVE design: a NativeStorageModule (async\n` +
  `   getItem/setItem/removeItem) registered by the HOST PAGE backed by main-thread localStorage; app-side\n` +
  `   lib/storage.ts talks to it with an in-memory fallback + one console.warn; async AsyncAuthStore\n` +
  `   hydration; theme/style application via a state-driven root-view CSS-var seam (no document, minimal now,\n` +
  `   3.4 completes it); PB origin from host page (globalProps or equivalent) with PUBLIC_PB_URL as the\n` +
  `   build-time override. Verify the exact native-module registration mechanism for @lynx-js/web-core@0.22.2\n` +
  `   from node_modules source + https://lynxjs.org/guide/use-native-modules BEFORE wiring.\n` +
  `2. Implement R11 across the affected files (src/lib/storage.ts, src/lib/pb.ts, src/index.tsx,\n` +
  `   src/stores/theme.ts, src/features/style/store.ts - 1.3-owned files are in scope for THIS repair),\n` +
  `   update the e2e host page + boot-probe host to register the module, realign e2e/README.md and the @l1\n` +
  `   sign-in seeding note (key "pb_auth" in main-thread localStorage) if needed.\n` +
  `3. Prove it: 1.4's boot probe green AND \`npx playwright test --grep @l1\` FULLY green (boot +\n` +
  `   programmatic sign-in + SSE live-record proof) against a fresh disposable PB. Also confirm a page\n` +
  `   reload retains the session (R11's whole point) - add this assertion to the @l1 spec if absent.\n` +
  `4. Commit in TWO scoped commits: first "lynx(1.4-pb-client-seam): ..." (seam + R11 fix incl. the 1.3-owned\n` +
  `   store fixes), then "lynx(1.5-e2e-oracle): ..." (e2e/, playwright.config.ts, package.json test scripts +\n` +
  `   @playwright/test dep + lockfile). package-lock.json belongs to whichever commit adds its deps; if the\n` +
  `   lock mixes both units' deps, regenerate per commit (npm install after staging each package.json state)\n` +
  `   or, failing that, put the lockfile in the 1.5 commit with a note.\n` +
  `5. FALLBACK (only after a genuine failed attempt at the module mechanism): implement R11's in-memory\n` +
  `   fallback path, record "web reload-persistence parity gap" prominently in your note, and still land\n` +
  `   both commits with @l1 green except the reload assertion (mark it test.fixme with the gap reference).\n` +
  `\n` +
  SAFETY + `\n\n` +
  `CONTRACT: return UNIT_RESULT json (unit: "1.4+1.5-R11-repair"). verify = the exact commands + FAILURES\n` +
  `ONLY. note = which R11 path shipped (NativeModule or fallback) + the registration mechanism used.`,
  { label: 'repair:R11-seam', phase: 'L1 repair', model: M.heavy, schema: UNIT_RESULT })

if (!repair || repair.status === 'blocked' || repair.status === 'failed') {
  log('R11 repair did not land - halting.')
  return { haltedAt: 'L1-repair', repair, digest: await haltDigest('R11 repair failed/blocked', repair) }
}

const L1 = { id: 'L1-foundation', tier: M.heavy, tag: '@l1',
  note: 'Finishing L1: only 1.6 remains. R12 applies (Windows dir-handle locks on android/ ios/ removal).' }
const u16 = await runUnit(L1, '1.6-capacitor-teardown.md')

let l1gate = null
if (u16.status === 'done' || u16.status === 'noop') {
  l1gate = await agent(gatePrompt(L1, '@l1'),
    { label: 'gate:L1-foundation', phase: 'L1 repair', model: M.cheap, schema: GATE })
}
const l1green = (u16.status === 'done' || u16.status === 'noop') && !!l1gate && l1gate.green !== false
const l1result = { layer: 'L1-foundation', green: l1green,
  units: [repair, u16], gate: l1gate, note: 'continuation: 1.1-1.3 landed in run 1 (e312a79/b8d2825/a3c175f)' }
if (!l1green) {
  log('L1 still not green after repair - halting.')
  return { haltedAt: 'L1-foundation', layers: [l1result],
           digest: await haltDigest('L1 not green after R11 repair', l1result) }
}
log('L1 green. Proceeding to L2..L8.')

// =============================================================================
// PHASE: Execute layers L2..L8
// =============================================================================
phase('Execute layers')
const layerResults = [l1result]
for (let i = 0; i < LAYERS.length; i++) {
  const layer = LAYERS[i]
  const units = []
  for (const u of layer.units) {
    units.push(await runUnit(layer, u))
  }
  const badUnits = units.filter(x => x.status === 'failed' || x.status === 'blocked')
  let gate = null
  if (badUnits.length === 0) {
    gate = await agent(gatePrompt(layer, cumulativeTags(i)),
      { label: `gate:${layer.id}`, phase: 'Execute layers', model: M.cheap, schema: GATE })
    if (gate && gate.green === false && (gate.failures || []).length) {
      log(`gate ${layer.id} red -> one heavy repair pass`)
      const rep = await agent(
        `GOAL: The ${layer.id} layer gate failed AFTER all units reported green. Diagnose and repair IN SCOPE of\n` +
        `this layer only, then re-run the gate commands yourself until green or genuinely stuck.\n` +
        `Gate evidence: ${JSON.stringify(gate)}\n` +
        `Read ${FRAMEWORK}; stories in ${STORIES} (this layer: ${layer.units.join(', ')}).\n` +
        `Environment-first diagnosis: logs/screenshots/traces BEFORE editing code. Commit fixes\n` +
        `"lynx(${layer.id}-gate-fix): ...".\n\n` + SAFETY + `\n\n` +
        `CONTRACT: return GATE json reflecting the FINAL state after your repair attempt.`,
        { label: `repair:${layer.id}`, phase: 'Execute layers', model: M.heavy, schema: GATE })
      if (rep) { gate = rep }
    }
  }
  const green = badUnits.length === 0 && !!gate && gate.green !== false
  const res = { layer: layer.id, green, units, gate }
  layerResults.push(res)
  if (!green) {
    log(`Layer ${layer.id} not green - halting the chain (downstream depends on it).`)
    return { haltedAt: layer.id, layers: layerResults,
             digest: await haltDigest(`Layer ${layer.id} not green; downstream depends on it`, res) }
  }
  log(`Layer ${layer.id} green (${units.length} units).`)
}

// =============================================================================
// PHASE: Validation
// =============================================================================
phase('Validation')
const validation = await agent(
  `GOAL: Validate the completed migration end-to-end from ${WORKTREE} (branch ${BRANCH}).\n` +
  `SCOPE: fresh build; NEW disposable PB data dir (reset = new dir under .scratch/pb-e2e/, never delete old\n` +
  `ones, never touch pb/pb_data); then the STAGED ladder from ${FRAMEWORK}:\n` +
  `  typecheck -> build -> lint -> boot smoke (@l1) -> auth (@l3) -> one write (@l4) -> tags @l2..@l8 in order\n` +
  `  -> full suite (only if all stages green). Short timeouts early; stop at the first REAL app defect and\n` +
  `  diagnose (server logs + screenshots + traces FIRST). Fixture/flake issues may continue but are noted.\n` +
  `Also confirm: old src-legacy/ broom record exists (8.2), CLAUDE.md updated (8.3), web output lands where\n` +
  `the Dockerfile expects it and the prod host page registers NativeStorageModule per R11 (8.1).\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: return VALIDATION json (passed, envReset, stagesRun, failures[] FAILURES ONLY).`,
  { label: 'validation', phase: 'Validation', model: M.heavy, schema: VALIDATION })

// =============================================================================
// PHASE: Digest
// =============================================================================
phase('Digest')
await agent(
  `GOAL: Persist the run manifest.\n` +
  `Write ${PACKAGE}/run-manifest.json (pretty-printed) with exactly this JSON, then commit\n` +
  `"lynx(manifest): run manifest (continuation 1; run 1 was wf_746363cc-678, halted at L1, root cause R11)":\n` +
  JSON.stringify({ continuationOf: 'wf_746363cc-678', layers: layerResults, validation }) + `\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: one line confirming the file was written and committed.`,
  { label: 'manifest', phase: 'Digest', model: M.cheap })

const digest = await agent(
  `GOAL: You are the top brain. Write the operator digest (the final answer).\n` +
  `Layers: ${JSON.stringify(layerResults.map(l => ({ layer: l.layer, green: l.green, units: (l.units || []).map(u => ({ unit: u.unit, status: u.status, parked: u.parked || undefined })) })))}\n` +
  `Validation: ${JSON.stringify(validation)}\n` +
  `CONTRACT: return DIGEST json. done vs blocked unit counts; remainingRisk MUST include everything parked as\n` +
  `native-unverifiable (iOS/Android hosts, PrimJS TextDecoder, on-device fonts/perf, native NativeStorageModule\n` +
  `impl) plus the recorded parity gaps (habits R1; file-picking R7 outcome; R11 outcome) and anything\n` +
  `proven-but-not-exercised; ONE recommendation. Branch ${BRANCH} in ${WORKTREE} is ready for the OPERATOR\n` +
  `to review, push (explicit upstream, never a bare first push), and open the PR. Terse.`,
  { label: 'digest', phase: 'Digest', model: M.brain, schema: DIGEST })

return { digest, validation, layers: layerResults }
