# Truss — Planning Layer Design (Research Gate + Model Routing)

**Date:** 2026-07-07
**Scope:** Two related v0 features that activate during the brainstorm/plan phase — a research gate and a redesigned model-routing policy. Both ship as truss-owned skills plus `truss.toml` config, and ride on the existing plugin workflow (Superpowers brainstorming/planning/subagent-driven-development) rather than replacing or hard-depending on it.

---

## Overview

Two problems this addresses:

1. **Overconfident planning.** The model acts confident on unfamiliar libraries/APIs/patterns, fails, retries, fails again, and only researches once the developer manually pushes it — sometimes failing on things never discussed, so the developer can't say in advance what to research. Fix: a **research gate** that, during planning, researches the technologies a plan actually touches *unconditionally*, never gated on the model judging its own uncertainty.

2. **Half-baked model routing.** The original proposal.md Component 8 (a Haiku classifier scoring each task 1–10, routing to Haiku/Sonnet/Opus) is replaced. It used the weakest model to make the most consequential decision, predicted difficulty upfront (a guess), added an LLM call to every task (violating truss's own "reduce round trips or run without an LLM call" principle), and never specified *how* the model swap happens. Fix: a **model-routing policy** built on the one lever truss actually has — subagent model selection.

Both features are delivered the same way: **static skill files shipped in the truss repo** (namespaced `truss:*`, like `superpowers:brainstorming` and `ponytail:ponytail`), plus roles in `truss.toml [model]`. No CLAUDE.md editing, no dynamic skill generation, no new hook events, no dependency on any specific external plugin being installed or unchanged.

---

## Key Constraint (researched, not assumed)

**A Claude Code CLI plugin cannot change the main interactive session's model.** Verified against Claude Code docs: `setModel()`, `set_model()`, and `applyFlagSettings({ model })` exist only in the **Agent SDK**, in **streaming input mode** — for code driving its own `query()`, not for plugins running inside the CLI. Hook output can set things like `hookSpecificOutput.sessionTitle`; there is **no `model` field a hook can return**.

What *is* controllable from a CLI plugin: **subagent models** (the Task/Agent tool accepts a per-agent model override). Therefore all of truss's model routing is expressed as "choose the subagent's model," never "swap the session model."

This constraint shaped the entire routing design and is the reason the original Component 8 was unbuildable as written.

---

## Feature 1: Research Gate

### Delivery
`skills/research/SKILL.md` — a static skill shipped in the truss repo, invoked as `truss:research`.

### Trigger
The skill's frontmatter `description` is deliberately general — activates when the model is **brainstorming or planning with the user** — rather than binding to any specific tool name or plugin. This keeps it working whether Superpowers is present or not, and lets Claude apply it by judgment wherever a planning phase is actually happening.

### Behaviour (procedural, not introspective)
The core instruction is **unconditional and tied to what the plan touches**, *not* to the model's confidence:

- For **every** external library, API, or pattern the plan relies on, research it — regardless of how confident the model feels. There is no "am I unsure about this?" self-check, because that self-assessment is exactly the failure mode.
- **Check `RESEARCH.md` first** for an existing relevant entry before researching anything new (avoids re-researching the same library across sessions).
- **Compile the research list and confirm it with the developer.** Before researching, present the list of items about to be researched and invite the developer to add to it; then proceed. This puts the human at a high-leverage point (they often know a fragile dependency the model wouldn't flag) without a blocking gate — it's a prompt-and-continue, not an approval wall.
- Research via **context7 first** (matches truss's existing CLAUDE.md convention), falling back to **WebSearch / WebFetch** for anything context7 doesn't cover.
- **Append findings to `RESEARCH.md`.**

### `RESEARCH.md`
A new project file in the same family as `STATE.md` / `CONVENTIONS.md`. **Lazily created by the skill on its first actual finding** — not scaffolded at `SessionStart` (scaffolding an empty file that may never be used would violate the project's "don't scaffold for later" convention). Append-only in practice: new entries are added, existing findings are not overwritten.

Entry format:

```markdown
## <library / API / pattern> — YYYY-MM-DD
Source: context7 (/org/project) | WebSearch: <query>
Findings: <what was verified, in plain language>
Used in: <spec/plan file this informed>
```

---

## Feature 2: Model Routing (replaces proposal.md Component 8)

### Principle
The main session is a **thin coordinator**: it manages the dialogue with the developer and holds no heavy work. Substantive work is delegated to **scoped subagents whose model is chosen by task type**. truss invents no new delegation — it assigns models to the subagent delegations the brainstorm/plan/implement workflow already produces. This is proposal.md's own caveman/Citadel finding (isolated, scoped subagents; cheapest-path routing) taken to its conclusion, and it sidesteps the session-model constraint entirely.

### Delivery
Split across two skills, based on a real-world finding (2026-07-07 dogfood test): a single skill bundling "roles reference" with "when to delegate hard analysis" under the name `model-routing` never got separately invoked once brainstorming/research were already active — skills only fire on Claude's own relevance-judgment, which doesn't automatically re-trigger for a second skill mid-flow. The judgment-based delegation trigger needs a name and description built for maximum recall at the moment a hard decision appears, not a mechanism-named skill bundled with an unrelated fixed rule.

- **`skills/big-brain/SKILL.md`** (`truss:big-brain`) — the judgment-based thinking-delegation trigger, isolated into its own skill with a vivid, high-recall description (ponytail-style: explicit scenario list, "the doubt itself is the trigger").
- **`skills/model-routing/SKILL.md`** (`truss:model-routing`) — trimmed to the `truss.toml [model]` roles reference plus the one fixed, non-judgment rule (coding subagents run on the `coding` model). No longer carries the thinking-delegation trigger.

### Roles
| Role | Model (default) | What runs there | truss can enforce? |
|------|-----------------|-----------------|--------------------|
| `coordinator` | session default | main interactive session: dialogue, Q&A | **No** — advisory only (see below) |
| `thinking` | `opus` | subagent for hard planning analysis | Yes (subagent model) |
| `coding` | `haiku` | implementation subagents | Yes (subagent model) |
| `escalation` | `opus` | stronger tier on failure — **deferred to v1** | Yes (subagent model) |

`coordinator` is **advisory**: truss cannot set the live session model (the constraint above), so this value documents the intended session model for planning-heavy work, which the developer sets themselves via `/model` or `settings.json`. The other three roles are enforceable because they name subagent models, which truss's skills can direct.

Rationale: Haiku codes nearly as well as Opus; what separates them is *thinking depth*, which matters in brainstorming/planning, not mechanical code. So the routing axis is **shallow execution vs deep thinking**, not easy-code vs hard-code.

### Thinking delegation (judgment-based only) — `truss:big-brain`
During planning, when the coordinator hits a genuinely hard analytical sub-problem — evaluating approaches, stress-testing/reviewing a design, an architecture call — `truss:big-brain` delegates that reasoning to a subagent on the `thinking` model and relays the result back into the dialogue.

- **Trigger is judgment-based** (the model decides in the moment). An unconditional floor was considered and **explicitly rejected** by the developer.
- **Mitigation for under-delegation:** the skill wording is **biased toward delegating** — "if there's even a moment of doubt, that doubt is the trigger" — rather than "delegate only if clearly stuck." This is a text choice, not a structural gate, so the trigger stays fully judgment-based. Documented tradeoff: judgment-based delegation leaves the door open to under-delegation, since the coordinator decides when it needs the stronger model.
- **Naming as a recall mechanism:** isolating this into its own skill named for the moment it applies (`big-brain`), rather than bundling it inside a mechanism-named `model-routing` skill, is itself part of the mitigation — a skill's `description` is what Claude matches against in the moment, so a skill sharing a name with an unrelated fixed rule is less likely to surface exactly when a hard decision appears.
- **Second dogfood finding (2026-07-07): asymmetric wording caused asymmetric behavior.** `truss:research`'s "research it — regardless of how confident you feel" is a strong, unconditional push; `big-brain`'s original "when in doubt, delegate" was comparatively soft. Result: the coordinator under-delegated to `big-brain` (soft nudge, easy to not notice), while a delegated `thinking` subagent over-relied on `truss:research` once active (inheriting the strong instruction with no counter-signal). Fix: `big-brain`'s trigger was rewritten to the same unconditional framing as research ("delegate unconditionally... do not first ask yourself whether it's hard enough"), and a new "What to do (delegated subagent)" section instructs the `thinking` subagent to reason from existing `RESEARCH.md` findings rather than re-researching by default, treating research as the exception once already delegated for analysis.

### Coding
Implementation subagents that the workflow already spawns (e.g. Superpowers subagent-driven-development) run on the `coding` model. truss does not force delegation; it governs the model of delegations that already happen.

### Config
The existing `truss.toml [model]` section is rewritten from the old classifier/threshold shape to the four named roles:

```toml
[model]
coordinator = "sonnet"   # advisory: intended session model (truss can't set it)
thinking    = "opus"      # subagent for hard planning analysis
coding      = "haiku"     # baseline for mechanical execution
escalation  = "opus"      # stronger tier when failure signals trip (v1)
```

The whole routing policy is retunable by editing one file — matches proposal.md's "autonomous by default, controllable through plain files." Replaces the arbitrary `thresholds = [4, 7]` magic numbers entirely.

---

## Portability

Neither feature depends on a specific external plugin being installed or keeping a stable skill name. The skills connect softly, by Claude's interpretation of a general description ("when brainstorming or planning"), not by matching an exact tool/skill name. If Superpowers is present, they weave into its brainstorming/planning flow; if absent, they apply directly. This satisfies the requirement that truss install on any machine alongside the developer's plugin stack and work out of the box.

---

## Explicitly Deferred / Rejected

- **Failure-triggered coding escalation** → deferred to v1. It would consume the failure ledger (Component 1), which is not built yet, so it has no signal to read. Arrives with Component 1.
- **Unconditional thinking-delegation floor** → rejected by the developer; delegation is judgment-based only.
- **Per-prompt Haiku classifier** (original Component 8) → replaced; it added an LLM round trip to every task.
- **truss managing CLAUDE.md orchestration content / dynamic skill generation** → dropped; static shipped skills achieve the same reliability without editing the developer's files.
- **UserPromptSubmit hook + per-prompt research classification** → dropped as token-inefficient; research lives in the planning-phase skill, which only loads when relevant.

---

## Testing

- **Research skill:** verify it triggers in a planning context; verify unconditional research of a named external library produces a `RESEARCH.md` entry with source + findings; verify a second run reuses the existing entry instead of re-researching.
- **`RESEARCH.md`:** verify lazy creation on first finding (absent until then); verify append (existing entries preserved).
- **Model-routing skill:** verify it reads roles from `truss.toml [model]`; verify a hard planning sub-problem delegates to a `thinking`-model subagent and relays the result; verify config overrides change which model each role uses.
- **`truss.toml [model]`:** verify the new four-role shape parses under the existing config parser and that missing roles fall back to defaults.
```