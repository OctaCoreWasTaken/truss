# Workflow Rules

## Core loop
- Before any new feature: run /brainstorming first
- Use context7 automatically for any external library/API
- Implement via superpowers:subagent-driven-development (fresh subagent per task, review between tasks), not full rewrites
- Follow TDD: write failing test first, then implement
- If something breaks: use superpowers:systematic-debugging, root-cause before fixing
- Never rewrite whole files — modify existing code, minimal diffs

## Truss (dependable coworker — dogfood it)
We build truss using truss. Two shipped skills, all overridable via `truss-skills/<name>.md` (see below):
- **truss:research** — during brainstorm/plan, research every external lib/API/pattern the work touches. Compile the list, let me add to it, then research (context7 first, WebSearch fallback). Append findings to `RESEARCH.md`. Don't trust your own confidence — research anyway.
- **truss:big-brain** — delegate hard design/analysis to a `thinking` subagent during brainstorming/planning, before any plan exists. Delegate when such a decision appears; don't first argue whether it's hard enough. The subagent reasons from `RESEARCH.md`, doesn't re-research. (Note: `truss:model-routing` was dropped 2026-07-08 — Superpowers' own `subagent-driven-development` skill already covers model selection for plan-execution delegation in more detail; see `proposal.md` Component 8.)
- **Customize any skill's text**: create `truss-skills/<name>.md` (e.g. `truss-skills/research.md`) to fully replace the shipped instructions — durable across plugin reinstalls, unlike editing the plugin's own installed files directly. Override is instruction-based (same reliability as normal invocation).
- Truss files are the control surface: `RESEARCH.md` (what's known), `CONVENTIONS.md`, `DECISIONS.log` (big-brain delegations + subagent report decisions, auditable), `EVENTS.log` (auto tool log), `truss.toml` (config). Read/update them, don't invent parallel scratch files.
- **Subagent completion reports, any workflow:** whatever completion-report artifact the active development workflow produces (Superpowers' `subagent-driven-development` task reports, another plugin's equivalent, or a plain reply if none is active), it opens with a fixed schema before any free-form narrative:
  ```
  status: DONE | BLOCKED
  commit: <hash>
  files_changed: <list>
  tests: <before X/Y pass> -> <after X/Y pass>
  decisions: <one line each, only if the brief was deviated from>
  blockers: <one line each, or "none">
  ```
  Prose is still allowed below the schema block. Don't hard-code this to any one plugin's file path — the schema is a property of any subagent report, the artifact's location isn't. The `decisions` field also gets appended, one line per entry, to `DECISIONS.log` (`YYYY-MM-DD HH:MM | report | <decision>`) — this keeps the rule auditable even though truss doesn't own the report file itself. Skip only if `truss.toml`'s `[log] decisions` is explicitly set to `false` (same toggle `big-brain` honors).

## claude-mem (cross-session memory — automatic)
Captures every Read/Edit/Bash as a compressed observation and auto-injects relevant ones into future sessions (starts on session 2, nothing to invoke). Complementary to truss's control-surface files, not a replacement — claude-mem is opaque/automatic recall; `CONVENTIONS.md`/`RESEARCH.md` stay the deliberate, git-committed, human-readable record.
- Useful on demand: `/mem-search` ("did we already solve this?") before redoing investigation; `smart-explore` (tree-sitter structural search) instead of reading full files just to find where something lives.
- **Do not use** `make-plan`/`do` — they duplicate `superpowers:writing-plans`/`subagent-driven-development` but skip brainstorming's clarifying-question discipline. The Core loop above is the one planning pipeline here.
- `what-the` reserved for one-off explanations of things unrelated to this codebase, if ever needed.

## Ponytail (simplicity)
- Runs in ultra mode: always pick smallest/simplest solution, stdlib first, no unrequested abstractions
- Order of operations: /brainstorming (Superpowers) → check context7 for unfamiliar libs → superpowers:subagent-driven-development → ponytail's YAGNI ladder applies to every diff
- Never let Superpowers' plan mode override ponytail's minimalism — plan for correctness, implement minimally

## Karpathy guidelines
- Surface assumptions before coding — state them, or ask if ambiguous. Don't silently pick an interpretation.
- Surgical changes only: touch only what the task requires, match existing style, no drive-by refactors or cleanup of unrelated code
- Exception: remove orphans your own change created (unused imports, dead helpers)
- Goal-driven execution: turn vague asks into verifiable success criteria (e.g. "add validation" → "write failing tests for invalid inputs, then make them pass")
- Overlaps with ponytail on simplicity — that's fine, don't resolve the redundancy, just don't apply both as separate steps

## Caveman (default: ultra)
- Runs in ultra mode always: drop articles/filler/pleasantries/hedging, fragments OK, shortest phrasing that keeps technical accuracy.
- Never compress code, commands, file paths, or error messages — always exact. Auto-drops for security warnings, irreversible actions, multi-step sequences where fragments risk misreading, or if the user seems confused — resume after clarity restored.

## Priority order when rules conflict
1. Correctness / safety (superpowers:systematic-debugging, Karpathy's "ask when ambiguous")
2. Minimalism (Ponytail, Karpathy's surgical changes)
3. Caveman phrasing everywhere, including explanations
