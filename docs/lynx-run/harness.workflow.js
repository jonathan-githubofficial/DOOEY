// =============================================================================
// DOOEY Capacitor -> Lynx migration - deterministic control plane.
// Adapted from the autonomous-multi-agent-initiative skeleton.
// Judgment lives at the brain nodes; this script only routes, gates, resumes.
// It commits locally on lynx/migration and NEVER pushes / PRs / merges.
// =============================================================================

export const meta = {
  name: 'dooey-lynx-migration',
  description: 'Full Capacitor->Lynx client migration of DOOEY per docs/lynx-migration.md, web-parity verified',
  phases: [
    { title: 'Rehearsal',      detail: 'prove every capability AND permission with real actions' },
    { title: 'Spike',          detail: 'PLAN Phase 0 go/no-go: rspeedy+PB+SSE+tailwind+svg+lucide on web target' },
    { title: 'Plan',           detail: 'top-brain sanity check of layer order and tiers' },
    { title: 'Setup',          detail: 'verify worktree/branch exist (idempotent, never destructive)' },
    { title: 'Execute layers', detail: 'L1..L8 serial; one worker per unit; cheap gate per layer; heavy rescue' },
    { title: 'Validation',     detail: 'staged full-suite validation against disposable PocketBase' },
    { title: 'Digest',         detail: 'manifest + operator digest' },
  ],
}

// ---- tiers ------------------------------------------------------------------
const M = { brain: 'fable', heavy: 'opus', normal: 'sonnet', cheap: 'haiku' }

// ---- locations (forward slashes; git bash on Windows) -------------------------
const REPO      = 'C:/Croesus/Central/Repos/test2/DOOEY'
const WORKTREE  = REPO + '/.worktrees/lynx'
const BRANCH    = 'lynx/migration'
const BASE_REF  = 'main'
const PACKAGE   = WORKTREE + '/docs/lynx-run'
const STORIES   = PACKAGE + '/stories'
const FRAMEWORK = PACKAGE + '/orchestration-framework.md'
const PLAN      = WORKTREE + '/docs/lynx-migration.md'
const SCRATCH   = WORKTREE + '/.scratch'

// ---- injected into EVERY worker prompt ----------------------------------------
const SAFETY = [
  'HARD RULES (full charter in ' + FRAMEWORK + ' - read it FIRST, it is authoritative):',
  `- Work ONLY inside ${WORKTREE} on branch ${BRANCH}. Never modify the main tree at ${REPO} outside the worktree.`,
  '- NEVER touch pb/pb_data (operator\'s real data). Disposable PB lives under .scratch/pb-e2e/ on port 8091 only.',
  '- Never push / PR / merge / tag. Commit locally per unit: "lynx(<unit-id>): <summary>". Never git stash.',
  '- Deletions: only `git rm` of files your story explicitly brooms out. Nothing else. Never clean .scratch.',
  '- Non-interactive always (--yes/CI=1/template flags). A TTY prompt freezes the run.',
  '- Credentials via env or gitignored files only; never inline in commands.',
  '- On ambiguity beyond your story, or HIGH-RISK calls (auth semantics, data shapes, pb_migrations, pb_hooks),',
  '  return status "blocked" with the exact question. Do not improvise.',
  '- Grep before read; read ranges not whole files; return the CONTRACT only.',
  '- Lynx APIs: when uncertain, FETCH the official doc page (crib sheet in the framework). Do not guess.',
  '',
  'YOU ARE THE EXECUTOR, NOT A DISPATCHER. Do the work yourself with foreground tools.',
  'Do NOT spawn sub-agents, do NOT dispatch background workers, do NOT wait for phantom agents.',
  'A dev/PB server may be ONE background process each; kill what you start unless the story says otherwise.',
].join('\n')

