# Truss State — 2026-07-08

## What Truss Is

Truss is a Claude Code plugin that enables development-on-itself: a set of enforced hooks and skills that make Claude a dependable coworker, not just a tool. Three core shipped skills (`research`, `big-brain`, `plain-speak`) manage knowledge, reasoning, and teaching; hooks wire mandatory gates (`read_before_write`, `spec_gate`, etc.) and capabilities (teaching mode, auto-compact) into Claude's prompt lifecycle. Truss ships as a Node.js plugin; users can customize any skill's instructions by creating `truss-skills/<name>.md` files that replace the shipped text durably across plugin reinstalls.

## Session Accomplishments (2026-07-07 to 2026-07-08)

### Completed: Plain-Speak Teaching Mode + Skill Customization (Two SDD Cycles)

**Feature 1: Teaching Mode** (`plain-speak` force-loaded every session, not just brainstorm/plan)
- Reframed `plain-speak` as "expert coworker / teacher" (not translator of jargon) so Claude explains codebase mechanism, flow, and reasoning in plain language — enabling the user to maintain a mental model and work alongside Claude on modifications and debugging.
- Implemented via `hooks/session-start/teach.js`: reads the shipped `skills/plain-speak/SKILL.md`, strips frontmatter, injects body as `additionalContext` on every `SessionStart` event (hook-forced, deterministic — not soft-compliance).
- Tracks taught vocabulary in `GLOSSARY.md` (created per-session, user maintains it across sessions) to prevent re-teaching and let vocabulary compound.

**Feature 2: Skill Customization** (all three skills overridable via `truss-skills/` directory)
- Users can create `truss-skills/plain-speak.md`, `truss-skills/research.md`, `truss-skills/big-brain.md` to fully replace shipped skill text — durable across plugin reinstalls, unlike editing plugin files directly.
- `plain-speak` override is hook-checked (deterministic: `teach.js` reads the override file if it exists, else the shipped SKILL.md).
- `research` and `big-brain` overrides are instruction-based (judgment-invoked: the skill instructions mention "before following these rules, check `truss-skills/research.md` if it exists").
- Established as intentional design: override = replace (full control, user accepts silent divergence from future shipped updates), not augment (no mechanical sync between override and SKILL.md — accepted as a maintenance seam).

### Completed: Auto-Compact Trigger Hook (One SDD Cycle)

**Feature 3: UserPromptSubmit hook that hard-blocks once context usage crosses a configurable threshold**
- Blocks prompt submission (deterministic, not instruction-based) when estimated real context usage ≥ `context_max * threshold` from `truss.toml`.
- Uses the transcript's real API-reported `message.usage` fields (sum of `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` from the most recent assistant turn), not char/4 text approximation — includes system-prompt/skill/MCP-schema overhead automatically.
- Block reason reaches the **user** (shown on prompt rejection), not Claude's context — per the hook contract, `reason` is user-facing only.
- Prerequisite fix to `hooks/dispatch.js`: the old block path wrote JSON to stdout then exited code 2, which Claude Code's hook harness discards (exit 2 reads stderr only). Fixed to always exit 0 with JSON on stdout — the complete, correct signal per the hook contract, fixes the path for every future blocking gate.
- Config: `truss.toml` gains `[gates] auto_compact = true` (boolean toggle) and `[context] context_max = 200000, threshold = 0.6` (shipped defaults; this project's own `truss.toml` has `context_max = 1000000` to match its actual 1M-token session).
- Manual verification deferred (per plan): temporarily set `threshold = 0.01`, confirm real block renders, revert — verifies the live block path against a real Claude Code session.

## Current State

**Branch:** `master`  
**Last commit:** `7b66339` (ponytail comment on whole-file transcript read)  
**Test suite:** 53/53 passing  
**Ready to:** Push to remote and reinstall for fresh-session verification.

## Next: Push + Reinstall (Prerequisite for Verification)

Push all three features to the remote, then `claude plugin uninstall truss@truss-dev && claude plugin marketplace update truss-dev && claude plugin install truss@truss-dev`.

**Why now:** The new auto-compact hook and plain-speak teaching mode both depend on hook determinism and fresh-session registration. Testing in the *same* session the features were built doesn't verify they actually fire — hooks only register at true session start, and reinstalling mid-session doesn't retroactively trigger them. A genuinely new session is the only real verification.

**What gets verified in next session:**
- Plain-speak teaching mode fires at session start (message should appear in additionalContext).
- Auto-compact hook fires on prompt submission (test by temporarily setting `threshold = 0.01`; prompt should be rejected with the block reason visible).
- Both hooks work with the fixed dispatch.js block path.

## After Verification: Dogfood Truss on Itself

Use truss features when developing truss going forward:
- `/brainstorming` before any design work (required gate per CLAUDE.md).
- `truss:research` + `truss:big-brain` during brainstorming/planning (research documented in `RESEARCH.md`, hard decisions delegated to a `thinking` subagent).
- `superpowers:subagent-driven-development` for implementation (fresh subagent per task, review between tasks, whole-branch review at the end — proven pattern this session).
- `plain-speak` ambient throughout (already force-loaded; teach new terms, track in `GLOSSARY.md`).
- Maintain `STATE.md` on major changes so context doesn't evaporate mid-session (lesson learned: claude-mem was installed mid-session this time but captured nothing — `claude-mem`'s hooks likely have the same SessionStart-only limitation as truss's, so manual STATE.md is the fallback until that's clarified).

## Key Insights for Continuing Work

1. **Hooks fire once at SessionStart, reload doesn't retroactively trigger them.** This is a Claude Code platform constraint, not a bug. After any hook change, flag proactively that a fresh session is needed for verification (don't wait for the user to notice).

2. **Two complementary memory systems:** `claude-mem` auto-captures and injects relevant context automatically (session 2 onward, entirely opaque); `STATE.md` is deliberate, inspectable, user-maintained. Both apply — use `STATE.md` for load-bearing decisions and design context, let `claude-mem` handle the mechanical transcript context.

3. **Instruction-based (soft) vs. hook-forced (hard) compliance:** Soft gates (`truss:research`, `truss:big-brain`, skill overrides) work via guidance — Claude reads instructions and follows them, but can deprioritize under task pressure. Hard gates (plain-speak's deterministic hook injection, auto-compact's block) work via mechanism — Claude can't bypass them. Use soft for judgment calls (when to apply a skill), hard for irreversible/critical correctness (teaching framing, context threshold).

4. **Block signals must be exit-0-with-JSON, not exit-2-with-stdout.** The old pattern (exit 2, write JSON to stdout) silently fails because the hook harness discards stdout on exit 2. Always emit via `{decision: "block", reason: "..."}` JSON on stdout with exit 0 — the complete, correct signal per Claude Code's hook contract.

5. **SDD (Subagent-Driven Development) pattern is proven:** fresh implementer per task, sonnet-tier reviewer per task, opus-tier final whole-branch review, with independent verification between stages. Zero findings on Task 1, Task 2, and whole-branch means the pattern actually works for catching issues early.

## Deferred Until Later

- Real context-percentage API (`anthropics/claude-code#27969`) — if it ships, swap the estimation function in `auto-compact.js` for the real value (one-line change).
- Threshold auto-tuning from observed drift — manual, human-driven process for now; automate if real drift data proves it matters.
- Truss's own skill — no brainstorm/plan/implementation wrapper yet, just the raw tools and gates. If development-on-itself becomes a repeated pattern, consider packaging the discipline itself (e.g., a skill that enforces the SDD loop automatically).
