truss
v0 Specification — The Trust Layer for Agentic Coding
TL;DR
truss is a Claude Code plugin that runs alongside existing workflow plugins (Superpowers, Ponytail, Context7, etc.) rather than replacing them. Its job is trust: it locks down what "correct" means before code is written, remembers what's already failed so it isn't re-tried, refuses to let the model edit files it hasn't read, and pulls the developer into a small number of real design decisions exactly where their understanding of the codebase is going stale — so the developer always knows what the agent did, why, and that it works, without reading pages of verbose output to find out.
Base
    • Distributed as a Claude Code plugin: mostly deterministic hooks + markdown files, minimal LLM calls.
    • Designed to run on top of other installed plugins, not to replace their workflow/routing/token-optimization functions.
    • Provider: Claude only.
v0 Scope (Trust Layer)
Six components, chosen because each is cheap (mostly zero-LLM-call hooks), evidence-grounded, and not already covered by an existing popular plugin.
Folder Structure (OpenSpec-aligned)
openspec/specs/            conventions + intent doc registry (truth) openspec/changes/<x>/   proposal.md              plain-language acceptance criteria (human-approved)   tasks.md                 plan, incl. task split + difficulty STATE.md                   rolling memory + comprehension pile FAILURES.md                failure ledger (structured negative-knowledge records) BRIEF.md (per module)      plain-language what / why / recent changes truss.toml                 router rules, modes, tool config EVENTS.log                 append-only tool/cost log
Reuses OpenSpec's existing specs/changes convention instead of inventing a new one — keeps truss compatible with other tools that already read that shape.
Components
1. Failure Ledger + Pre-Action Gate — DEFERRED (2026-07-08, novel but blocked; revisit)
    • Verdict from research + assessment: the LEAST redundant remaining component (nothing does the specific thing — a distilled negative-knowledge record gated before editing the same code area), but the hardest to build, and its highest-value form depends on a problem the ecosystem hasn't cracked. Deferred, not dropped.
    • Ecosystem overlap (2026-07-08 web research): claude-mem (github.com/thedotmack/claude-mem) does persistent memory — records observations after each tool call, AI-compresses to categorized notes, SQLite, injects into future sessions — but general recall, not per-area failure-gating. Superpowers systematic-debugging (installed) has an in-session "architectural review after 3 failed fix attempts" circuit-breaker and turns lessons into skills over time — process-based, not a persistent per-area ledger. Native memory (CLAUDE.md / memory tool) is general and, per Claude Code's own docs, under-used by the model and "can't tie memory to what the code actually was at that moment."
    • Two blockers to solve before building: (a) capturing a failure is fuzzy — "what counts as failed" is not hook-observable, so the capture trigger is judgment-based (a skill), carrying the same soft-firing risk we hit and fixed with big-brain this session. (b) tying a failure to a code location is the exact thing the community flags as UNSOLVED (line ranges drift as code changes; memory can't be pinned to code state) — and per-hunk pre-edit gating, the most valuable part, rests entirely on it.
    • A lazy v0 (file-keyed failure notes, skill-captured, surfaced before editing that file) is buildable but weaker — drifts toward "just use claude-mem or a CLAUDE.md convention." Not worth it until there's a cleaner idea for blockers (a) and (b).
    • Note: this also blocks the failure-triggered escalation tier deferred from Model Routing (Component 8) — that tier needs this ledger's signal.
Intent (still valid): A single structured negative-knowledge record raised pass rate from 31.6% to 36.8% using 73% fewer tokens than raw self-debug feedback; a distilled multi-round version beat 3-round self-debug (47.4% vs 44.7%) with 28% fewer tokens (arXiv:2606.21024). Plain retry with no memory improved nothing. Prevents the model from re-proposing ideas already shown not to work.
2. Read-Before-Write Gate — DROPPED (2026-07-07)
    • As proposed, this is already a native Claude Code platform guarantee, not something a plugin needs to add. Per Claude Code's own tools-reference docs: the Write tool already fails if an existing file wasn't read first (new files exempt, matching what we'd have built); the Edit tool's read-requirement is already satisfied by Read or by single-file Bash view commands (cat/head/tail/sed -n/grep/egrep/fgrep, no pipes/redirects). Building this would duplicate existing platform functionality — fails truss's own "modify existing tools rather than rebuilding equivalents" principle.
    • One real gap remains, out of scope for now: files mutated via Bash (sed -i, shell redirects, tee) bypass the native guarantee entirely. Detecting file-writes inside arbitrary shell syntax is a materially harder, fuzzier problem than the original proposal — a candidate for a future, much narrower component if ever revisited, not this one.
Intent (historical, no longer actionable): Analysis of AMD's Claude Code session data found 1 in 3 edits were made to a file the model had not read in its recent tool history — a direct cause of broken conventions and duplicated logic (GitHub issue #42796). This finding likely predates or reflects sessions bypassing the native guarantee (e.g. via Bash), not a gap the guarantee itself leaves open.
Deferred to v1+ roadmap (not built now — each duplicates or competes with an existing plugin, or needs more validation first): tool-call pruning/auto-summary, task router with tier escalation, tree-sitter context engine + intent-doc registry + retrieval, and a step-through debug harness. Full detail on these is in the Roadmap section below.
3. Spec Gate — DROPPED (2026-07-07)
    • Three of its four requirements are already delivered by the Superpowers workflow truss runs on top of and that we used all session: restate request as plain-language acceptance criteria (brainstorming's design + write-doc steps), developer approves the criteria not the code (brainstorming's User Review Gate), tests+code written against the approved criteria (writing-plans + TDD + subagent-driven-development). Building a Spec Gate would mostly duplicate this — fails truss's "don't rebuild what an existing plugin already does" principle.
    • Only genuine gap: a hard, hook-enforced lock on approved spec files (block edits without re-approval) + staleness detection if code drifts from a frozen spec. Superpowers only catches drift via after-the-fact task review, not a structural lock. That narrow lock is a possible future micro-component, not the full Spec Gate as proposed.
Intent (historical): The entity that defines "correct" must differ from the entity implementing it (arXiv:2603.25773). Still true — but the separation is already achieved by Superpowers' human-approval gate, not something truss must add.
4. Comprehension Pile + Decision Routing — SKIPPED (2026-07-08, not viable as designed)
    • Brainstormed in depth; the decision-routing half doesn't hold together. Dead-ends found, recorded so a future attempt doesn't repeat them:
      - A soft reminder to "route this decision" fires right before the Write, but by then the tool call already embodies the decision — so the developer is asked to rubber-stamp already-produced code, not make a real choice. That reintroduces the exact "must understand the code to judge it" problem the component was meant to avoid.
      - Making it a hard block (can't write a stale file until AskUserQuestion is called) fixes the timing, but the underlying premise breaks for the actual user base: most Claude Code users don't read code, so routing a design decision to them over code they won't inspect isn't genuine active engagement — it's friction without comprehension.
      - Paying down the pile can't be tied precisely to "a decision was answered" — hooks observe tool calls, not conversational exchanges. A Read-triggered reset removes staleness even when Claude just read the file itself, which isn't the same as the developer engaging.
    • SALVAGEABLE (separable, viable on its own, revisit later): the ambient plain-language recap idea that came out of the same brainstorm — a skill that, on meaningful changes during implementation, appends one short plain-language line to STATE.md ("switched shader cache to event-based invalidation because polling wasted cycles"), so a non-code-reading user can open STATE.md and read the story without a diff. Unconditional, no staleness gate, no routing. This piece does NOT depend on the broken decision-routing mechanism and could be its own small component if pursued.
    • Original design (for reference): Every changed line adds to a per-module staleness pile, tracked in STATE.md (a count of unread changes, not an estimate of understanding).
    • The gate is NOT a forced brief-to-read. When a module's pile is high, the agent's next genuine design decision in that module is routed to the developer as a concrete either/or question with 2-3 lines of context, instead of being decided silently.
    • Example: "Renderer's shader cache needs an invalidation policy — time-based or event-based? Context: [3 lines]."
    • Fresh modules: the agent decides everything autonomously. Stale modules: the developer is pulled into real decisions. The mechanism self-doses to exactly where understanding is eroding.
    • Answering a routed decision pays down that module's pile. BRIEF.md remains available as optional reference, never a mandatory gate.
Intent: Comprehension debt is a documented 2026 problem (Storey, Osmani, Anthropic RCT). But a forced "read this before continuing" gate provably fails: 50% of users click through security warnings in under 1.7s and fMRI shows visual processing shutting down after repeated exposure (warning-fatigue literature); reading is also the lowest tier of the ICAP engagement framework. Anthropic's own RCT found active-inquiry users retained comprehension while passive AI-users lost it. Routing an actual design decision to the developer is active (highest ICAP tier), consequential and always-different (resists habituation), and adds zero ceremony because the decision had to be made anyway — only who makes it changes.
5. BRIEF.md — DROPPED (2026-07-07)
    • Its stated source, the "intent doc registry," is deferred to v1+ and does not exist — so BRIEF.md as specified has no cheap generator; it'd be manually/LLM-maintained per module, i.e. a doc that must be kept in sync with code (maintenance debt) unless it clearly earns its keep.
    • Its value (a plain-language module summary) now overlaps the shipped truss:plain-speak skill plus simply asking the model. Marginal on its own. Revisit only if/when the intent-doc registry is built.
Intent (historical): Let the developer stay synced by reading a paragraph instead of a diff.
6. Files-as-Control-Surface
    • PLAN.md / tasks.md — the agent's current intentions, editable.
    • STATE.md — the agent's working memory and comprehension pile, editable.
    • CONVENTIONS.md — invariants the agent must always follow, editable.
    • truss.toml — router rules, modes, tool access, editable.
    • EVENTS.log — append-only record of every tool call, mode, and cost, for replay/audit.
Intent: One predictable mechanism for steering any part of the system. Fully autonomous by default; open a file for full manual control. No flags or modes to learn.
7. Coworker Mode — PARTIALLY DONE / remainder DROPPED (2026-07-07)
    • DONE: the plain-language / low-verbosity output piece shipped as the truss:plain-speak skill (jargon explained inline, short and dense, distinct from Caveman's compression). See docs/superpowers/specs/2026-07-07-plain-speak-design.md.
    • DROPPED (remainder): (a) critique-only stance (developer originates ideas, agent never proposes solutions unprompted) — a niche mode that fights how brainstorming naturally proposes 2-3 approaches; wanted only situationally, better as an optional toggle skill if ever needed. (b) cite-every-claim rule — overlaps truss:research (already grounds research-heavy claims) and fights plain-speak's brevity. Both dropped for now.
Intent (historical): Human-in-the-loop collaboration beats both full automation and human-only work, but only when human input concentrates at a few high-leverage points and the human engages critically (HITL literature). The plain-language piece (now shipped) makes those high-leverage moments fast to engage with; the other two pieces are situational, not core.
8. Model Routing — REDESIGNED (2026-07-07), truss:model-routing DROPPED / truss:big-brain KEPT (2026-07-08)
    • The per-task Haiku classifier below was never built as specified. It was replaced with a four-role table (truss.toml [model]: coordinator/thinking/coding/escalation) and two skills: truss:model-routing (subagent delegation by role) and truss:big-brain (split out later — judgment-based delegation of hard brainstorm/plan-phase analysis to a thinking-tier subagent). See docs/superpowers/specs/2026-07-07-truss-planning-layer-design.md.
    • DROPPED (2026-07-08): truss:model-routing. Found during dogfooding (executing the plain-speak teaching mode plan via subagent-driven-development): Superpowers' own subagent-driven-development skill ships a more detailed Model Selection rubric (mechanical/integration/architecture/review tiers, turn-count-vs-token-price reasoning) that governs the exact case truss:model-routing claimed — delegating implementation work to a subagent. Once a plan is being executed through that skill, truss:model-routing added nothing on top; verified in practice, its guidance wasn't what actually drove any dispatch decision.
    • KEPT: truss:big-brain. Covers a real gap subagent-driven-development doesn't — delegating hard analysis during brainstorming/planning, before any plan or task exists. No overlap found.
    • Original design (historical reference, never built as specified):
    • A Haiku-based difficulty classifier scores each incoming task 1–10 before work begins.
    • Score 1–4 routes to Haiku; 5–7 to Sonnet; 8–10 to Opus.
    • Not a standalone routing system — the classifier runs as part of the comprehension pile's decision routing (Component 4). When a stale module triggers a developer decision, the same difficulty score determines which model executes the resulting work.
    • The classifier itself always runs on Haiku, keeping classification cost near-zero.
    • Routing decisions are appended to EVENTS.log alongside tool calls and cost.
Intent: Routing by task difficulty rather than task type avoids unnecessary Opus calls on mechanical work while reserving model capacity for decisions that genuinely need it. Integrating into the comprehension pile's existing routing surface means no separate trigger, no added ceremony.

Roadmap (v1+, not built now)
Deferred because each duplicates an existing plugin, needs more validation, or adds complexity ahead of proven need.
Router + tier escalation
Cheapest model splits a task and guesses difficulty per subtask, cached in tasks.md; escalates only a failing subtask. Partially overlaps Claude Code's native fallbackModel/opusplan — revisit if those prove insufficient.
Context engine (repo map + intent docs + retrieval)
Tree-sitter repo map, enforced intent-only doc registry per function, pinned CONVENTIONS.md, Haiku-pinned retrieval over codebase/docs/web. Overlaps Context7 and Aider's own repo map — build only the gap once those are evaluated directly.
Debug harness
Breakpoint/step/watch/stack tools for incremental, human-style debugging instead of self-graded tests. Largest build item; competes with LSP-based and DevTools MCP debugging plugins — validate demand before committing.
Tool-call pruning + auto-summary
Keep only the last N tool calls in full, summarize the rest instead of dropping or hoarding it. Evidence is from one enterprise workflow benchmark, not coding-specific; Claude Code's own compaction may already cover part of this.
Mode config
Per-mode restricted tool subsets (plan/explore/implement/debug/research) to shrink prompts and reduce scope-creep. Useful, but only worth the config surface once the v0 core is in daily use.
Design Principles
    • Autonomous by default, controllable through plain files — never through configuration UI.
    • Every feature must either reduce round trips or run without an LLM call — anything that costs an extra query and doesn't clearly pay for itself is cut.
    • Verification comes from execution and frozen human-approved criteria, never from the same model grading its own output.
    • Modify existing tools (Aider, OpenSpec conventions) rather than rebuilding equivalents from scratch.
Findings & Provenance (Reverse-Engineered Mechanisms)
Mechanisms extracted from the highest-adoption plugins in the ecosystem, what makes each work, and how truss builds on it.
Ponytail (69k★, MIT) — tiny pinned rules + decision ladder
    • Mechanism: a ~1KB always-on ruleset re-injected each turn by two lifecycle hooks. Core device is a first-match decision ladder ("stop at the first rung that holds": needed at all? stdlib? platform? existing dep? one line? only then write) plus an explicit never-cut list (validation, security, error handling) and 'ponytail:' comments harvested into a shortcut ledger.
    • Why it works: a cheap deliberation step before expensive generation; the never-cut list keeps minimalism safe; measured -54% LOC / -20% cost on real agentic tasks.
    • truss adoption: CONVENTIONS.md and mode rules written ladder-form, ≤1KB, with a never-cut list. Pre-generation gate checks the doc registry ("does a symbol with this intent already exist?") — a lookup, cheaper than Ponytail's reasoning step.
cc-spec-driven — hook-enforced workflow
    • Mechanism: constraints enforced mechanically, not via prompts. SessionStart hook verifies project config exists; PostToolUse hook verifies file paths and force-triggers required follow-ups; Stop hook blocks session end if the workflow is incomplete.
    • Why it works: prompt constraints are "easily overlooked or simplified" — hooks make rules physically unskippable.
    • truss adoption: doc-sync rule (diff touching a function must update its doc entry) enforced by a PostToolUse hook that rejects non-compliant diffs; spec-gate and comprehension-pile pauses enforced by Stop/PreToolUse hooks.
workflow-orchestration — lazy loading + soft enforcement
    • Mechanism: ~1.1KB stub injected at session start; the full orchestrator loads only on first delegation (~6.6K tokens saved per session). Enforcement is adaptive nudges (silent → hint → warning) rather than hard blocks.
    • Why it works: context cost is paid only when a feature actually fires.
    • truss adoption: harness tool definitions and mode instructions stub-injected, full-loaded on first use; comprehension-pile warnings escalate softly before hard-pausing.
caveman / Citadel — scoped subagents + cheapest-path routing
    • Mechanism: delegate subtasks to tightly-scoped subagents with their own isolated context windows (caveman: ~75% token cut); route intent to the cheapest execution path automatically (Citadel).
    • Why it works: isolation per subtask beats compression of one giant context.
    • truss adoption: router-split subtasks execute as scoped subagents, each seeing only its slice of context (its block + attached docs), never the whole session.
Reverse-Engineered Findings (from proven plugins)
Source
Mechanism that makes it work
How truss builds on it
cc-spec-driven (MIT, github.com/mkhrdev/cc-spec-driven)
Hooks as enforcement, not suggestions: SessionStart verifies state, PostToolUse verifies paths and force-triggers follow-ups, Stop hook blocks completion if incomplete. "Skill describes how; Hook ensures it can only be done this way."
Doc-sync rule and spec gate implemented as blocking hooks: a diff touching a function without updating its doc entry is rejected at PostToolUse, not requested politely in the prompt.
cc-spec-driven (tiered loading)
Context loaded in levels: 0 = file list (always), 1 = frontmatter of target + direct deps, 2 = section titles, 3 = full content only when modifying.
Context engine loads registry entries the same way: intent one-liners for everything referenced, full contract + callers only for the symbol being edited.
cc-spec-driven (RC preview)
Changes generate a preview file; merge to official docs happens only after explicit human confirm. Stale previews (older than the doc they modify) are detected and flagged.
Spec gate already matches this; adopt staleness detection — if code drifts under frozen criteria (e.g. a rebase), the gate flags criteria as stale and asks for re-approval.
Citadel (github.com/SethGammon/Citadel)
Four-tier routing behind one command; campaign state files persist across sessions; circuit breaker stops runaway agent loops.
Router keeps 3 rules but adopts the circuit breaker: a global cap on consecutive failed tool loops, not just per-bug escalation. STATE.md already covers campaign persistence.
Ponytail (github.com/DietrichGebert/ponytail)
Two tiny lifecycle hooks inject a cheap deliberation ladder ("does stdlib/platform/existing dep already do this?") before generation. Value = cheap decision gate before expensive output.
Pre-generation gate checks the intent doc registry for existing symbols matching the requested behavior — a lookup, cheaper than Ponytail's reasoning step, same effect.
caveman (token compression)
Savings come from delegating to tightly-scoped subagents with compressed output styles — the main session stays small because work happens elsewhere.
Router runs each subtask as a scoped subagent with compressed output, keeping the orchestrating session lean instead of compressing it after the fact.

Grounding
truss Component
Supporting Finding
Failure ledger
A single structured negative-knowledge record raised pass rate from 31.6% to 36.8% at 73% fewer tokens than raw self-debug feedback; a distilled version beat 3-round self-debug outright (47.4% vs 44.7%) at 28% fewer tokens (arXiv:2606.21024).
Read-before-write gate
AMD's analysis of 6,852 Claude Code sessions found 1 in 3 edits were made to a file not read in recent tool history, a direct cause of broken conventions (GitHub issue #42796).
Tool-call pruning + summary
Pruning to the last 5 tool calls alone reached 79% task completion; adding automated summarization of the pruned portion reached 91.6% at similar token cost (arXiv:2606.10209).
Spec gate
Same-model self-review fails because generator and reviewer share the same blind spots — a correlated-estimator problem, not an independence one (arXiv:2603.25773).
Comprehension pile + decision routing
Comprehension debt: AI generates code 5–7x faster than humans understand it (Storey arXiv:2603.22106; Anthropic RCT). Forced-read gates fail to habituation — 50% click through warnings in <1.7s (warning-fatigue fMRI studies); active decisions resist this and match the ICAP engagement framework.
Debug harness
Agents over-trust self-narrated inline tests and substitute them for real verification — a leading cause of confidently-wrong "task complete" claims in agent trajectories.
No fake comprehension score
A study of 121 candidate code-comprehensibility metrics found none reliably correlated with measured human understanding.
A study of 121 candidate code-comprehensibility metrics found none reliably correlated with measured human understanding.

---
9. Split-Register (think compressed / answer plain-speak) — PROBED & DROPPED (2026-07-08)
    • Idea: reason in caveman-terse register (cut thinking tokens) + answer in truss:plain-speak (digestible). Pitched as truss's novel token-saver on both axes.
    • Killed by cheap empirical probes before any spec/code (Karpathy probe-first):
      - Probe 1 (split feasibility): a model CAN hold two registers in one turn — terse reasoning + digestible answer, no bleed. Feasible. But terse reasoning came out LONGER than baseline (1866 vs 1490 chars) — compression invited more reasoning steps.
      - Probe 2 (token A/B, output pinned short so delta ≈ reasoning cost): compressed-thinking 23,504 tok vs default 23,416 tok. Flat (+0.4%). Reasoning tokens are DEPTH-driven, not prose-driven — same problem = same tokens.
      - Decisive: caveman's own docs/HONEST-NUMBERS.md states verbatim it "does not compress ... the model's thinking tokens" — output-style only, 0% thinking change BY DESIGN. So no caveman-style instruction can cut reasoning tokens. Also: caveman COSTS ~1-1.5k input tok/turn and is net-negative on terse/coding workloads (their issue #145) — truss's exact use case.
    • Working half (digestible output) already shipped as truss:plain-speak. Nothing left to build.
    • Lesson for positioning: do NOT claim truss lowers tokens via reasoning compression — it can't. Model-routing lowers cost only on delegated subagent work (truss can't swap live session model). Truss's real pitch = dependable coworker (autonomous research + digestible output + subagent-tier routing), NOT token magic.
