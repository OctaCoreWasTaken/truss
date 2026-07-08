# Truss — Plain-Speak Teaching Mode Design

**Date:** 2026-07-08
**Scope:** v0 — extends the existing `plain-speak` skill from a brainstorm/plan-scoped style into a session-wide, hook-forced teaching mode, backed by a persistent glossary.

---

## Overview

Motivation: the user is the target audience for real codebase comprehension, not a passive approver. Working with Claude as a coworker on debugging and modification requires a mental model of the actual codebase — how pieces connect, why they're shaped that way — not a one-line purpose summary (too shallow to predict the effect of a change) and not a literal line-by-line reading (the reading-time cost agentic coding exists to avoid). The target is the level in between: mechanism, flow, and reasoning, conveyed in plain language.

This supersedes `proposal.md`'s Comprehension Pile + Decision Routing verdict (SKIPPED, 2026-07-08). That verdict assumed most Claude Code users don't read code, so routing a design decision to the developer over code they won't inspect is friction without comprehension. The user has clarified they explicitly want deeper codebase literacy — the assumption doesn't hold for this audience. The Comprehension Pile's specific mechanism (a staleness counter gating routed either/or decisions) is not revived; this spec is a different mechanism entirely, built on the already-shipped `plain-speak` skill rather than on decision-routing.

The `2026-07-07-plain-speak-design.md` spec's original framing — jargon-free, short, judgment-based, brainstorm/plan-scoped — remains correct as far as it goes. This spec widens it in two ways: scope (whole session, not just brainstorm/plan) and depth (medium-level mechanism/flow, not just word-choice accessibility), and hardens its trigger from judgment-based to hook-forced.

---

## Why judgment-based firing isn't enough

Live evidence from this session: `plain-speak` (pre-this-spec) never fired once during a full brainstorming conversation about its own redesign, despite the conversation being exactly the kind of technical, jargon-heavy territory it's meant to cover. This is the same under-firing failure mode already documented for `research` and `big-brain` before they were hardened to unconditional wording (see `2026-07-07-truss-planning-layer-design.md`). Widening `plain-speak`'s wording alone would not fix this — wording hardening worked for `research`/`big-brain` because they're discrete actions invoked at specific moments; `plain-speak` is a persistent style that needs to be active from the first message, which wording alone can't guarantee. The fix is the same class of mechanism `ponytail` and `caveman` already use: force-inject the rules via a `SessionStart` hook so the skill's behavior doesn't depend on Claude choosing to invoke it.

---

## Delivery

Two changes, no new skill:

1. `skills/plain-speak/SKILL.md` — rewritten in place (same file, same `truss:plain-speak` name). Role widens from "translate jargon during brainstorm/plan" to "ongoing bridge between the user and this codebase," scope widens from brainstorm/plan to the whole session, and a depth rule + term-introduction rule are added.
2. `hooks/session-start/teach.js` — new handler, alongside (not replacing) `hooks/session-start/init.js`. Reads `skills/plain-speak/SKILL.md`, strips the YAML frontmatter, returns the body as `additionalContext`. `dispatch.js` already merges every `session-start/` handler's `additionalContext` with `\n\n`, so this requires no change to `init.js` or `dispatch.js`.

Reading the skill file at runtime (rather than duplicating its instructions as a hardcoded string in the hook) keeps one source of truth: editing the skill's content automatically changes what gets injected.

## On-demand Q&A

No separate command or skill. The user directly asking a question about the codebase is handled by the same extended `plain-speak` skill, at the same depth and style, using `Read`/`Grep` as normal. Considered and rejected: a split design with a separate `truss:explain` skill able to delegate to `truss:big-brain` for hard questions — rejected because nothing described requires different mechanics between ambient and on-demand explanation; `big-brain` already composes naturally for genuinely hard architecture questions without new plumbing.

## Trigger

Force-loaded every session via the `SessionStart` hook — no longer relies on Claude's judgment to invoke it. This is the deliberate difference from `research`/`big-brain`'s unconditional-wording fix: those remain judgment-based-but-hard-to-ignore; `plain-speak` becomes structurally guaranteed active.