// ---- layers -------------------------------------------------------------------
// gateTags accumulate: a layer's gate runs its own tag plus every earlier tag.
const LAYERS = [
  { id: 'L1-foundation', tier: M.heavy, tag: '@l1',
    units: ['1.1-scaffold-rspeedy.md', '1.2-port-pure-logic.md', '1.3-port-stores-and-api.md',
            '1.4-pb-client-seam.md', '1.5-e2e-oracle.md', '1.6-capacitor-teardown.md'],
    note: 'Foundation barrier. E2E oracle exists only after 1.5; earlier units gate on typecheck+build.' },
  { id: 'L2-design', tier: M.normal, tag: '@l2',
    units: ['2.1-fonts.md', '2.2-grain-backdrop.md', '2.3-primitives.md', '2.4-icons.md'],
    note: 'Design system. Primitives gallery route is the E2E surface.' },
  { id: 'L3-shell-auth', tier: M.heavy, tag: '@l3',
    units: ['3.1-router-guard.md', '3.2-auth-ui-session.md', '3.3-dock-masthead-account.md', '3.4-style-theme.md'],
    note: 'HIGH-RISK: auth/session semantics. No improvisation; blocked > wrong.' },
  { id: 'L4-tasks', tier: M.heavy, tag: '@l4',
    units: ['4.2-task-pages.md', '4.3-interactions-sheets.md', '4.1-today-composer-habits.md'],
    note: 'Core domain. Land order per ruling R4 (intra-layer deps). Full task lifecycle + realtime is the gate.' },
  { id: 'L5-calendar', tier: M.heavy, tag: '@l5',
    units: ['5.1-calendar-views.md', '5.2-timebox-drag.md', '5.3-gcal-events.md'],
    note: 'MTS gesture work. gcal events come from seeded fixtures, never real Google.' },
  { id: 'L6-learning', tier: M.normal, tag: '@l6',
    units: ['6.1-projects-page.md', '6.2-program-detail.md', '6.3-program-sync.md'],
    note: 'verify-program/push-program scripts must stay working against the disposable PB.' },
  { id: 'L7-boards', tier: M.heavy, tag: '@l7',
    units: ['7.1-boards-list.md', '7.2-board-canvas.md', '7.3-doodles.md'],
    note: 'Hardest layer (PLAN 5.5): <svg> + MTS freehand + drag.' },
  { id: 'L8-cutover', tier: M.normal, tag: '@l8',
    units: ['8.1-web-deploy.md', '8.2-broom-audit.md', '8.3-claude-md-docs.md',
            '8.4-full-e2e-parity.md', '8.5-native-hosts-runbook.md'],
    note: 'Cutover prep. 8.5 WRITES the manual native runbook (doable here); native execution stays parked.' },
]

// ---- schemas --------------------------------------------------------------------
const UNIT_RESULT = {
  type: 'object', additionalProperties: false, required: ['unit', 'status'],
  properties: {
    unit:    { type: 'string' },
    status:  { type: 'string', enum: ['done', 'noop', 'failed', 'blocked'] },
    verify:  { type: 'string', description: 'commands run + FAILURES ONLY (green = one line)' },
    changed: { type: 'string', description: 'files + line ranges touched, terse' },
    broom:   { type: 'string', description: 'what was deliberately NOT ported, and why' },
    parked:  { type: 'string', description: 'what this machine could not verify' },
    commit:  { type: 'string', description: 'the unit commit hash' },
    note:    { type: 'string' },
  },
}
const GATE = {
  type: 'object', additionalProperties: false, required: ['green'],
  properties: {
    green:    { type: 'boolean' },
    ran:      { type: 'string', description: 'exact commands executed' },
    failures: { type: 'array', items: { type: 'string' }, description: 'FAILURES ONLY, file:line where possible' },
  },
}
const SPIKE = {
  type: 'object', additionalProperties: false, required: ['goNoGo'],
  properties: { goNoGo: { type: 'string', enum: ['go', 'no-go'] },
                findings: { type: 'array', items: { type: 'string' } } },
}
const REHEARSAL = {
  type: 'object', additionalProperties: false, required: ['ready'],
  properties: {
    capabilities: { type: 'boolean' }, permissions: { type: 'boolean' },
    ready:        { type: 'boolean', description: 'true ONLY if both above are true' },
    notes:        { type: 'array', items: { type: 'string' } },
  },
}
const VALIDATION = {
  type: 'object', additionalProperties: false, required: ['passed'],
  properties: {
    passed: { type: 'boolean' }, envReset: { type: 'boolean' },
    stagesRun: { type: 'string' },
    failures: { type: 'array', items: { type: 'string' }, description: 'FAILURES ONLY' },
  },
}
const DIGEST = {
  type: 'object', additionalProperties: false, required: ['done', 'blocked', 'recommendation'],
  properties: {
    done: { type: 'number' }, blocked: { type: 'number' },
    remainingRisk: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
  },
}

