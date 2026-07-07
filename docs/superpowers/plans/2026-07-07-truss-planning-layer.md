# Truss Planning Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two planning-phase features to truss — a research gate and a model-routing policy — each shipped as a static skill, plus a rewrite of the `truss.toml [model]` config section.

**Architecture:** Both features are delivered as static `SKILL.md` files under `skills/` (auto-discovered by Claude Code, like ponytail's skills) — the actual behavior (researching, delegating to subagents) is performed by Claude following the skill instructions, not by truss code. The single piece of executable code is the `truss.toml [model]` section, whose defaults live in `hooks/lib/config.js`. No new hooks, no new dependencies, no `plugin.json` change.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert`, `fs`, `path`). Markdown skill files. Custom TOML parser already in `hooks/lib/config.js`.

## Global Constraints

- **Node stdlib only** — no npm dependencies may be added (`package.json` has none; keep it that way).
- **TDD** — write the failing test first, run it to confirm it fails, then implement.
- **Ponytail ultra minimalism** — smallest solution that works, stdlib-first, no unrequested abstractions, minimal diffs. Never rewrite a whole file; edit in place.
- **Skills auto-discover** from `skills/*/SKILL.md`. Do **not** add a `"skills"` field to `plugin.json` — ponytail ships skills without one and they load. Adding it is an unrequested change.
- **Escalation-on-failure is deferred to v1 and MUST NOT be built.** The `escalation` config role is defined (so the config shape is stable) but nothing consumes it yet.
- **Skill trigger descriptions** must be general ("brainstorming or planning") with no hard dependency on any external plugin name.
- Test runner: `npm test` runs `node --test $(find tests -name '*.test.js')`; new `tests/**/*.test.js` files are auto-discovered.

---

### Task 1: Rewrite `truss.toml [model]` section to four named roles

Replaces the original Component-8 config shape (`classifier` + `thresholds`) with `coordinator` / `thinking` / `coding` / `escalation`. Verified: `classifier`/`thresholds` are referenced only in `config.js` DEFAULTS and `config.test.js` — no handler consumes them, so this is safe.

**Files:**
- Modify: `hooks/lib/config.js:7` (the `model:` line in `DEFAULTS`)
- Modify: `templates/truss.toml` (the `[model]` section)
- Test: `tests/lib/config.test.js` (defaults assertions + the type-parsing test)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `loadConfig(projectRoot).config.model` now has keys `coordinator`, `thinking`, `coding`, `escalation` (all strings). Task 3's skill documents these same keys/defaults.

- [ ] **Step 1: Update the failing tests**

In `tests/lib/config.test.js`, replace the two model-defaults assertions (currently lines 20-21):

```javascript
  assert.strictEqual(config.model.classifier, 'haiku');
  assert.deepStrictEqual(config.model.thresholds, [4, 7]);
```

with:

```javascript
  assert.strictEqual(config.model.coordinator, 'sonnet');
  assert.strictEqual(config.model.thinking, 'opus');
  assert.strictEqual(config.model.coding, 'haiku');
  assert.strictEqual(config.model.escalation, 'opus');
```

Then replace the whole `parses string, number, boolean, and array values` test (currently lines 54-68) with:

```javascript
test('parses string and number values, overriding defaults', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), [
    '[model]',
    'thinking = "sonnet"',
    '[routing]',
    'stale_threshold = 5',
  ].join('\n'));
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.model.thinking, 'sonnet');
  assert.strictEqual(config.model.coding, 'haiku'); // default preserved
  assert.strictEqual(config.routing.stale_threshold, 5);
  fs.rmSync(tmp, { recursive: true });
});
```

(Note: the old test used `model.thresholds` to exercise array parsing. No config value is an array anymore, so array coverage is intentionally dropped. Leave the array branch in `parseValue` untouched — removing it is out of scope.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/config.test.js`
Expected: FAIL — `config.model.coordinator` is `undefined` (defaults still have `classifier`/`thresholds`).

- [ ] **Step 3: Update the config defaults**

In `hooks/lib/config.js`, replace line 7:

```javascript
  model:   { classifier: 'haiku', thresholds: [4, 7] },
```

with:

```javascript
  model:   { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
```

- [ ] **Step 4: Update the shipped template**

In `templates/truss.toml`, replace the `[model]` block:

```toml
[model]
classifier  = "haiku"         # model used for difficulty scoring
thresholds  = [4, 7]          # 1-4 -> haiku, 5-7 -> sonnet, 8-10 -> opus
```

with:

```toml
[model]
coordinator = "sonnet"        # advisory: intended session model (truss can't set it)
thinking    = "opus"          # subagent for hard planning analysis
coding      = "haiku"         # baseline for mechanical execution
escalation  = "opus"          # stronger tier on failure (reserved for v1)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/lib/config.test.js`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add hooks/lib/config.js templates/truss.toml tests/lib/config.test.js
git commit -m "feat: rewrite truss.toml [model] to coordinator/thinking/coding/escalation roles"
```

---

### Task 2: Ship the research skill

A static skill that makes Claude research every external library/API/pattern a plan touches, unconditionally, and record findings in `RESEARCH.md`. Plus a lightweight frontmatter-validity test (skills fail silently if frontmatter is malformed — same silent-failure class as the earlier hook-registration issue, so a guard is justified).

**Files:**
- Create: `skills/research/SKILL.md`
- Create: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `tests/skills/skills.test.js` with an in-file `assertValidFrontmatter(skillPath)` helper; Task 3 adds a second test to the same file and reuses that helper directly.

- [ ] **Step 1: Write the failing test**

Create `tests/skills/skills.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function assertValidFrontmatter(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.startsWith('---\n'), `${skillPath} must start with a frontmatter fence`);
  const end = content.indexOf('\n---', 4);
  assert.ok(end > 0, `${skillPath} must have a closing frontmatter fence`);
  const fm = content.slice(4, end);
  assert.match(fm, /^name:\s*\S+/m, `${skillPath} frontmatter must define name`);
  assert.match(fm, /^description:\s*\S+/m, `${skillPath} frontmatter must define description`);
}

test('research skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/research/SKILL.md'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — `ENOENT`, `skills/research/SKILL.md` does not exist.

- [ ] **Step 3: Write the skill**

Create `skills/research/SKILL.md`:

```markdown
---
name: research
description: Use when brainstorming or planning with the user, before finalizing any plan or spec. Researches the external libraries, APIs, and patterns the plan relies on and records the findings, so plans rest on verified facts instead of assumptions.
---

# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

## Rule

For **every** external library, API, framework, or unfamiliar pattern the plan relies on, research it — regardless of how confident you feel. Do not ask yourself "am I unsure about this?"; that self-check is exactly what fails. If the plan touches it, research it.

## Steps

1. **Check `RESEARCH.md` first.** Skip anything with a relevant, current entry — do not re-research it.
2. **Compile the research list and confirm with the user.** List every external library, API, framework, or unfamiliar pattern the plan touches that is not already covered. Show this list to the user and ask whether they want to add anything before you begin; incorporate their additions. This is a prompt-and-continue, not an approval gate.
3. **Research each item.** Use context7 first (resolve the library, query its docs). Fall back to WebSearch / WebFetch for anything context7 does not cover.
4. **Record findings in `RESEARCH.md`.** Create the file if it does not exist. Append one entry per library/API/pattern:

   ## <library / API / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query>
   Findings: <what was verified, in plain language>
   Used in: <the spec/plan file this informed>

   Append only — never overwrite an existing entry.

Fold the verified facts into the plan as you build it.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/research/SKILL.md tests/skills/skills.test.js
git commit -m "feat: add truss:research skill (unconditional plan-time research to RESEARCH.md)"
```

---

### Task 3: Ship the model-routing skill

A static skill carrying the routing policy: thin coordinator, subagent model selection by task type, judgment-based delegation of hard planning analysis to the `thinking` model (biased toward delegating).

**Files:**
- Create: `skills/model-routing/SKILL.md`
- Modify: `tests/skills/skills.test.js` (add one assertion)

**Interfaces:**
- Consumes: the `truss.toml [model]` roles from Task 1; the `assertValidFrontmatter` helper from Task 2.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

In `tests/skills/skills.test.js`, add this test after the research-skill test:

```javascript
test('model-routing skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/model-routing/SKILL.md'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — `ENOENT`, `skills/model-routing/SKILL.md` does not exist.

- [ ] **Step 3: Write the skill**

Create `skills/model-routing/SKILL.md`:

```markdown
---
name: model-routing
description: Use when brainstorming, planning, or delegating implementation work. Routes work to the right model by task type — deep reasoning to a stronger model, mechanical coding to a cheaper one — through scoped subagents, keeping the main session cheap.
---

# Model Routing

The main session cannot change its own model, so routing works by choosing the **model of the subagents** you delegate to. The main session stays a thin coordinator; substantive work runs in scoped subagents.

## Roles

Read the model for each role from `truss.toml` `[model]` (fall back to these defaults if the file or key is absent):

- `coordinator` (default `sonnet`) — the main interactive session. Advisory only; you cannot set it. Handles dialogue and Q&A.
- `thinking` (default `opus`) — subagent for hard planning analysis.
- `coding` (default `haiku`) — subagent for mechanical implementation.
- `escalation` (default `opus`) — reserved for a future failure-triggered tier. **Not used yet.**

## Rules

**Thinking.** When brainstorming or planning and you hit a genuinely hard analytical sub-problem — evaluating approaches, stress-testing or reviewing a design, an architecture decision — delegate that reasoning to a subagent on the `thinking` model, then relay its result into the dialogue. **When in doubt, delegate** — err toward the stronger model rather than deciding unaided.

**Coding.** When implementation is delegated to a subagent, run that subagent on the `coding` model.

Never delegate the interactive dialogue itself — a subagent cannot talk to the user. Only delegate self-contained reasoning or implementation.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS (both skill tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus the two new skill tests.

- [ ] **Step 6: Commit**

```bash
git add skills/model-routing/SKILL.md tests/skills/skills.test.js
git commit -m "feat: add truss:model-routing skill (subagent model policy, judgment-based delegation)"
```

---

### Task 4: Manual verification of skill discovery (human, not a subagent)

Skill discovery cannot be asserted in `node:test` — it requires a real Claude Code session. This mirrors the plugin-hook verification from the scaffold and must be done by the developer, not an implementer subagent.

- [ ] **Step 1: Push and reinstall the plugin**

```bash
git push origin master
claude plugin uninstall truss@truss-dev --scope user
claude plugin marketplace update truss-dev
claude plugin install truss@truss-dev
```

- [ ] **Step 2: Open a fresh Claude Code session** in a project directory (a new terminal, not `/clear`).

- [ ] **Step 3: Confirm the skills are discovered.** In the session, check that `truss:research` and `truss:model-routing` appear in the available-skills list (they surface in the system reminder that lists skills, or can be invoked as `/research` / `/model-routing`).

- [ ] **Step 4: Smoke-test the research skill.** Start a brainstorming/planning task that names an external library; confirm the skill triggers, research happens, and a `RESEARCH.md` entry is written in the documented format.

- [ ] **Step 5: Smoke-test the model-routing skill.** During a planning task, confirm a hard analytical sub-problem gets delegated to a `thinking`-model subagent, and that editing `truss.toml [model].thinking` changes which model is used.

---

## Notes

- The developer's own `truss.toml` at the repo root still has the old `[model]` shape (it was generated before this change). It will not auto-update because `SessionStart` only creates the file when missing. To pick up the new default shape, delete it and let a fresh session regenerate it from the updated template — or edit the `[model]` block by hand. This is optional and not a task.