## Depth rule (skill content)

Explaining a piece of the codebase means conveying its mechanism, control/data flow, and the reasoning behind its shape — not a one-line purpose summary, and not a literal statement-by-statement walkthrough. Plain language and depth are independent axes: a mechanism can be explained accurately without jargon. Example anchor (from this session's clarifying question, using `hooks/dispatch.js`):

- Too shallow (rejected): "dispatch.js routes hook events to handler files."
- Target depth: "dispatch.js turns an event name into a directory, runs every handler file in it in order, and feeds each the same input. A handler can block (stops the chain, its message wins) or add context (collected from every handler that ran). A broken handler's error is swallowed so it can't take down the rest. This means adding a new gate is just dropping a file in a directory — dispatch.js itself never changes."
- Too literal (rejected): line-by-line narration of `eventToDir`'s regex replacer logic.

## Term tracking: `GLOSSARY.md`

Lazily created — same pattern as `RESEARCH.md` (no template in `templates/`; the skill creates the file itself the first time it has something to write), not scaffolded by `init.js`. Format mirrors `RESEARCH.md`'s existing convention:

```markdown
## <term>
Plain-language explanation. First introduced YYYY-MM-DD.
```

Before introducing a term, the skill checks `GLOSSARY.md` if it exists and skips terms already logged. Each response introduces a small, bounded number of new terms — not a vocabulary dump. This is what lets understanding compound across sessions instead of re-explaining the same term indefinitely or silently assuming knowledge the user doesn't have yet.

## Cost control

The hook injection is a one-time per-session cost (the skill's text body), the same order of magnitude as `ponytail`/`caveman`'s own per-session overhead — not a per-turn or per-response cost. No new LLM calls are introduced: this is a style/depth overlay on explanations Claude gives anyway, the same zero-extra-call shape as the original `plain-speak` design. Response length growth is bounded by the depth rule itself (mechanism/flow/why, not literal code) and the term cap (small number per response, not unbounded).

## Scope

Governs conversational explanation and `GLOSSARY.md` maintenance only. Does not apply to `RESEARCH.md` (stays precise/technical, per the original `plain-speak` spec) or to code/commits/PRs.

---

## Testing

- `tests/skills/skills.test.js` — existing `plain-speak skill has valid frontmatter` test continues to pass unchanged; frontmatter shape is unaffected by the body rewrite.
- `tests/session-start/teach.test.js` — new, mirrors `tests/session-start/init.test.js`'s tmpdir/pluginRoot isolation pattern. Asserts `additionalContext` contains the skill body with frontmatter stripped, given a fixture `skills/plain-speak/SKILL.md`.
- Actual explanation quality/depth (does a response land at the target "medium" level) can't be asserted by `node:test`, same known limitation as `research`/`big-brain`/`plain-speak`'s original spec. Manual verification: open a fresh session, confirm the teaching framing is present without asking, ask a codebase question, confirm `GLOSSARY.md` gets created and updated correctly, confirm a term already in `GLOSSARY.md` isn't re-explained.

---

## Explicitly Deferred / Out of Scope

- **Whole-codebase flowchart/diagram generation** — the concrete mechanism the user first floated. Not pursued: a whole-codebase diagram is a maintenance-debt artifact (goes stale as code changes, same problem that killed `BRIEF.md`) and the Artifact tool's strict CSP rules out CDN-based diagram libraries (e.g. Mermaid), leaving only inline SVG or a vendored JS bundle — meaningfully more implementation surface than this spec's text-based mechanism for unproven added value. Revisit only if plain-text explanation proves insufficient in practice.
- **Split ambient/on-demand skills** — considered, rejected in favor of the unified approach (see "On-demand Q&A" above).
- **Config toggle to disable teaching mode** — not built. `research`/`big-brain`/`plain-speak` have no disable toggle today either; if this proves too noisy in practice, add one then rather than speculatively now.