// ---- prompt builders --------------------------------------------------------------
function unitPrompt(layer, unitFile, priorNote) {
  return [
    `GOAL: Complete unit ${unitFile} of layer ${layer.id} on branch ${BRANCH}.`,
    ``,
    `SCOPE:`,
    `- Worktree: ${WORKTREE}. Lower layers and earlier units in this layer are already committed.`,
    `- Read ${FRAMEWORK} first (charter + Lynx crib sheet), then your story: ${STORIES}/${unitFile}.`,
    `- The story is AUTHORITATIVE for this unit. The PLAN (${PLAN}) is background.`,
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
    `  3. If e2e/ exists: start the disposable PB + web server per e2e/README.md, then`,
    `     npx playwright test --grep "${tags}"   (cumulative tags: earlier layers must stay green)`,
    `  4. Stop servers you started.`,
    `If a command does not exist yet (pre-1.5 world), note it and skip that step - not a failure.`,
    ``,
    SAFETY,
    ``,
    `CONTRACT: return GATE json only. failures[] = FAILURES ONLY with file:line; green passing = ran + green:true.`,
  ].join('\n')
}

function cumulativeTags(idx) {
  return LAYERS.slice(0, idx + 1).map(l => l.tag).join('|')
}

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
// RUN
// =============================================================================

// ---- Rehearsal FIRST: permissions fail at minute 5, not hour 5 -------------------
phase('Rehearsal')
const rehearsal = await agent(
  `GOAL: Prove with REAL actions, from ${WORKTREE}, that every capability AND command shape this run needs works.\n` +
  `Do each item for real; report pass/fail per item:\n` +
  `  1. npm ci   (registry reachable, install allowed).\n` +
  `  2. npm run build   (baseline Vite app still green on the branch tip).\n` +
  `  3. git add/commit round-trip: create ${PACKAGE}/rehearsal.txt with one line, commit "lynx(rehearsal): permission check".\n` +
  `  4. Disposable PocketBase: pb/pocketbase.exe serve --http 127.0.0.1:8091 --dir .scratch/rehearsal/pb_data\n` +
  `     --migrationsDir pb/pb_migrations --hooksDir pb/pb_hooks (background); curl its health endpoint;\n` +
  `     create a superuser non-interactively (generated password saved to .scratch/rehearsal/creds.json);\n` +
  `     then stop the process. NEVER touch pb/pb_data.\n` +
  `  5. Headless Chromium: npx -y playwright install chromium, then screenshot http://127.0.0.1:8091/_/ while PB runs.\n` +
  `  6. Fetch https://lynxjs.org/guide/start/quick-start (network doc access for Lynx APIs).\n` +
  `  7. Confirm npx/npm exec of a scoped package works non-interactively (e.g. npx -y cowsay@1 hi || any trivial pkg).\n` +
  `If ANY item is denied by permissions (even a phantom rule) or fails, say exactly which and how.\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: return REHEARSAL json. ready=true ONLY if capabilities AND permissions both fully pass.`,
  { label: 'rehearsal', phase: 'Rehearsal', model: M.heavy, schema: REHEARSAL })
if (!rehearsal || !rehearsal.ready) {
  log('Rehearsal failed - halting before any real work.')
  return { haltedAt: 'rehearsal', rehearsal, digest: await haltDigest('Capability/permission rehearsal failed', rehearsal) }
}

