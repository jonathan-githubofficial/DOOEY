#!/usr/bin/env bash
# Check frontend/ for values that belong to the user and motion that does no job.
#
#   bash .claude/skills/design-system/scripts/design-check.sh          # all of frontend/src
#   bash .claude/skills/design-system/scripts/design-check.sh --diff   # changed + untracked only
#
# Exits 1 if anything is found. Deliberately a grep plus one small calculation:
# no dependencies, fast, and its false positives are obvious on sight. Read
# every hit before acting on it.

set -uo pipefail
cd "$(dirname "$0")/../../../.." || exit 1

if ! command -v rg >/dev/null; then
  echo "ripgrep (rg) is required." >&2
  exit 2
fi

if [[ ${1:-} == "--diff" ]]; then
  # Git pathspec globs cross "/" already, so a single star is the recursive form.
  # Untracked files matter most: a brand new component is exactly what is worth
  # checking, and `git diff` never lists one.
  mapfile -t FILES < <(
    {
      git diff --name-only --diff-filter=d HEAD -- 'frontend/src/*.ts' 'frontend/src/*.tsx'
      git ls-files --others --exclude-standard -- 'frontend/src/*.ts' 'frontend/src/*.tsx'
    } 2>/dev/null | sort -u
  )
  [[ ${#FILES[@]} -eq 0 ]] && { echo "No changed source files under frontend/src."; exit 0; }
  echo "Checking ${#FILES[@]} changed file(s)."
else
  mapfile -t FILES < <(find frontend/src -type f \( -name '*.ts' -o -name '*.tsx' \))
  echo "Checking ${#FILES[@]} file(s) in frontend/src."
fi

# The files that define the tokens everyone else imports. They are allowed to
# hold raw values; nobody else is.
OWNERS='frontend/src/(lib/(motion|theme)\.ts|stores/theme\.ts|features/style/tokens\.ts)'

FOUND=0

# check <label> <pattern> <fix>
# One rg pass over every file at once: per-file invocation costs more in process
# spawn than the search does, badly so on Windows.
check() {
  local label=$1 pattern=$2 fix=$3 hits
  hits=$(rg -n --no-heading --with-filename --color=never -- "$pattern" "${FILES[@]}" 2>/dev/null \
    | sed 's|\\|/|g' | rg -v -- "$OWNERS" 2>/dev/null)
  if [[ -n $hits ]]; then
    FOUND=1
    printf '\n\033[1;33m%s\033[0m  (%s)\n  fix: %s\n' "$label" "$(wc -l <<<"$hits" | tr -d ' ')" "$fix"
    sed 's/^/  /' <<<"$hits"
  fi
}

echo
echo "--- Ownership: values that belong to the user, not to you ---"

check "Hardcoded shadow" \
  'shadowColor:\s*"' \
  'useElevation("rest"|"lifted") from "@/stores/theme" (tints from their ink, scales with their slider)'

check "Hardcoded colour" \
  '"#[0-9a-fA-F]{3,8}"' \
  'usePalette(); relight() for "brighter than the surface". anatomy.ts figure colours are exempt.'

check "Raw rgba()" \
  'rgba?\([0-9]' \
  'alpha(colors.x, 0.35) so it follows the palette and inverts in dark mode'

# 16 and up is card territory. Below that is a chip, an input or a small tile,
# which is allowed a fixed radius; 99 is the pill idiom.
check "Card radius the slider cannot move" \
  'borderRadius:\s*(1[6-9]|[2-8][0-9])\b' \
  'useCardRadius() for anything card-shaped. Radii under 16 and the 99 pill idiom are fine.'

echo
echo "--- Motion: every animation does a job, and nothing wobbles ---"

# The damping-ratio rule, computed rather than pattern-matched. Below 0.8 a
# spring visibly overshoots, and DOOEY does not overshoot.
BOUNCE=$(rg -n --no-heading --with-filename --color=never -o \
  'stiffness:\s*[0-9]+,\s*damping:\s*[0-9]+(,\s*mass:\s*[0-9.]+)?' "${FILES[@]}" 2>/dev/null \
  | sed 's|\\|/|g' | rg -v -- "$OWNERS" 2>/dev/null | awk -F: '
  {
    line = $0
    match(line, /stiffness:[ ]*[0-9]+/);  s = substr(line, RSTART, RLENGTH); sub(/[^0-9]+/, "", s)
    match(line, /damping:[ ]*[0-9]+/);    d = substr(line, RSTART, RLENGTH); sub(/[^0-9]+/, "", d)
    m = 1
    if (match(line, /mass:[ ]*[0-9.]+/)) { t = substr(line, RSTART, RLENGTH); sub(/[^0-9.]+/, "", t); m = t + 0 }
    ratio = d / (2 * sqrt(s * m))
    if (ratio < 0.8) printf "  %s  ratio %.2f  (%s/%s%s)\n", $1 ":" $2, ratio, s, d, (m != 1 ? " mass " m : "")
  }')

if [[ -n $BOUNCE ]]; then
  FOUND=1
  printf '\n\033[1;33mSpring that visibly bounces\033[0m  (%s)\n' "$(wc -l <<<"$BOUNCE" | tr -d ' ')"
  echo "  rule: damping / (2 * sqrt(stiffness * mass)) must be >= 0.8"
  echo "  fix: use gesture.press|release|snap|track from \"@/lib/motion\", or timing() if no finger drives it"
  echo "$BOUNCE"
fi

# Reanimated's entrance and layout builders spell the same spring a different
# way, and the object-literal rule above cannot see it. A
# `SlideInDown.springify().stiffness(300).damping(30)` is a spring on something
# no finger is touching, which is the rule this whole section exists to state.
SPRINGIFY=$(rg -n --no-heading --with-filename --color=never -o \
  '\.springify\(\)(\.stiffness\([0-9.]+\))?(\.damping\([0-9.]+\))?' "${FILES[@]}" 2>/dev/null \
  | sed 's|\\|/|g' | rg -v -- "$OWNERS" 2>/dev/null | awk -F: '
  {
    line = $0; s = 0; d = 0
    if (match(line, /stiffness\([0-9.]+\)/)) { t = substr(line, RSTART, RLENGTH); gsub(/[^0-9.]/, "", t); s = t + 0 }
    if (match(line, /damping\([0-9.]+\)/))   { t = substr(line, RSTART, RLENGTH); gsub(/[^0-9.]/, "", t); d = t + 0 }
    if (s > 0 && d > 0) {
      ratio = d / (2 * sqrt(s))
      printf "  %s  ratio %.2f%s\n", $1 ":" $2, ratio, (ratio < 0.8 ? "   <- bounces" : "")
    } else {
      printf "  %s  (default spring)\n", $1 ":" $2
    }
  }')

if [[ -n $SPRINGIFY ]]; then
  FOUND=1
  printf '\n\033[1;33mSpring on an entrance, exit or layout transition\033[0m  (%s)\n' "$(wc -l <<<"$SPRINGIFY" | tr -d ' ')"
  echo "  rule: a spring follows a finger. An entrance, an exit and a layout settle do not."
  echo "  fix: .duration(dur.quick|moved).easing(ease.out), or LinearTransition.duration(dur.quick).easing(ease.out)"
  echo "$SPRINGIFY"
fi

check "Inline spring config" \
  'withSpring\([^)]*\{' \
  'gesture.press|release|snap|track from "@/lib/motion". No gesture? Then timing().'

check "Inline timing config" \
  'withTiming\([^)]*\{[^}]*duration' \
  'timing(dur.instant|quick|moved, ease.out|in|inOut). Ambient loops use ambient.breath.'

check "Hand-rolled press state" \
  'onPressIn=\{.*scale|Animated\.createAnimatedComponent\(Pressable\)' \
  'use <PressableScale> from "@/components/pressable-scale"'

check "Local reduced-motion branch" \
  'useReducedMotion' \
  'configs in motion.ts already carry ReduceMotion.System; mount <ReducedMotionConfig> at the root instead'

echo
if [[ $FOUND -eq 1 ]]; then
  echo "Drift found. Confirm each hit by reading the line before changing it:"
  echo "grep matches inside strings and comments, and some hits are documented exceptions."
  echo "Tokens: docs/design-system.md   Known drift: docs/design-audit.md"
  exit 1
fi

echo "Clean: no design drift detected."
