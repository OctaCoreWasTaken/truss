# Truss Reset Command + Plain-Speak/STATE.md/GLOSSARY.md Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the plain-speak skill, STATE.md, and GLOSSARY.md from truss (plain-speak is being replaced by caveman as the sole phrasing/depth rule; STATE.md and GLOSSARY.md lose their rationale/producer once it's gone), and add a `truss:reset` skill that returns a project's truss state to a fresh first-session default while preserving `EVENTS.log`.

**Architecture:** Three straight removal tasks (delete files, strip references from config/tests/docs) followed by one additive task that introduces `scripts/reset.js` (deterministic file operations, same pattern as `scripts/dev-install.js`/`dev-uninstall.js`) and a thin `skills/reset/SKILL.md` wrapper that just shells out to it.

**Tech Stack:** Node.js (CommonJS, `node:test` + `node:assert`, no external deps), Claude Code plugin skill/hook conventions.

## Global Constraints

- Node >= 18, CommonJS (`require`/`module.exports`), no new dependencies.
- Tests use `node:test` + `node:assert`, run via `npm test` (`node --test $(find tests -name '*.test.js')`).
- Test fixtures use `fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'))` and always `fs.rmSync(tmp, { recursive: true })` at the end of each test (existing convention in every test file touched here).
- `docs/superpowers/plans/*`, `docs/superpowers/specs/*`, `.superpowers/sdd/*`, `proposal.md` are out of scope — do not edit them even though some reference plain-speak/STATE.md by name (spec section "Scope", Out of scope note).
- `EVENTS.log` must never be deleted or modified by anything in this plan.

---

### Task 1: Remove plain-speak

**Files:**
- Delete: `skills/plain-speak/SKILL.md` (and the now-empty `skills/plain-speak/` directory)
- Delete: `hooks/session-start/teach.js`
- Delete: `tests/session-start/teach.test.js`
- Modify: `hooks/lib/config.js:5`
- Modify: `truss.toml:7`
- Modify: `templates/truss.toml:7`
- Modify: `tests/lib/config.test.js:35-40`
- Modify: `tests/skills/skills.test.js:66-74`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `DEFAULTS.gates` in `hooks/lib/config.js` no longer has a `plain_speak` key — Task 4 does not touch config, no downstream dependency.

- [ ] **Step 1: Delete the plain-speak skill directory and its hook**

```bash
rm -rf skills/plain-speak
rm hooks/session-start/teach.js
rm tests/session-start/teach.test.js
```

- [ ] **Step 2: Remove `plain_speak` from config defaults**

In `hooks/lib/config.js`, line 5 currently reads:

```js
  gates:    { failure_ledger: true, auto_compact: true, plain_speak: true, model_routing: true },
```

Change to:

```js
  gates:    { failure_ledger: true, auto_compact: true, model_routing: true },
```

- [ ] **Step 3: Remove the `plain_speak` line from both truss.toml files**

In `truss.toml`, delete this line (currently line 7):

```
plain_speak       = false     # removed from CLAUDE.md (2026-07-11) — caveman is now the sole phrasing/depth rule
```

In `templates/truss.toml`, delete this line (currently line 7):

```
plain_speak       = true      # inject plain-speak teaching mode at session start
```

- [ ] **Step 4: Remove the plain-speak test from `tests/lib/config.test.js`**

Delete this test (lines 35-40):

```js
test('gates.plain_speak defaults to true', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.gates.plain_speak, true);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 5: Remove the plain-speak tests from `tests/skills/skills.test.js`**

Delete these two tests (lines 66-74):

```js
test('plain-speak skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/plain-speak/SKILL.md'));
});

test('plain-speak skill documents session-wide teaching mode', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/plain-speak/SKILL.md'), 'utf8');
  assert.match(content, /GLOSSARY\.md/, 'must document glossary tracking');
  assert.match(content, /whole session/, 'must document session-wide scope');
});
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, none reference `plain_speak` or `skills/plain-speak`.

- [ ] **Step 7: Commit**

```bash
git add -A skills/plain-speak hooks/session-start/teach.js tests/session-start/teach.test.js hooks/lib/config.js truss.toml templates/truss.toml tests/lib/config.test.js tests/skills/skills.test.js
git commit -m "$(cat <<'EOF'
feat: remove plain-speak skill

Caveman is now the sole phrasing/depth rule; plain-speak's hard-gate
teaching injection conflicted with it rather than layering as designed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Remove STATE.md

**Files:**
- Delete: `STATE.md`
- Delete: `templates/STATE.md`
- Modify: `hooks/session-start/init.js:7`
- Modify: `tests/session-start/init.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `init.js`'s `TEMPLATES` array no longer includes `'STATE.md'` — no downstream task depends on this.

