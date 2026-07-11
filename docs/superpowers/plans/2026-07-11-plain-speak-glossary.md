# Plain-Speak + Codebase Glossary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hook-enforced, always-on rule that makes Claude's output jargon-free plain language everywhere, and obligates a short plain-language definition whenever a specific codebase piece (file/function/class) comes up in discussion.

**Architecture:** Two new `dispatch.js`-discovered hook handlers (`hooks/session-start/plain-speak.js`, `hooks/user-prompt-submit/plain-speak.js`) share one constant (`hooks/lib/plain-speak-rule.js`) and both return `{ additionalContext: RULE_TEXT }` when `truss.toml`'s `[gates] plain_speak` is true, `null` otherwise. No new entries needed in `hooks/hooks.json` — `dispatch.js` already auto-discovers every `.js` file in an event's directory.

**Tech Stack:** Node.js stdlib, `node:test` — matches every other truss hook, no new dependency.

## Global Constraints

- `[gates] plain_speak = true` is the config key, same shape/location as existing `auto_compact`/`model_routing` booleans (spec: Config section).
- `RULE_TEXT` is a fixed constant for v0 — no per-project customization surface (spec: Explicitly Deferred).
- The mechanism is instruction-persistence only, never a blocking gate — there is no deterministic trigger to gate the codebase-glossary half on (spec: Mechanism).
- Exact `RULE_TEXT` string (spec: Mechanism):
  ```
  [truss] Always speak in plain, jargon-free language — in every response, not only when discussing code. When a specific codebase piece (a file, function, or class) comes up in discussion, always give a short plain-language definition of what it is and does, generated fresh from the current code — this is obligatory, not situational.
  ```

---

### Task 1: Config default for `[gates] plain_speak`