// ---- Spike: PLAN Phase 0, scoped to what this box can prove ----------------------
phase('Spike')
const spike = await agent(
  `GOAL: Execute PLAN Phase 0 (de-risk spike) scoped to the web target, in a THROWAWAY app under ${SCRATCH}/spike/.\n` +
  `Read ${FRAMEWORK} and PLAN section "Phase 0" + section 9 (${PLAN}). Prove, with a real running app:\n` +
  `  1. npm create rspeedy@latest scaffolds non-interactively; rspeedy build produces WEB output that boots\n` +
  `     in headless Chromium (render "hello" text; screenshot as evidence).\n` +
  `  2. PocketBase auth + a realtime subscription round-trip from the Lynx web app against the disposable PB\n` +
  `     (port 8091, .scratch/pb-e2e/ or .scratch/spike/pb_data - NEVER pb/pb_data): create record via SDK,\n` +
  `     subscription event observed in the app.\n` +
  `  3. Tailwind v3 + @lynx-js/tailwind-preset: one tactile Panel with CSS-var tokens + soft shadow renders.\n` +
  `  4. Lynx <svg>: render a path; then append points to a path "d" from a pointer/gesture handler (freehand proof).\n` +
  `  5. lucide-react: does one icon render on the Lynx web target? yes/no + fallback note (PLAN 5.9).\n` +
  `  6. (ruling R9) Prove/disprove: Playwright-synthesized touch/pointer input reaching main-thread:bindtouch*\n` +
  `     handlers on the web target - record the exact working recipe or the failure.\n` +
  `  7. (ruling R6) Record the EXACT working create-rspeedy invocation + web-output config in the findings\n` +
  `     note so unit 1.1 reuses it verbatim.\n` +
  `Record honestly what is WEB-PROVEN vs NATIVE-UNKNOWN (PrimJS TextDecoder, Android fonts - this box cannot test\n` +
  `native; that is expected and NOT a no-go). no-go ONLY if a web-target fundamental is broken with no workaround\n` +
  `(e.g. rspeedy web output will not boot at all, or PB SSE cannot work on the web target).\n` +
  `Append a terse "## Phase 0 spike findings (this run)" section to ${PLAN} and commit "lynx(spike): phase 0 findings".\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: return SPIKE json (goNoGo, findings[] - one line each).`,
  { label: 'spike', phase: 'Spike', model: M.heavy, schema: SPIKE })
if (!spike || spike.goNoGo === 'no-go') {
  log('Spike = no-go - halting before any real work.')
  return { haltedAt: 'spike', spike, digest: await haltDigest('Phase 0 spike returned no-go', spike) }
}

// ---- Plan review (brain) -----------------------------------------------------------
phase('Plan')
const plan = await agent(
  `GOAL: You are the top brain. Sanity-check the run plan; do NOT re-plan.\n` +
  `Read ${FRAMEWORK}. Spike findings: ${JSON.stringify(spike.findings || [])}.\n` +
  `Single branch ${BRANCH}, serial bottom-up: ` + LAYERS.map(l => `${l.id}[${l.tier}]`).join(' -> ') + `, then validation.\n` +
  `CONTRACT (<=25 lines): "sound" + any SPECIFIC corrections (e.g. a spike finding that must amend a story -\n` +
  `name the story file and the exact amendment). Decisions only.`,
  { label: 'plan', phase: 'Plan', model: M.brain })
log('Plan review:\n' + plan)

// ---- Setup: idempotent verification only (worktree was created pre-launch) ---------
phase('Setup')
const setup = await agent(
  `GOAL: Verify the run environment. IDEMPOTENT - change nothing that exists.\n` +
  `Check: (a) 'git -C ${WORKTREE} branch --show-current' == ${BRANCH}; (b) ${STORIES} contains 31 story files;\n` +
  `(c) .scratch/ exists (create if missing - the ONLY allowed mutation); (d) 'git -C ${WORKTREE} status --short'\n` +
  `is clean or lists only .scratch. NEVER reset/checkout/-B/worktree-add if (a) holds. Existing commits on\n` +
  `${BRANCH} are prior work and MUST be preserved.\n` +
  `Only if the worktree is MISSING entirely: from ${REPO} run 'git worktree add --no-track -b ${BRANCH}\n` +
  `.worktrees/lynx ${BASE_REF}' (never -B).\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: one line - "ready" or the exact problem.`,
  { label: 'setup', phase: 'Setup', model: M.cheap })
log('Setup: ' + setup)
if (!setup || !String(setup).toLowerCase().includes('ready')) {
  return { haltedAt: 'setup', setup, digest: await haltDigest('Setup verification failed', setup) }
}