- [ ] **Step 1: Delete STATE.md and its template**

```bash
rm STATE.md
rm templates/STATE.md
```

- [ ] **Step 2: Remove STATE.md from the TEMPLATES array**

In `hooks/session-start/init.js`, line 7 currently reads:

```js
const TEMPLATES = ['truss.toml', 'STATE.md', 'CONVENTIONS.md'];
```

Change to:

```js
const TEMPLATES = ['truss.toml', 'CONVENTIONS.md'];
```

- [ ] **Step 3: Update `tests/session-start/init.test.js`**

In the `makePluginRoot` helper, remove the STATE.md template fixture. Current:

```js
function makePluginRoot(tmp) {
  const pluginRoot = path.join(tmp, 'plugin');
  const templatesDir = path.join(pluginRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(path.join(templatesDir, 'truss.toml'), '[log]\nevents = true\n');
  fs.writeFileSync(path.join(templatesDir, 'STATE.md'), '# State\n');
  fs.writeFileSync(path.join(templatesDir, 'CONVENTIONS.md'), '# Conventions\n');
  return pluginRoot;
}
```

Change to:

```js
function makePluginRoot(tmp) {
  const pluginRoot = path.join(tmp, 'plugin');
  const templatesDir = path.join(pluginRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(path.join(templatesDir, 'truss.toml'), '[log]\nevents = true\n');
  fs.writeFileSync(path.join(templatesDir, 'CONVENTIONS.md'), '# Conventions\n');
  return pluginRoot;
}
```

Delete these two tests entirely (they test STATE.md-specific behavior):

```js
test('creates STATE.md from template when missing', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  init({}, project, pluginRoot);

  assert.ok(fs.existsSync(path.join(project, 'STATE.md')));
  assert.strictEqual(fs.readFileSync(path.join(project, 'STATE.md'), 'utf8'), '# State\n');
  fs.rmSync(tmp, { recursive: true });
});
```

```js
test('does not overwrite existing STATE.md', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);
  fs.writeFileSync(path.join(project, 'STATE.md'), '# My existing state\n');

  init({}, project, pluginRoot);

  assert.strictEqual(
    fs.readFileSync(path.join(project, 'STATE.md'), 'utf8'),
    '# My existing state\n'
  );
  fs.rmSync(tmp, { recursive: true });
});
```

The remaining test `'does not overwrite existing STATE.md'` pattern is fully covered for CONVENTIONS.md/truss.toml by the other existing tests in this file already — no replacement test needed (this is a removal, not a like-for-like swap).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, none reference `STATE.md`.

- [ ] **Step 5: Commit**

