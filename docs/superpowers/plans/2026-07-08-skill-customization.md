# Skill Customization (truss-skills/) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user override any of truss's three skills' instruction text via a project-level `truss-skills/` directory, per `docs/superpowers/specs/2026-07-08-skill-customization-design.md`.

**Architecture:** Two independent changes. (1) `hooks/session-start/teach.js` gets a deterministic file-existence check for `truss-skills/plain-speak.md`, using it instead of the shipped `skills/plain-speak/SKILL.md` when present. (2) `skills/research/SKILL.md` and `skills/big-brain/SKILL.md` each get a short instruction paragraph telling Claude to check for and defer to `truss-skills/research.md` / `truss-skills/big-brain.md` if present — the only lever available for skills that aren't hook-forced.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert`, `fs`, `path`). Markdown skill files.

## Global Constraints

- **Node stdlib only** — no npm dependencies may be added.
- **TDD** — write the failing test first, run it to confirm it fails, then implement.
- **Ponytail minimalism** — smallest diff that works; no unrequested abstractions.
- **`truss-skills/` is lazily created** — no template scaffolding by `init.js`; it only exists once the user creates a file in it.
- **Override files have no YAML frontmatter** — plain instruction text only. Skill discovery (`name`/`description`) always stays governed by the shipped file.
- **No shared templating/include mechanism** — the override-check paragraph is duplicated (with the skill name swapped) directly in `research/SKILL.md` and `big-brain/SKILL.md`.
- Test runner: `npm test` runs `node --test $(find tests -name '*.test.js')`.

---

### Task 1: Override-check paragraph for research and big-brain

**Files:**
- Modify: `skills/research/SKILL.md`
- Modify: `skills/big-brain/SKILL.md`
- Modify: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by Task 2 — fully independent.

- [ ] **Step 1: Write the failing tests**

Add these two tests to `tests/skills/skills.test.js`, after the existing `big-brain skill has valid frontmatter` test:

```javascript
test('research skill documents truss-skills/research.md override', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /truss-skills\/research\.md/, 'must document the override file path');
});

test('big-brain skill documents truss-skills/big-brain.md override', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/big-brain/SKILL.md'), 'utf8');
  assert.match(content, /truss-skills\/big-brain\.md/, 'must document the override file path');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — neither `research/SKILL.md` nor `big-brain/SKILL.md` currently mentions `truss-skills/` (7 tests, 2 fail, 5 pass).

- [ ] **Step 3: Add the paragraph to research/SKILL.md**

In `skills/research/SKILL.md`, find:

```markdown
# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

## Rule
```

Replace with:

```markdown
# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

Before following the rules below, check `truss-skills/research.md` in the project root — if it exists, follow that file's content instead of what follows here.

## Rule
```

- [ ] **Step 4: Add the paragraph to big-brain/SKILL.md**

In `skills/big-brain/SKILL.md`, find:

```markdown
# Big Brain

Some decisions are cheap to get wrong. Some aren't. When you hit one that isn't — don't reason it through yourself. Delegate it.

## When this applies
```

Replace with:

```markdown
# Big Brain

Some decisions are cheap to get wrong. Some aren't. When you hit one that isn't — don't reason it through yourself. Delegate it.

Before following the rules below, check `truss-skills/big-brain.md` in the project root — if it exists, follow that file's content instead of what follows here.

## When this applies
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS (7 tests, 7 pass).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus these two new ones.

- [ ] **Step 7: Commit**

```bash
git add skills/research/SKILL.md skills/big-brain/SKILL.md tests/skills/skills.test.js
git commit -m "feat: document truss-skills/ override in research and big-brain"
```

---

### Task 2: Deterministic override support in the plain-speak hook

**Files:**
- Modify: `hooks/session-start/teach.js`
- Modify: `tests/session-start/teach.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 — fully independent.
- Produces: `teach(input, projectRoot, pluginRoot)` now actually uses `projectRoot` (previously accepted but unused, kept only for signature parity) to check `<projectRoot>/truss-skills/plain-speak.md`.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/session-start/teach.test.js`, after the existing `strips frontmatter from additionalContext` test:

```javascript
function writeOverride(projectRoot, content) {
  const dir = path.join(projectRoot, 'truss-skills');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plain-speak.md'), content);
}

test('uses truss-skills/plain-speak.md override when present, instead of the shipped SKILL.md', () => {
  const tmp = makeTmp();
  const pluginRoot = makePluginRoot(tmp, FIXTURE);
  writeOverride(tmp, 'Custom override body.\n');

  const result = teach({}, tmp, pluginRoot);

  assert.strictEqual(result.additionalContext, 'Custom override body.');
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/session-start/teach.test.js`
Expected: FAIL — `teach()` currently always reads the shipped `SKILL.md` fixture, so `result.additionalContext` is `'Body content here.'`, not `'Custom override body.'` (3 tests, 1 fail, 2 pass).

- [ ] **Step 3: Add the override check**

Replace `hooks/session-start/teach.js` with:

```javascript
const fs = require('fs');
const path = require('path');

const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '../..');

function stripFrontmatter(content) {
  if (!content.startsWith('---\n')) return content;
  const end = content.indexOf('\n---', 4);
  if (end < 0) return content;
  return content.slice(end + 4).replace(/^\n+/, '');
}

module.exports = function teach(input, projectRoot = process.cwd(), pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const overridePath = path.join(projectRoot, 'truss-skills', 'plain-speak.md');
  if (fs.existsSync(overridePath)) {
    return { additionalContext: fs.readFileSync(overridePath, 'utf8').trim() };
  }
  const skillPath = path.join(pluginRoot, 'skills', 'plain-speak', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  return { additionalContext: stripFrontmatter(content).trim() };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/session-start/teach.test.js`
Expected: PASS (3 tests, 3 pass).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus this new one.

- [ ] **Step 6: Commit**

```bash
git add hooks/session-start/teach.js tests/session-start/teach.test.js
git commit -m "feat: support truss-skills/plain-speak.md override in the teach hook"
```

---

## Manual Verification (human, not a subagent)

Actual Claude compliance with the `research`/`big-brain` redirect paragraph can't be asserted by `node:test` — same known limitation as everything else judgment-based in truss. After both tasks are committed and merged:

- [ ] Push to `master`, then `claude plugin uninstall truss@truss-dev && claude plugin marketplace update truss-dev && claude plugin install truss@truss-dev`.
- [ ] Open a fresh session with no `truss-skills/` directory. Confirm `plain-speak` still teaches using the shipped text (unchanged baseline behavior).
- [ ] Create `truss-skills/plain-speak.md` with distinctly different instructions (e.g. a different tone). Open a fresh session, confirm the injected teaching framing reflects the override, not the shipped file.
- [ ] Create `truss-skills/research.md` with a distinct instruction (e.g. "always research using WebSearch only, never context7"). In a brainstorming/planning conversation that would normally trigger `truss:research`, confirm Claude follows the override instead of the shipped default.
- [ ] Repeat the same check for `truss-skills/big-brain.md` at a hard decision point.
