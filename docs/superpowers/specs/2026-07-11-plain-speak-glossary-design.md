# Truss — Plain-Speak + Codebase Glossary Design

**Date:** 2026-07-11
**Scope:** v0 — a hook-enforced, always-on rule that (a) requires all of Claude's output to be jargon-free plain language, and (b) obligates a short plain-language definition whenever a specific codebase piece (file/function/class) comes up in discussion. Revives and narrows the previously-shipped-then-removed `truss:plain-speak` skill, replacing its skill-only mechanism with the hook-based persistence pattern truss already reverse-engineered from Ponytail/Caveman.

---

## Overview

Motivation: two related but separable brainstorming threads converged here. First, "how should Claude Code act as the connection between user and codebase" — narrowed, after rejecting a persistent per-symbol doc tree (see `RESEARCH.md`'s Repowise/tree-sitter/SCIP entries and the `truss-thinker` big-brain verdict logged 2026-07-11 in `DECISIONS.log`), to: explain codebase pieces inline, live, from current code, with no storage and no dependency. Second, the user separately asked for jargon-free plain language to apply to *all* Claude output, not only codebase discussion.

Both landed on the same mechanism: a small, fixed, always-on instruction re-injected every turn — the exact pattern already documented in `proposal.md`'s Findings & Provenance section for Ponytail ("a ~1KB always-on ruleset re-injected each turn by two lifecycle hooks") and already used by the Caveman plugin installed alongside truss. The original `truss:plain-speak` was a skill (judgment-based, invoked situationally) and was removed earlier today (see git history, commit `b288efe`) specifically because skill-only compliance is soft — Claude can silently drop it under task pressure. This design corrects that: same intent, hook-persisted mechanism instead.

## Mechanism

Two new hook handler files, following the existing `dispatch.js` convention (event → directory → sorted `.js` files, each returning `null` or `{additionalContext}`):

- `hooks/session-start/plain-speak.js`
- `hooks/user-prompt-submit/plain-speak.js`

Both are trivial and near-identical: if `config.gates.plain_speak` is true, return `{ additionalContext: RULE_TEXT }`; otherwise `null`. `SessionStart` covers the start of a session/after `/clear`/`/compact`; `UserPromptSubmit` re-asserts every single turn so the rule can't silently drift out of a long conversation the way a once-per-session injection could. Both already fire today for other truss hooks (`init.js` on `SessionStart`, `auto-compact.js` on `UserPromptSubmit`) — no new entries needed in `hooks/hooks.json`, `dispatch.js` already discovers every `.js` file in the event's directory.

`RULE_TEXT` (single shared constant, both files require it from a small shared module to avoid duplicating the string):

```
[truss] Always speak in plain, jargon-free language — in every response, not only when discussing code. When a specific codebase piece (a file, function, or class) comes up in discussion, always give a short plain-language definition of what it is and does, generated fresh from the current code — this is obligatory, not situational.
```

This is intentionally an **instruction, not a gate** — same class of "obligatory" as Caveman's own persistence model (repeated injection, no blocking tool call). A hook cannot semantically detect "Claude is currently discussing a codebase piece," so there's nothing to gate on; the injected rule carries the obligation, compliance is the model's job. This is the same limitation already noted in the `auto-compact` design doc regarding `plain-speak`'s prior soft-compliance failure — re-injection every turn is the mitigation available within that constraint, not a fix that removes it entirely.

No storage, no dependency, no persistent doc tree. A codebase-piece explanation is generated fresh from the code as currently read, every time it's given — it cannot drift because nothing is cached to drift.

## Config

`truss.toml` gains:

```toml
[gates]
plain_speak = true   # always-on jargon-free output + obligatory codebase-piece definitions
```

Same shape and location as the existing `auto_compact`/`model_routing` booleans. `hooks/lib/config.js`'s `DEFAULTS.gates` gains `plain_speak: true`; `templates/truss.toml` and this repo's own `truss.toml` both get the new line under `[gates]`.

## Non-goals (explicit, to prevent scope creep back into rejected designs)

- No persistent doc tree, no `TAUGHT.md`-style memory of what's been explained (rejected: see `DECISIONS.log` 2026-07-11 big-brain entries).
- No third-party dependency (Repowise or otherwise) — rejected specifically because the user doesn't want to rely on one.
- No comprehension tracking, scoring, or check-in gates (rejected: Component 4 precedent, reconfirmed by the first big-brain delegation this session).
- No hard block/gate on the codebase-glossary half — deliberately soft (instruction-persistence), because there is no deterministic trigger to gate on.

## Testing

- `hooks/session-start/plain-speak.js` and `hooks/user-prompt-submit/plain-speak.js`: `node:test` cases for — `plain_speak = true` (default) → returns `additionalContext` with the rule text; `plain_speak = false` → returns `null`.
- `hooks/lib/config.js`: extend existing config tests for the new `gates.plain_speak` default and override, same pattern as `auto_compact`/`model_routing`.
- The actual output-quality effect (does Claude's language get simpler, does it actually define codebase pieces) is behavioral, not testable via `node:test` — same category of manual/observational verification already accepted for `auto-compact`'s real-world estimation accuracy.

---

## Explicitly Deferred / Out of Scope

- **Detecting non-compliance** — no mechanism verifies Claude actually followed the injected rule on a given turn; this is the same accepted soft-compliance ceiling noted above, not a gap unique to this feature.
- **Per-project rule customization** (e.g. a project-specific glossary style) — not requested; `RULE_TEXT` is a fixed constant for v0, matching the "no config UI, plain files only" principle without over-building a customization surface nobody asked for.