// ---- Execute layers: serial; per-unit workers; cheap gate; halt if not green --------
phase('Execute layers')
const layerResults = []
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
      const repair = await agent(
        `GOAL: The ${layer.id} layer gate failed AFTER all units reported green. Diagnose and repair IN SCOPE of\n` +
        `this layer only, then re-run the gate commands yourself until green or genuinely stuck.\n` +
        `Gate evidence: ${JSON.stringify(gate)}\n` +
        `Read ${FRAMEWORK}; stories in ${STORIES} (this layer: ${layer.units.join(', ')}).\n` +
        `Environment-first diagnosis: logs/screenshots/traces BEFORE editing code. Commit fixes\n` +
        `"lynx(${layer.id}-gate-fix): ...".\n\n` + SAFETY + `\n\n` +
        `CONTRACT: return GATE json reflecting the FINAL state after your repair attempt.`,
        { label: `repair:${layer.id}`, phase: 'Execute layers', model: M.heavy, schema: GATE })
      if (repair) { gate = repair }
    }
  }
  const green = badUnits.length === 0 && !!gate && gate.green !== false
  const res = { layer: layer.id, green, units, gate }
  layerResults.push(res)
  if (!green) {
    log(`Layer ${layer.id} not green - halting the chain (downstream depends on it).`)
    return {
      haltedAt: layer.id, layers: layerResults,
      digest: await haltDigest(`Layer ${layer.id} not green; downstream depends on it`, res),
    }
  }
  log(`Layer ${layer.id} green (${units.length} units).`)
}

// ---- Validation: full staged ladder on a FRESH disposable env -----------------------
phase('Validation')
const validation = await agent(
  `GOAL: Validate the completed migration end-to-end from ${WORKTREE} (branch ${BRANCH}).\n` +
  `SCOPE: fresh build; NEW disposable PB data dir (do not reuse a dirty one; reset = new dir under\n` +
  `.scratch/pb-e2e/, never delete old ones, never touch pb/pb_data); then the STAGED ladder from ${FRAMEWORK}:\n` +
  `  typecheck -> build -> lint -> boot smoke (@l1) -> auth (@l3) -> one write (@l4) -> tags @l2..@l8 in order\n` +
  `  -> full suite (only if all stages green). Short timeouts early; stop at the first REAL app defect and\n` +
  `  diagnose (server logs + screenshots + traces FIRST). Fixture/flake issues may continue but are noted.\n` +
  `Also confirm: old src/ broom record exists (8.2), CLAUDE.md updated (8.3), web output lands where the\n` +
  `Dockerfile expects it (8.1).\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: return VALIDATION json (passed, envReset, stagesRun, failures[] FAILURES ONLY).`,
  { label: 'validation', phase: 'Validation', model: M.heavy, schema: VALIDATION })

// ---- Manifest + digest ----------------------------------------------------------------
phase('Digest')
await agent(
  `GOAL: Persist the run manifest.\n` +
  `Write ${PACKAGE}/run-manifest.json (pretty-printed) with exactly this JSON, then commit\n` +
  `"lynx(manifest): run manifest":\n` + JSON.stringify({ rehearsal, spike, layers: layerResults, validation }) + `\n\n` +
  SAFETY + `\n\n` +
  `CONTRACT: one line confirming the file was written and committed.`,
  { label: 'manifest', phase: 'Digest', model: M.cheap })

const digest = await agent(
  `GOAL: You are the top brain. Write the operator digest (the final answer).\n` +
  `Layers: ${JSON.stringify(layerResults.map(l => ({ layer: l.layer, green: l.green, units: l.units.map(u => ({ unit: u.unit, status: u.status, parked: u.parked || undefined })) })))}\n` +
  `Validation: ${JSON.stringify(validation)}\n` +
  `CONTRACT: return DIGEST json. done vs blocked unit counts; remainingRisk MUST include everything parked as\n` +
  `native-unverifiable (iOS/Android hosts, PrimJS TextDecoder, on-device fonts/perf) plus anything\n` +
  `proven-but-not-exercised; ONE recommendation. Branch ${BRANCH} in ${WORKTREE} is ready for the OPERATOR\n` +
  `to review, push (explicit upstream, never a bare first push), and open the PR. Terse.`,
  { label: 'digest', phase: 'Digest', model: M.brain, schema: DIGEST })

return { digest, validation, layers: layerResults, spike, rehearsal }
