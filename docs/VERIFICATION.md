# Truss — Manual Verification Checklist

Re-run after any change to a hook, skill, or agent listed below. Unit tests (`npm test`) cover
logic in isolation; this checklist covers the parts specs explicitly flagged as behavioral —
only observable in a real session, not via `node:test`.

## 1. model-gate

**What it is:** blocks an `Agent` dispatch that omits `model`, so a task can't silently inherit
the session's (usually most expensive) model tier.

**Check:** dispatch an `Agent` tool call without a `model` param in a live session.
**Expect:** blocked, with a truss error naming the missing `model` field.
**Status:** confirmed working (2026-07-11, live — a research fan-out attempt without `model` was
blocked exactly this way).

## 2. auto-compact

**What it is:** blocks prompt submission once estimated context usage crosses a configured
threshold, so `/compact` happens before quality degrades, not at Claude Code's native ~95%.

**Check:** temporarily set `[context] threshold = 0.01` in `truss.toml`, send one prompt.
**Expect:** prompt blocked, message references running `/compact`.
**Cleanup:** revert `truss.toml` to its real threshold afterward.
**Status:** not yet re-verified live this session.

## 3. events-log

**What it is:** appends one JSON line per tool call to `EVENTS.log` — an audit trail.

**Check:** run any tool call, tail `EVENTS.log`.
**Expect:** a new line with `ts` and `event` fields.
**Status:** not yet re-verified live this session.

## 4. session-start/init

**What it is:** recreates `truss.toml`/`CONVENTIONS.md` from template if missing; warns (and logs
to `EVENTS.log`) if `truss.toml` is malformed.

**Check A:** in a scratch copy, delete `truss.toml`, run `node hooks/dispatch.js SessionStart`.
**Expect A:** `truss.toml`/`CONVENTIONS.md` recreated from template.
**Check B:** write a malformed `truss.toml`, re-run.
**Expect B:** `additionalContext` warning returned, and a `ConfigWarning` line appended to
`EVENTS.log`.
**Status:** covered by `node:test` (`tests/session-start/init.test.js`) — live re-check optional.

## 5. plain-speak (SessionStart + UserPromptSubmit)

**What it is:** injects one fixed rule every session and every turn — speak plainly, no jargon,
and always define a specific codebase piece (file/function/class) the moment it comes up in
discussion.

**Check:** ask about a specific file/function mid-conversation, unprompted (don't ask for a
definition directly — see if it's offered).
**Expect:** the response is jargon-free and proactively defines the piece, not only when
explicitly asked.
**Status:** hook mechanism confirmed live (`node hooks/dispatch.js SessionStart` returns the rule
text). **Compliance already confirmed broken once** (2026-07-11 — a response named five codebase
pieces with zero definitions). The hook fires; nothing forces the model to actually follow it.
Re-check periodically, not just once — this is a known soft spot, not a fixed one.

## 6. truss:research (full ritual)

**What it is:** researches external libs/APIs/algorithms before finalizing a brainstorm/plan,
records findings in `RESEARCH.md`, and now asks the user after every round rather than deciding
silently.

**Check:** start a new brainstorming session on any topic (even one that looks self-contained).
**Expect:** the "does this need research?" ask fires as the very next act after context
exploration — every session, not just some.
**Check B:** trigger a 2+-item research fan-out.
**Expect B:** `truss-researcher` dispatched (not `general-purpose`), `RESEARCH.md` entries
appended not overwritten, and — after round 1 — a direct "satisfied, or continue?" ask, not a
silent decision deferred to `max_rounds`.
**Status:** the sequencing fix and per-round ask shipped 2026-07-11 (commit `74b0f09`) after
confirming the ask was skipped in at least one real session. Not yet re-verified live under the
new wording — same compliance-only caveat as plain-speak: this is stronger instruction text, not
a hard gate, since no Claude Code hook fires on skill invocation.

## 7. truss:reset

**What it is:** resets `truss.toml`/`CONVENTIONS.md` to template defaults, deletes
`RESEARCH.md`/`DECISIONS.log` (lazily recreated later), leaves `EVENTS.log` untouched.

**Check:** run in a disposable scratch project directory — **never the real repo**.
**Expect:** `truss.toml`/`CONVENTIONS.md` reset to template, `RESEARCH.md`/`DECISIONS.log`
deleted, `EVENTS.log` untouched.
**Status:** covered by `node:test` (`tests/scripts/reset.test.js`) — live re-check optional.

## 8. truss-researcher tool restriction

**What it is:** a scoped subagent for research fan-out, restricted to `WebSearch`/`WebFetch`
only — no `Bash`/`Read`/`Edit`/`Agent` tool schemas loaded, keeping fixed per-dispatch overhead
down versus `general-purpose`.

**Check:** dispatch one, instruct it in the prompt to try `Bash` or `Read`.
**Expect:** it cannot — the tool isn't in its schema — and it reports that back rather than
silently failing or hallucinating a result.
**Status:** not yet re-verified live this session.

## 9. DECISIONS.log subagent-report schema

**What it is:** the fixed report schema (`status`/`commit`/`files_changed`/`tests`/
`decisions`/`blockers`) any subagent completion report must open with; the `decisions` field
also gets appended, one line per entry, to `DECISIONS.log`.

**Check:** run one real subagent-driven-development task that deviates from its brief.
**Expect:** the report's `decisions` field is populated, and a matching line is appended to
`DECISIONS.log`.
**Status:** not yet re-verified live this session (previously exercised via `truss:big-brain`,
which has since been removed — this now needs a fresh check against a plain subagent report,
not a big-brain delegation).

## 10. research decide-gate sequencing (regression check for the 2026-07-11 fix)

**What it is:** the fix in commit `74b0f09` — the "does this need research?" ask must fire as
the immediate next act after `brainstorming`'s own Step 1, every session; round continuation
must ask the user after every round, not just at `max_rounds`.

**Check:** start a brainstorming session on an unrelated small topic.
**Expect:** the decide-gate ask fires without being judged away first.
**Check B:** trigger a 2+-item research fan-out on a separate topic.
**Expect B:** after round 1, a direct "satisfied or continue?" ask — not silence until the cap.
**Status:** fix just shipped, not yet observed working live. This is the most important item to
re-check next, since the whole point of this fix was proven-broken compliance.
