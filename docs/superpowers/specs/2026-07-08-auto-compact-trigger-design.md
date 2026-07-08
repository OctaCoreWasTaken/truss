# Truss — Auto-Compact Trigger Design

**Date:** 2026-07-08
**Scope:** v0 — a `UserPromptSubmit` hook that hard-blocks prompt submission once estimated context usage crosses a configurable threshold, prompting the user to run `/compact` before Claude Code's native ~95% auto-compact would fire. Includes a prerequisite fix to `dispatch.js`'s block-emission path, which this feature is the first real consumer of.

---

## Overview

Motivation: Claude Code's native auto-compact fires at ~95% context capacity — past the point where retrieval accuracy and reasoning depth have already degraded (context rot). Manual `/compact` earlier produces better summaries, but requires the user to notice and act. This is a user-originated proposal, refined through brainstorming to fit truss's existing architecture and to correct three premises that didn't hold up under research: the trigger mechanism needed to be deterministic rather than instruction-based (the same lesson already learned building `plain-speak`), the context-window assumption needed to be configurable rather than hardcoded (this project's actual window is 1M tokens, not the commonly-assumed 200K), and the estimation method itself is more accurate using the transcript's real reported token usage than a char-based approximation (see `RESEARCH.md`).

## Prerequisite: fix `dispatch.js`'s block-emission bug

`hooks/dispatch.js`'s current block path writes `{decision: 'block', reason}` to stdout, then calls `process.exit(2)`. Per Claude Code's hook documentation, exit code 2 blocks the prompt/tool call and shows **stderr** to the user — any JSON on stdout is ignored. This means the reason message is currently silently swallowed on every block, for every hook event type. It has never surfaced because no currently-shipped truss gate has ever actually triggered `result.block` (`read_before_write`/`spec_gate` were dropped, `failure_ledger` was deferred — see `proposal.md`). This feature is the first real consumer of that path, so the fix is folded into this plan rather than filed separately: switch to exit code 0 with the JSON on stdout, which Claude Code processes as structured `decision`/`reason` output. This fixes the path for every future gate that blocks, not just this one.

## Mechanism

New file: `hooks/user-prompt-submit/auto-compact.js`. Registered in `hooks/hooks.json` under a new `UserPromptSubmit` entry pointing at `dispatch.js`, no matcher (match-all, same pattern as the existing `PreToolUse`/`PostToolUse` entries). Node.js stdlib, matching every other truss hook — no reason to break that convention here.

On each prompt submission:
1. Read `transcript_path` from the hook's JSON input.
2. Parse the transcript JSONL (one JSON object per line), scan from the end for the most recent line with `type: "assistant"` and a `message.usage` field.
3. Sum `usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens` — the real, API-reported token count for that turn (not a char-based approximation; see `RESEARCH.md`). This already reflects the true context sent to the model, including system prompt, skill descriptions, and MCP tool schemas the original char/4 approach couldn't see.
4. If `usage_total >= context_max * threshold`, return `{block: true, message: "..."}`. Otherwise return `null` (silent, zero overhead on normal turns). If no assistant turn with `usage` exists yet (e.g. very first prompt of a session), return `null` — nothing to estimate from.

The block reason is shown to the **user**, not injected into Claude's context — confirmed via Claude Code's hook documentation (`reason` is user-facing only; `additionalContext` is what reaches Claude, and it's only appended when *not* blocked). This means the flow is: prompt rejected with a visible reason → user runs `/compact` → user resubmits. This was chosen deliberately over a soft `additionalContext` instruction after the same soft-compliance failure mode was already observed this session with `plain-speak`'s pre-hook-forced version — a trigger Claude can read and ignore under task pressure defeats the point of firing before the user notices on their own.

## Config

`truss.toml` gains:

```toml
[gates]
auto_compact = true   # new boolean, alongside existing read_before_write/failure_ledger/spec_gate

[context]
context_max = 200000  # shipped template default — the common (non-1M) context window
threshold = 0.6        # fraction of context_max that triggers the block
```

Two values rather than one baked-in absolute token count, specifically because context window size varies by user (this project's own `truss.toml` sets `context_max = 1000000` to match its actual 1M-context session) — a single hardcoded absolute threshold would be silently wrong (never firing, or firing far too early) for anyone with a different window size than whoever set it. `hooks/lib/config.js`'s existing parser already handles numeric values with no changes needed (confirmed: `[routing] stale_threshold` is existing precedent for a non-boolean value outside `[gates]`).

## Known limitations (carried forward, still accurate)

1. **No mid-task interrupt** — the hook only fires on the next prompt submission, so a single very long tool-call chain can blow past the threshold before the hook gets a chance to act. Matches the existing guidance to never compact mid-task anyway.
2. **The block only reaches the human** — Claude never sees the blocked prompt or the reason (per the hook contract). The user must notice the rejection and manually run `/compact`; this converts "remember to check the status line yourself" into "can't proceed until you act," which is a real improvement, but it is not fully automatic.
3. **The usage snapshot is one turn stale** — `message.usage` on the most recent assistant line reflects context as of that turn, not including whatever the user's current prompt itself adds. For a normal-sized prompt this is negligible against a 200K-1M budget; not worth compensating for.

(The original "estimation drift" limitation — char-based counting missing system prompt/skill/MCP overhead — no longer applies: using the transcript's real `message.usage` fields instead of char/4 approximation resolves it directly. See `RESEARCH.md`.)

## Testing

- `hooks/dispatch.js`'s fix gets a `node:test` case exercising the corrected exit(0)/JSON contract for the block path.
- `hooks/user-prompt-submit/auto-compact.js` gets cases for: estimate under threshold → no block; estimate at/over threshold → block with a reason message; `[gates] auto_compact = false` → never blocks regardless of estimate.
- Actual `/compact` behavior following a block, and the hook's real-world estimation accuracy, are manual/observational — same limitation as everything downstream of a human action in truss. The original proposal's own rollout idea (compare hook-reported estimate against Claude Code's status line over real sessions, tune `threshold` from observed drift) still applies and isn't rebuilt here as automated tooling — YAGNI until drift actually proves painful in practice.

---

## Explicitly Deferred / Out of Scope

- **Real context-percentage API** — `anthropics/claude-code#27969` (tracked in the original proposal) is open as of July 2026; no official hook input exposes true context %. If it ships, swapping the estimation function for the real value is a contained change to one function in `auto-compact.js`, not a redesign.
- **Auto-running `/compact` on the user's behalf** — not possible via the hook contract (hooks can't invoke slash commands), and not designed around; the block-and-notify flow is the actual mechanism, not a stopgap for a "real" automatic version.
- **Threshold auto-tuning from observed drift** — the original proposal's rollout plan (log estimate vs. actual, adjust `threshold`) stays a manual, human-driven process for now. Automating it would be premature before any real drift data exists.
