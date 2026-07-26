---
description: Check UI work against the DOOEY design system (ownership, tokens, motion)
---

Check the current work against DOOEY's design system. Scope is `frontend/`; root `src/` is frozen
legacy and exempt.

1. Read `docs/design-system.md` for the rules.
2. Run the checker over the changed files:

```bash
bash .claude/skills/design-system/scripts/design-check.sh --diff
```

Without `--diff` it scans all of `frontend/src`. It checks ownership violations and computes the
damping ratio of every spring.

3. **Read every hit before reporting it.** It is a grep: it matches inside strings and comments, and
some hits are documented exceptions (`anatomy.ts` figure colours, radii under 16, the `99` pill
idiom). A hit you have not opened is not a finding.

4. Cross-check `docs/design-audit.md` and split your report:
   - **New drift in this change** (fix now)
   - **Pre-existing, already tracked** (leave it, reference the audit)

5. Report what grep cannot see. The first one matters most:
   - **Open the Style page and change the palette, the radius, and the shadow slider.** Anything
     that does not move is holding a value that belongs to the user.
   - Light and dark both rendered.
   - Reduced motion on, nothing invisible or stuck.
   - For any animation added: what would the user lose if it were instant? If nothing, remove it.

6. Run `cd frontend && npm run typecheck && npm run lint`.

Report each finding as `file:line` with what replaces the value. If it is clean, say so plainly
rather than manufacturing findings.

$ARGUMENTS