**Files:**
- Modify: `hooks/lib/config.js:5`
- Modify: `truss.toml` (this repo's own config)
- Modify: `templates/truss.toml`
- Test: `tests/lib/config.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `config.gates.plain_speak` (boolean, default `true`) — Task 2 and Task 3's handlers read this.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/config.test.js`, inside the existing `'returns defaults when truss.toml is missing'` test (after the `config.gates.auto_compact` assertion on line 22):

```javascript
  assert.strictEqual(config.gates.plain_speak, true);
```

Also add a new standalone test at the end of the file (matching the file's existing style — see `'overrides specific values while keeping defaults for the rest'`):

```javascript
test('gates.plain_speak can be overridden to false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nplain_speak = false\n');
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.gates.plain_speak, false);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lib/config.test.js`
Expected: FAIL — `config.gates.plain_speak` is `undefined`, not `true`.

- [ ] **Step 3: Write minimal implementation**

In `hooks/lib/config.js`, change line 5 from:

```javascript
  gates:    { auto_compact: true, model_routing: true },
```

to:

```javascript
  gates:    { auto_compact: true, model_routing: true, plain_speak: true },
```

In `truss.toml`, under the existing `[gates]` section, add:

```toml
plain_speak       = true      # always jargon-free output + obligatory codebase-piece definitions
```

In `templates/truss.toml`, under the existing `[gates]` section, add the same line.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/lib/config.test.js`
Expected: PASS, all cases including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add hooks/lib/config.js truss.toml templates/truss.toml tests/lib/config.test.js
git commit -m "feat: add [gates] plain_speak config, defaulting to true"
```

---

### Task 2: Shared rule-text module

**Files:**
- Create: `hooks/lib/plain-speak-rule.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `module.exports = RULE_TEXT` (a string) — Task 3 and Task 4's handlers both `require` this.

No test needed for this file alone — it's a single exported string constant with no branching logic; its correctness is verified through Task 3/4's handler tests asserting on the returned `additionalContext` content.

- [ ] **Step 1: Create the file**

```javascript
module.exports = '[truss] Always speak in plain, jargon-free language — in every response, not only when discussing code. When a specific codebase piece (a file, function, or class) comes up in discussion, always give a short plain-language definition of what it is and does, generated fresh from the current code — this is obligatory, not situational.';
```

- [ ] **Step 2: Commit**

```bash
git add hooks/lib/plain-speak-rule.js
git commit -m "feat: add shared plain-speak rule-text constant"
```

---

### Task 3: `SessionStart` handler

**Files:**
- Create: `hooks/session-start/plain-speak.js`
- Test: `tests/session-start/plain-speak.test.js`

**Interfaces:**
- Consumes: `require('../lib/config').loadConfig` (existing, returns `{ config, warning }`), `require('../lib/plain-speak-rule')` (Task 2, a string).
- Produces: `module.exports = function plainSpeak(input, projectRoot = process.cwd())` returning `{ additionalContext: string }` or `null` — matches the exact signature/return shape `dispatch.js`'s `runHandlers` already expects (see `hooks/user-prompt-submit/auto-compact.js` for the established pattern).

- [ ] **Step 1: Write the failing test**

Create `tests/session-start/plain-speak.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plainSpeak = require('../../hooks/session-start/plain-speak');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('returns additionalContext with the rule text by default', () => {
  const tmp = makeTmp();

  const result = plainSpeak({}, tmp);

  assert.ok(result.additionalContext.includes('plain, jargon-free language'));
  assert.ok(result.additionalContext.includes('obligatory, not situational'));
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when gates.plain_speak is false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nplain_speak = false\n');

  const result = plainSpeak({}, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/session-start/plain-speak.test.js`
Expected: FAIL — `Cannot find module '../../hooks/session-start/plain-speak'`.

- [ ] **Step 3: Write minimal implementation**

Create `hooks/session-start/plain-speak.js`:

```javascript
const { loadConfig } = require('../lib/config');
const RULE_TEXT = require('../lib/plain-speak-rule');

module.exports = function plainSpeak(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.gates.plain_speak) return null;
  return { additionalContext: RULE_TEXT };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/session-start/plain-speak.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/session-start/plain-speak.js tests/session-start/plain-speak.test.js
git commit -m "feat: add SessionStart plain-speak hook handler"
```

---

### Task 4: `UserPromptSubmit` handler

**Files:**
- Create: `hooks/user-prompt-submit/plain-speak.js`
- Test: `tests/user-prompt-submit/plain-speak.test.js`

**Interfaces:**
- Consumes: same as Task 3 — `loadConfig` and `plain-speak-rule`.
- Produces: same shape as Task 3, registered under a different event directory so it re-fires every turn instead of once per session.

- [ ] **Step 1: Write the failing test**

Create `tests/user-prompt-submit/plain-speak.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plainSpeak = require('../../hooks/user-prompt-submit/plain-speak');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('returns additionalContext with the rule text by default', () => {
  const tmp = makeTmp();

  const result = plainSpeak({}, tmp);

  assert.ok(result.additionalContext.includes('plain, jargon-free language'));
  assert.ok(result.additionalContext.includes('obligatory, not situational'));
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when gates.plain_speak is false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nplain_speak = false\n');

  const result = plainSpeak({}, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/user-prompt-submit/plain-speak.test.js`
Expected: FAIL — `Cannot find module '../../hooks/user-prompt-submit/plain-speak'`.

- [ ] **Step 3: Write minimal implementation**

Create `hooks/user-prompt-submit/plain-speak.js`:

```javascript
const { loadConfig } = require('../lib/config');
const RULE_TEXT = require('../lib/plain-speak-rule');

module.exports = function plainSpeak(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.gates.plain_speak) return null;
  return { additionalContext: RULE_TEXT };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/user-prompt-submit/plain-speak.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/user-prompt-submit/plain-speak.js tests/user-prompt-submit/plain-speak.test.js
git commit -m "feat: add UserPromptSubmit plain-speak hook handler"
```

---

### Task 5: Full-suite verification, push, reinstall

**Files:** none created/modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (69 existing + 6 new = 75).

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Reinstall the `truss@truss-dev` plugin so the running session picks up the new commit**

```bash
claude plugin uninstall truss@truss-dev
claude plugin install truss@truss-dev
```

(Reinstall, not `plugin update` — this repo's earlier session already found `plugin update` reports "already at the latest version" because the plugin's `version` field wasn't bumped; uninstall+install re-pulls the marketplace source directly regardless of version string.)

- [ ] **Step 4: Tell the user a session restart is needed**

Report explicitly that a Claude Code session restart (not just plugin reinstall) is required before the new hooks actually take effect — matches the same caveat already surfaced earlier this session for the `truss@local`/`truss@truss-dev` switch.

---

## Notes for the implementer

- `dispatch.js` needs zero changes — it already discovers every `.js` file in `hooks/session-start/` and `hooks/user-prompt-submit/` by directory listing (see `hooks/dispatch.js:10-14`), sorted, each returning `null` or `{ additionalContext }`/`{ block }`. Multiple handlers' `additionalContext` values get joined with `\n\n` automatically (`hooks/dispatch.js:27,30`) — no conflict with `init.js` (session-start) or `auto-compact.js` (user-prompt-submit) already living in those directories.
- Do not add a new `hooks.json` entry — `SessionStart` and `UserPromptSubmit` event routing to `dispatch.js` already exists (`hooks/hooks.json:3-26`).
