# Workflow Rules

## Core loop
- Before any new feature: run /brainstorming first
- Use context7 automatically for any external library/API
- Implement via superpowers:subagent-driven-development (fresh subagent per task, review between tasks), not full rewrites
- Follow TDD: write failing test first, then implement
- If something breaks: use superpowers:systematic-debugging, root-cause before fixing
- Never rewrite whole files — modify existing code, minimal diffs

## Truss (dependable coworker — dogfood it)
We build truss using truss. Three shipped skills, all overridable via `truss-skills/<name>.md` (see below):
- **truss:research** — during brainstorm/plan, research every external lib/API/pattern the work touches. Compile the list, let me add to it, then research (context7 first, WebSearch fallback). Append findings to `RESEARCH.md`. Don't trust your own confidence — research anyway.
- **truss:big-brain** — delegate hard design/analysis to a `thinking` subagent during brainstorming/planning, before any plan exists. Delegate when such a decision appears; don't first argue whether it's hard enough. The subagent reasons from `RESEARCH.md`, doesn't re-research. (Note: `truss:model-routing` was dropped 2026-07-08 — Superpowers' own `subagent-driven-development` skill already covers model selection for plan-execution delegation in more detail; see `proposal.md` Component 8.)
- **truss:plain-speak** — force-loaded every session (2026-07-08: widened from brainstorm/plan-only), not something you invoke. Acts as a teacher: explain the codebase's mechanism, flow, and reasoning in plain language — not jargon, not a shallow one-liner. Tracks taught terms in `GLOSSARY.md` so vocabulary compounds instead of re-teaching or dumping.
- **Customize any skill's text**: create `truss-skills/<name>.md` (e.g. `truss-skills/plain-speak.md`) to fully replace the shipped instructions — durable across plugin reinstalls, unlike editing the plugin's own installed files directly. `plain-speak`'s override is hook-checked (deterministic); `research`/`big-brain`'s is instruction-based (same reliability as their normal invocation).
- Truss files are the control surface: `STATE.md` (where we are), `RESEARCH.md` (what's known), `CONVENTIONS.md`, `GLOSSARY.md` (taught vocabulary), `EVENTS.log` (auto tool log), `truss.toml` (config). Read/update them, don't invent parallel scratch files.

## claude-mem (cross-session memory — automatic)
Captures every Read/Edit/Bash as a compressed observation and auto-injects relevant ones into future sessions (starts on session 2, nothing to invoke). Complementary to truss's control-surface files, not a replacement — claude-mem is opaque/automatic recall; `STATE.md`/`CONVENTIONS.md`/`RESEARCH.md`/`GLOSSARY.md` stay the deliberate, git-committed, human-readable record.
- Useful on demand: `/mem-search` ("did we already solve this?") before redoing investigation; `smart-explore` (tree-sitter structural search) instead of reading full files just to find where something lives.
- **Do not use** `make-plan`/`do` — they duplicate `superpowers:writing-plans`/`subagent-driven-development` but skip brainstorming's clarifying-question discipline. The Core loop above is the one planning pipeline here.
- `what-the` overlaps `truss:plain-speak` for this codebase specifically — `plain-speak` already covers it (ambient, tracks vocabulary in `GLOSSARY.md`). Reserve `what-the` for one-off explanations of things unrelated to this codebase, if ever needed.

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

## Caveman + Plain-Speak — layered, not either/or (updated 2026-07-08)
Caveman and plain-speak govern different axes and both apply always, including during codebase explanations — neither suspends the other:
- **Caveman governs phrasing** — word choice, filler removal, sentence compression. Decides *how* something is said.
- **Plain-speak governs information content** — depth, jargon definition, teaching, `GLOSSARY.md` tracking. Decides *what* gets said and at what depth.

A codebase explanation is still phrased in caveman's compressed style, but must still define new terms plainly, explain mechanism/flow/reasoning at plain-speak's required depth, and log new terms to `GLOSSARY.md` in the same turn.
- Never compress code, commands, file paths, or error messages — always exact. Auto-drops for security warnings, irreversible actions, multi-step sequences where fragments risk misreading, or if the user seems confused — resume after clarity restored.
- Caveman's own benchmarks still say it's net-negative below ~1.5k-token replies (this project's typical turn) — re-enabled anyway on explicit request; revisit if the overhead stops feeling worth it.
- Historical note: an earlier *split-register* idea (caveman-terse reasoning, plain-speak-clear answer) was probed and killed same-day (2026-07-08) — reasoning tokens are depth-driven not prose-driven, splitting saved nothing there. This layering is a different axis (output phrasing vs. output content), not a re-attempt of that killed idea.

## Priority order when rules conflict
1. Correctness / safety (superpowers:systematic-debugging, Karpathy's "ask when ambiguous")
2. Minimalism (Ponytail, Karpathy's surgical changes)
3. Plain-speak's information depth (term definitions, mechanism/flow/reasoning, `GLOSSARY.md` logging) — never dropped, regardless of phrasing style
4. Caveman phrasing everywhere, including explanations — never at the cost of 1–3
