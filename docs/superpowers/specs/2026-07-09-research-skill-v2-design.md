# Research Skill v2 — Design

Date: 2026-07-09
Status: Approved (pending write)

## Problem

`truss:research`'s trigger is a soft instruction ("use when brainstorming or
planning..."). Nothing observes whether it actually fires. Under task
pressure it can silently not — the same failure class flagged for
`truss:big-brain` in `proposal.md`.

A hook-based trigger (`PreToolUse` matching a `Skill` call) was considered
and rejected: it can only match truss's own known tool names. It would not
fire for a differently-named planning/brainstorming skill from another
plugin. An instruction-based trigger, using Claude's own semantic
pattern-matching, generalizes across plugins where a hook cannot.

The existing research loop is also one-shot (compile list, fan out once,
record) with no way to decide "is this even needed" up front, and no way to
continue if the first round surfaces new unknowns.

## Design

### 1. Trigger — instruction-based, red-flag framing

Reuse `superpowers:using-superpowers`'s red-flag-table device: naming the
specific rationalizations that cause a soft instruction to get silently
skipped, paired with the correction, e.g.:

| Thought | Reality |
|---|---|
| "I'm already confident about this" | Confidence is exactly what fails — that's the rule, not an exception to it. |
| "This is a small/simple task" | Small tasks still touch libraries/APIs that can be wrong. |
| "I'll research if I hit a problem" | By then it's already in the plan. Research before, not after. |

Fires on "1% chance a brainstorm/plan session has started" — same threshold
`using-superpowers` uses for itself. Deliberately not hook-enforced (see
Problem section) — the point is plugin-agnostic reach, not hardness.

### 2. Decide-to-research step

First act inside the trigger: decide whether this task needs research at
all. Not every brainstorm touches an external library or a novel technique.

Owner of the decision is configurable:

```toml
[research]
decide = "user"   # "user" | "claude"
```

Default `"user"` — an `AskUserQuestion` at brainstorm start ("does this need
research?"). Setting `decide = "claude"` skips the ask; Claude judges alone,
still bound by the same red-flag table from Step 1.

### 3. List + fan-out (unchanged)

Existing mechanism carries over as-is: compile the list of external
libraries/APIs/algorithms touched, confirm with the user, fan out one
subagent per item when the list has 2+ entries (single item stays inline —
nothing to gain from fanning out one lookup).

### 4. Iterative loop with capped rounds

After a round of research returns, decide whether findings surfaced a new
unknown worth a follow-up round, against the original compiled list — not
open-ended "does this feel done."

Rounds are capped:

```toml
[research]
max_rounds = 3
```

Reaching the cap does **not** silently stop. It prompts the user:
"Research cap reached — continue researching?" Yes resets the round counter
to 0 and continues. No proceeds with whatever has been gathered so far.
This mirrors the decision-routing philosophy already in `proposal.md`
(component 4): route the call to the user rather than deciding silently,
at exactly the point where continuing costs something (more rounds, more
tokens).

### 5. Recording (unchanged)

`RESEARCH.md`'s `# Verified` / `# Avoid` format and entry structure are
unchanged.

## Config additions

`hooks/lib/config.js` `DEFAULTS` gains a `[research]` section, same style as
existing `[gates]` / `[context]`:

```toml
[research]
decide     = "user"   # who decides if research is needed: "user" | "claude"
max_rounds = 3         # iterative research rounds before prompting user to continue
```

Applied to `truss.toml` and `templates/truss.toml` (shipped default), same
pattern as the recent `[log] decisions` and `[gates] plain_speak` additions.

## Non-goals

- No hook-based trigger — ruled out, see Problem section.
- No change to the fan-out mechanism, subagent prompt shape, or
  `RESEARCH.md` entry format — all unchanged from the current skill.
- `plain-speak`/`caveman` coordination is out of scope for this spec —
  tracked separately (`plain-speak` gate disabled in the meantime via
  `[gates] plain_speak = false`).
