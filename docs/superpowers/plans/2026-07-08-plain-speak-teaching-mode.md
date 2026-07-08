# Plain-Speak Teaching Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `truss:plain-speak` from a brainstorm/plan-scoped, judgment-invoked style into a session-wide, hook-forced teaching mode with a persistent glossary, per `docs/superpowers/specs/2026-07-08-plain-speak-teaching-mode-design.md`.

**Architecture:** Two independent changes. (1) Rewrite `skills/plain-speak/SKILL.md`'s body in place — same frontmatter, wider rules (whole-session scope, mechanism/flow depth rule, `GLOSSARY.md` tracking). (2) A new `SessionStart` handler, `hooks/session-start/teach.js`, reads that skill file at every session start and force-injects its body as `additionalContext`, the same mechanism `ponytail`/`caveman` use — removing reliance on Claude's own judgment to invoke the skill.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert`, `fs`, `path`). Markdown skill file.

## Global Constraints

- **Node stdlib only** — no npm dependencies may be added.
- **TDD** — write the failing test first, run it to confirm it fails, then implement.
- **Ponytail minimalism** — smallest diff that works; no unrequested abstractions.
- **Skills auto-discover** from `skills/*/SKILL.md` — do **not** touch `plugin.json`.
- **`GLOSSARY.md` is lazily created** — no template file in `templates/`, same as `RESEARCH.md`. Created by the skill itself the first time it teaches a term, not by any hook.
- **No changes to `dispatch.js` or `hooks/session-start/init.js`** — `dispatch.js` already merges every `session-start/` handler's `additionalContext` with `\n\n`, so the new handler is additive.
- Test runner: `npm test` runs `node --test $(find tests -name '*.test.js')`.

---

### Task 1: Rewrite the plain-speak skill for session-wide teaching mode

**Files:**
- Modify: `skills/plain-speak/SKILL.md` (body only — frontmatter unchanged)
- Modify: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: nothing (static content).
- Produces: `skills/plain-speak/SKILL.md`'s body, in the shape `hooks/session-start/teach.js` (Task 2) reads and injects — frontmatter fences (`---\n...\n---`) followed by the body content.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/skills/skills.test.js`, after the existing `plain-speak skill has valid frontmatter` test:

```javascript
test('plain-speak skill documents session-wide teaching mode', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/plain-speak/SKILL.md'), 'utf8');
  assert.match(content, /GLOSSARY\.md/, 'must document glossary tracking');
  assert.match(content, /whole session/, 'must document session-wide scope');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — the current `SKILL.md` body doesn't mention `GLOSSARY.md` or "whole session" (5 tests, 1 fail, 4 pass).

- [ ] **Step 3: Rewrite the skill**

Replace `skills/plain-speak/SKILL.md` with:

```markdown
---
name: plain-speak
description: Use when explaining domain-specific or technical concepts during brainstorming or planning to someone who may not have specialized background in that field. Keeps explanations jargon-free, short, and information-dense instead of long technical paragraphs.
---

# Plain-Speak

You are the user's ongoing bridge to this codebase — not just a jargon translator, a teacher. Whenever you explain any part of the codebase, at any point in the session (not only brainstorming or planning), explain it so someone without specialized background can follow, at a level deep enough to actually work from.

## Depth

Explain mechanism, flow, and the reasoning behind a design — not a one-line purpose summary, and not a literal statement-by-statement walkthrough. Plain language and depth are independent: you can describe how something works accurately without using jargon.

- Too shallow: "dispatch.js routes hook events to handler files."
- Target: "dispatch.js turns an event name into a directory, runs every handler file in it in order, and feeds each the same input. A handler can block (stops the chain, its message wins) or add context (collected from every handler that ran). A broken handler's error is swallowed so it can't take down the rest. This means adding a new gate is just dropping a file in a directory — dispatch.js itself never changes."
- Too literal: narrating `eventToDir`'s regex logic character by character.

Aim for the middle example's level of detail: enough that the reader could predict the effect of a change or find where a bug must live, without reading the file line by line.

## Rule

- Define or expand a technical term in plain language the first time it appears, rather than assuming familiarity.
- State the plain-language explanation **alongside** the technical term, not instead of it — this builds real vocabulary instead of just hiding the term.
- Use an analogy only when it builds real intuition, not as decoration.
- **Keep explanations short and information-dense.** A human explaining a complex system to a colleague says the essential thing in a few sentences, not a sprawling paragraph — a wall of text is exactly how a reader gets lost in a complex system, which defeats this skill's own purpose. Add length only when the specific complexity actually demands it, never as a default.
- This is **not** the same as `Caveman`'s compression style — no fragmented sentences, no dropped grammar. Normal, well-formed sentences; just fewer of them.

## Vocabulary tracking (GLOSSARY.md)

Before introducing a term, check `GLOSSARY.md` in the project root if it exists — skip terms already logged there rather than re-explaining them. Each response introduces only a small number of new terms, not a dump.

When you introduce a term for the first time, append it to `GLOSSARY.md` (create the file if it doesn't exist yet — same lazy-creation pattern as `RESEARCH.md`) in this format:

```markdown
## <term>
Plain-language explanation. First introduced YYYY-MM-DD.
```

## Scope

This governs what you **say** and `GLOSSARY.md` maintenance. It does not apply to `RESEARCH.md`'s content — research findings stay precise and technical there, since it's a reference for later sessions too, where precision matters more than accessibility.

## Persistence

This is a style, not a one-time action — unlike `truss:research` or `truss:big-brain`, which are single steps you take and finish. It applies for the whole session, not only during brainstorming or planning, and is force-loaded at session start rather than something you need to decide to invoke.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS (5 tests, 5 pass).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus this new one.

- [ ] **Step 6: Commit**

```bash
git add skills/plain-speak/SKILL.md tests/skills/skills.test.js
git commit -m "feat: widen plain-speak to session-wide teaching mode"
```

---

### Task 2: Force-load plain-speak via a SessionStart hook

**Files:**
- Create: `hooks/session-start/teach.js`
- Create: `tests/session-start/teach.test.js`

**Interfaces:**
- Consumes: `skills/plain-speak/SKILL.md` (from Task 1) — reads it as `<pluginRoot>/skills/plain-speak/SKILL.md`, expects a leading `---\n...\n---` frontmatter fence followed by body content.
- Produces: `module.exports = function teach(input, projectRoot = process.cwd(), pluginRoot = DEFAULT_PLUGIN_ROOT)`, returning `{ additionalContext: string }`. Called by `dispatch.js`'s `runHandlers` alongside `hooks/session-start/init.js` — no changes needed there, since `dispatch.js` already merges every handler's `additionalContext` with `\n\n`.

- [ ] **Step 1: Write the failing test**

Create `tests/session-start/teach.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const teach = require('../../hooks/session-start/teach');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function makePluginRoot(tmp, skillBody) {
  const pluginRoot = path.join(tmp, 'plugin');
  const skillDir = path.join(pluginRoot, 'skills', 'plain-speak');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillBody);
  return pluginRoot;
}

const FIXTURE = '---\nname: plain-speak\ndescription: test\n---\n\n# Plain-Speak\n\nBody content here.\n';

test('returns skill body as additionalContext', () => {
  const tmp = makeTmp();
  const pluginRoot = makePluginRoot(tmp, FIXTURE);

  const result = teach({}, tmp, pluginRoot);

  assert.ok(result.additionalContext.includes('Body content here.'));
  fs.rmSync(tmp, { recursive: true });
});

test('strips frontmatter from additionalContext', () => {
  const tmp = makeTmp();
  const pluginRoot = makePluginRoot(tmp, FIXTURE);

  const result = teach({}, tmp, pluginRoot);

  assert.ok(!result.additionalContext.startsWith('---'));
  assert.ok(!result.additionalContext.includes('name: plain-speak'));
  assert.ok(!result.additionalContext.includes('description:'));
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/session-start/teach.test.js`
Expected: FAIL — `Cannot find module '../../hooks/session-start/teach'`.

- [ ] **Step 3: Write the handler**

Create `hooks/session-start/teach.js`:

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
  const skillPath = path.join(pluginRoot, 'skills', 'plain-speak', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  return { additionalContext: stripFrontmatter(content).trim() };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/session-start/teach.test.js`
Expected: PASS (2 tests, 2 pass).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus these new ones.

- [ ] **Step 6: Commit**

```bash
git add hooks/session-start/teach.js tests/session-start/teach.test.js
git commit -m "feat: force-load plain-speak every session via SessionStart hook"
```

---

## Manual Verification (human, not a subagent)

Hook registration and actual explanation behavior can't be asserted by `node:test` — same limitation as every other truss skill/hook. After both tasks are committed and merged to `master`:

- [ ] Push to `master`.
- [ ] `claude plugin uninstall truss@truss-dev`
- [ ] `claude plugin marketplace update truss-dev`
- [ ] `claude plugin install truss@truss-dev`
- [ ] Open a brand-new `claude` session (hooks load at session start; an existing session won't pick up the change).
- [ ] Confirm the teaching framing is present without asking — e.g. run `/hooks` or ask a codebase question directly and check the response explains mechanism/flow, not just a one-line summary.
- [ ] Ask a question about a real part of the codebase you haven't discussed yet. Confirm `GLOSSARY.md` gets created (if it didn't exist) and a new entry appended in the `## <term>` / "First introduced YYYY-MM-DD" format.
- [ ] Ask a follow-up question that would naturally reuse a term already logged in `GLOSSARY.md`. Confirm it is **not** re-explained from scratch.