```bash
git add -A STATE.md templates/STATE.md hooks/session-start/init.js tests/session-start/init.test.js
git commit -m "$(cat <<'EOF'
feat: remove STATE.md

Its rationale (manual companion to plain-speak's design-doc tracking)
goes away with plain-speak; docs/superpowers/ already tracks design
history without a hand-maintained duplicate.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Remove GLOSSARY.md and update CLAUDE.md

**Files:**
- Delete: `GLOSSARY.md`
- Modify: `CLAUDE.md:12,16,29`

**Interfaces:**
- Consumes: nothing from other tasks (independent of Tasks 1-2, but sequenced after them so CLAUDE.md's edits reflect the final skill/file count in one pass).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Delete GLOSSARY.md**

```bash
rm GLOSSARY.md
```

- [ ] **Step 2: Update CLAUDE.md's "Truss" section**

Line 12 currently reads:

```
We build truss using truss. Three shipped skills, all overridable via `truss-skills/<name>.md` (see below):
```

Change to:

```
We build truss using truss. Two shipped skills, all overridable via `truss-skills/<name>.md` (see below):
```

Line 16 currently reads:

```
- Truss files are the control surface: `STATE.md` (where we are), `RESEARCH.md` (what's known), `CONVENTIONS.md`, `GLOSSARY.md` (taught vocabulary), `DECISIONS.log` (big-brain delegations + subagent report decisions, auditable), `EVENTS.log` (auto tool log), `truss.toml` (config). Read/update them, don't invent parallel scratch files.
```

Change to:

```
- Truss files are the control surface: `RESEARCH.md` (what's known), `CONVENTIONS.md`, `DECISIONS.log` (big-brain delegations + subagent report decisions, auditable), `EVENTS.log` (auto tool log), `truss.toml` (config). Read/update them, don't invent parallel scratch files.
```

- [ ] **Step 3: Update the claude-mem section's file list**

Line 29 currently reads:

```
Captures every Read/Edit/Bash as a compressed observation and auto-injects relevant ones into future sessions (starts on session 2, nothing to invoke). Complementary to truss's control-surface files, not a replacement — claude-mem is opaque/automatic recall; `STATE.md`/`CONVENTIONS.md`/`RESEARCH.md`/`GLOSSARY.md` stay the deliberate, git-committed, human-readable record.
```

Change to:

```
Captures every Read/Edit/Bash as a compressed observation and auto-injects relevant ones into future sessions (starts on session 2, nothing to invoke). Complementary to truss's control-surface files, not a replacement — claude-mem is opaque/automatic recall; `CONVENTIONS.md`/`RESEARCH.md` stay the deliberate, git-committed, human-readable record.
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (no test file references `GLOSSARY.md`, this is a documentation-only change).

- [ ] **Step 5: Commit**

```bash
git add -A GLOSSARY.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: remove GLOSSARY.md, update CLAUDE.md control-surface list

GLOSSARY.md's sole producer was plain-speak's vocabulary-tracking
instruction; nothing writes to or reads it once that skill is gone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build the `truss:reset` command

**Files:**
- Create: `scripts/reset.js`
- Create: `skills/reset/SKILL.md`
- Test: `tests/scripts/reset.test.js`
- Modify: `tests/skills/skills.test.js` (add frontmatter check for the new skill, consistent with the existing per-skill pattern)

**Interfaces:**
- Consumes: `templates/truss.toml`, `templates/CONVENTIONS.md` (already exist, unaffected by Tasks 1-3 — Task 1/2 only removed the `plain_speak` line and `STATE.md` entry from these files/arrays, the files themselves remain).
- Produces: `reset({ projectRoot, pluginRoot } = {})` exported from `scripts/reset.js` — a project-root-relative deterministic file operation, callable directly in tests or via CLI (`node scripts/reset.js`).

- [ ] **Step 1: Write the failing test**

Create `tests/scripts/reset.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { reset } = require('../../scripts/reset');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function makeFixtures(tmp) {
  const pluginRoot = path.join(tmp, 'plugin');
  const templatesDir = path.join(pluginRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(path.join(templatesDir, 'truss.toml'), '[gates]\nauto_compact = true\n');
  fs.writeFileSync(path.join(templatesDir, 'CONVENTIONS.md'), '# Conventions\n\nDefault template.\n');

  const projectRoot = path.join(tmp, 'project');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'RESEARCH.md'), '## Some finding\n');
  fs.writeFileSync(path.join(projectRoot, 'DECISIONS.log'), '2026-01-01 | big-brain | x | verdict: y\n');
  fs.writeFileSync(path.join(projectRoot, 'truss.toml'), '[gates]\nauto_compact = false\n');
  fs.writeFileSync(path.join(projectRoot, 'CONVENTIONS.md'), '# Conventions\n\nCustom project rule.\n');
  fs.writeFileSync(path.join(projectRoot, 'EVENTS.log'), '{"event":"ToolUse"}\n');

  return { pluginRoot, projectRoot };
}

test('deletes RESEARCH.md and DECISIONS.log', () => {
  const tmp = makeTmp();
  const { pluginRoot, projectRoot } = makeFixtures(tmp);

  reset({ projectRoot, pluginRoot });

  assert.strictEqual(fs.existsSync(path.join(projectRoot, 'RESEARCH.md')), false);
  assert.strictEqual(fs.existsSync(path.join(projectRoot, 'DECISIONS.log')), false);
  fs.rmSync(tmp, { recursive: true });
});

test('overwrites truss.toml and CONVENTIONS.md with template defaults', () => {
  const tmp = makeTmp();
  const { pluginRoot, projectRoot } = makeFixtures(tmp);

  reset({ projectRoot, pluginRoot });

  assert.strictEqual(
    fs.readFileSync(path.join(projectRoot, 'truss.toml'), 'utf8'),
    fs.readFileSync(path.join(pluginRoot, 'templates', 'truss.toml'), 'utf8')
  );
  assert.strictEqual(
    fs.readFileSync(path.join(projectRoot, 'CONVENTIONS.md'), 'utf8'),
    fs.readFileSync(path.join(pluginRoot, 'templates', 'CONVENTIONS.md'), 'utf8')
  );
  fs.rmSync(tmp, { recursive: true });
});

test('leaves EVENTS.log untouched', () => {
  const tmp = makeTmp();
  const { pluginRoot, projectRoot } = makeFixtures(tmp);
  const before = fs.readFileSync(path.join(projectRoot, 'EVENTS.log'), 'utf8');

  reset({ projectRoot, pluginRoot });

  assert.strictEqual(fs.readFileSync(path.join(projectRoot, 'EVENTS.log'), 'utf8'), before);
  fs.rmSync(tmp, { recursive: true });
});

test('does not error when RESEARCH.md and DECISIONS.log are already absent', () => {
  const tmp = makeTmp();
  const { pluginRoot, projectRoot } = makeFixtures(tmp);
  fs.rmSync(path.join(projectRoot, 'RESEARCH.md'));
  fs.rmSync(path.join(projectRoot, 'DECISIONS.log'));

  assert.doesNotThrow(() => reset({ projectRoot, pluginRoot }));
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/scripts/reset.test.js`
Expected: FAIL with `Cannot find module '../../scripts/reset'`

- [ ] **Step 3: Write `scripts/reset.js`**

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '..');

const LAZY_FILES = ['RESEARCH.md', 'DECISIONS.log'];
const TEMPLATE_FILES = ['truss.toml', 'CONVENTIONS.md'];

function reset({
  projectRoot = process.cwd(),
  pluginRoot = DEFAULT_PLUGIN_ROOT,
} = {}) {
  for (const filename of LAZY_FILES) {
    const target = path.join(projectRoot, filename);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log(`Deleted: ${filename}`);
    }
  }

  for (const filename of TEMPLATE_FILES) {
    const src = path.join(pluginRoot, 'templates', filename);
    const dest = path.join(projectRoot, filename);
    fs.copyFileSync(src, dest);
    console.log(`Reset: ${filename}`);
  }

  console.log('\nDone. EVENTS.log left untouched.');
}

if (require.main === module) reset();
module.exports = { reset };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/scripts/reset.test.js`
Expected: PASS (4/4)

- [ ] **Step 5: Write `skills/reset/SKILL.md`**

```markdown
---
name: reset
description: Use when the user asks to reset, wipe, or start truss over in this project — returns truss's own state to a fresh first-session default while preserving EVENTS.log.
---

# Reset

Wipes truss's own state back to defaults, as if this were a brand new project. `EVENTS.log` (the audit trail) is the one thing this never touches — everything else truss owns gets deleted or reset to template defaults.

Before following the rules below, check `truss-skills/reset.md` in the project root — if it exists, follow that file's content instead of what follows here.

## What to do

Run the reset script, then report what it printed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/reset.js"
```

The script, not this skill, is the source of truth for exactly what gets touched — see `scripts/reset.js`. It:
- Deletes `RESEARCH.md` and `DECISIONS.log` (both lazily recreated by `truss:research` / `truss:big-brain` the next time they're needed)
- Overwrites `truss.toml` and `CONVENTIONS.md` with their template defaults
- Leaves `EVENTS.log` untouched

Do not perform any of these file operations by hand — always go through the script, so the result is deterministic rather than instruction-followed.
```

- [ ] **Step 6: Add a frontmatter test for the new skill**

In `tests/skills/skills.test.js`, add after the existing big-brain tests (after line 64, before the plain-speak tests were — those are now already removed by Task 1):

```js
test('reset skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/reset/SKILL.md'));
});

test('reset skill documents truss-skills/reset.md override', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/reset/SKILL.md'), 'utf8');
  assert.match(content, /truss-skills\/reset\.md/, 'must document the override file path');
});
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, including the 4 new `reset.test.js` tests and the 2 new `skills.test.js` tests.

- [ ] **Step 8: Commit**

```bash
git add scripts/reset.js skills/reset/SKILL.md tests/scripts/reset.test.js tests/skills/skills.test.js
git commit -m "$(cat <<'EOF'
feat: add truss:reset command

Deterministic script (scripts/reset.js) does the file work; the skill
is a thin wrapper so /truss:reset and the Skill tool both invoke the
same behavior. Deletes RESEARCH.md/DECISIONS.log, resets truss.toml/
CONVENTIONS.md to template defaults, leaves EVENTS.log untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Section 1 (plain-speak) → Task 1. Section 2 (STATE.md) → Task 2. Section 3 (GLOSSARY.md) → Task 3 (bundled with the CLAUDE.md edits the spec assigns to sections 1-3). Section 4 (`truss:reset`) + Testing section → Task 4. Error-handling section ("every target file is optional") → `reset.js`'s `fs.existsSync` guards on `LAZY_FILES` (Step 3) and the corresponding test (Step 1's fourth test). All spec sections covered.
- **Placeholder scan:** none found — every step has literal file content or exact commands.
- **Type consistency:** `reset({ projectRoot, pluginRoot } = {})` signature is identical between the test file (Task 4 Step 1) and the implementation (Task 4 Step 3).
