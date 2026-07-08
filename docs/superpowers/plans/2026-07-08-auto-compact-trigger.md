# Auto-Compact Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `UserPromptSubmit` hook that hard-blocks prompt submission once real context usage crosses a configurable threshold, per `docs/superpowers/specs/2026-07-08-auto-compact-trigger-design.md`.

**Architecture:** Two tasks. (1) Fix `hooks/dispatch.js`'s block-emission bug — its CLI wrapper currently writes JSON to stdout then exits with code 2, which Claude Code's hook contract discards (exit 2 reads stderr only, ignores stdout JSON). This feature is the first real consumer of the block path, so the fix ships first. (2) A new `hooks/user-prompt-submit/auto-compact.js` reads the session transcript, sums the most recent assistant turn's real `message.usage` token counts, and blocks the prompt via the now-fixed path if usage crosses `context_max * threshold` from `truss.toml`.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert`, `fs`, `path`, `child_process`). TOML config via the existing hand-rolled parser in `hooks/lib/config.js`.

## Global Constraints

- **Node stdlib only** — no npm dependencies may be added.
- **TDD** — write the failing test first, run it to confirm it fails, then implement.
- **Ponytail minimalism** — smallest diff that works; no unrequested abstractions.
- **No matcher** on the new `UserPromptSubmit` hooks.json entry — match-all, same as the existing `PreToolUse`/`PostToolUse` entries (per the dev-loop memory: a bare `*` matcher is silently dropped in this Claude Code version; omitting the field entirely is the correct match-all pattern).
- **`hooks/lib/config.js`'s parser already handles numeric values** — no parser changes needed for the new `[context]` section, only new `DEFAULTS` entries.
- Test runner: `npm test` runs `node --test $(find tests -name '*.test.js')`.

---

### Task 1: Fix dispatch.js's block-emission bug

**Files:**
- Modify: `hooks/dispatch.js`
- Modify: `tests/dispatch.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: a new exported pure function `formatOutput(result)` returning `{ stdout: string, exitCode: number }`, used by both the CLI wrapper and Task 2's tests (Task 2 does not call `formatOutput` directly, but the corrected CLI contract — exit 0 always, JSON on stdout for both block and additionalContext — is what Task 2's hook relies on when it eventually runs through the real CLI in production).

- [ ] **Step 1: Write the failing test**

Add these tests to `tests/dispatch.test.js`, after the existing `passes input payload to each handler` test (and update the top `require` line to also import `formatOutput`):

```javascript
const { runHandlers, eventToDir, formatOutput } = require('../hooks/dispatch');
```

```javascript
test('formatOutput returns exit 0 with block JSON on stdout', () => {
  const result = formatOutput({ block: true, message: 'blocked reason' });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.stdout, JSON.stringify({ decision: 'block', reason: 'blocked reason' }) + '\n');
});

test('formatOutput returns exit 0 with additionalContext JSON on stdout', () => {
  const result = formatOutput({ additionalContext: 'some context' });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.stdout, JSON.stringify({ additionalContext: 'some context' }) + '\n');
});

test('formatOutput returns exit 0 with empty stdout for null result', () => {
  const result = formatOutput(null);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.stdout, '');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/dispatch.test.js`
Expected: FAIL — `formatOutput is not a function` (`../hooks/dispatch` does not export it yet).

- [ ] **Step 3: Extract and fix the CLI output logic**

In `hooks/dispatch.js`, replace the `if (require.main === module)` block and the final `module.exports` line:

```javascript
if (require.main === module) {
  const event = process.argv[2];
  const raw = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(raw || '{}');
  const result = runHandlers(event, input);

  if (result && result.block) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: result.message }) + '\n');
    process.exit(2);
  }
  if (result && result.additionalContext) {
    process.stdout.write(JSON.stringify({ additionalContext: result.additionalContext }) + '\n');
  }
  process.exit(0);
}

module.exports = { runHandlers, eventToDir };
```

with:

```javascript
function formatOutput(result) {
  if (result && result.block) {
    return { stdout: JSON.stringify({ decision: 'block', reason: result.message }) + '\n', exitCode: 0 };
  }
  if (result && result.additionalContext) {
    return { stdout: JSON.stringify({ additionalContext: result.additionalContext }) + '\n', exitCode: 0 };
  }
  return { stdout: '', exitCode: 0 };
}

if (require.main === module) {
  const event = process.argv[2];
  const raw = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(raw || '{}');
  const result = runHandlers(event, input);
  const { stdout, exitCode } = formatOutput(result);
  if (stdout) process.stdout.write(stdout);
  process.exit(exitCode);
}

module.exports = { runHandlers, eventToDir, formatOutput };
```

Note: exit code is now always 0. Claude Code's hook contract treats exit-0-with-`decision:block`-JSON as a complete, valid block signal on its own — the old exit(2) path was never required for blocking to work, and mixing it with stdout JSON was exactly what caused the bug (exit 2 makes Claude Code ignore stdout and read stderr instead, which was never written to).

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/dispatch.test.js`
Expected: PASS (12 tests, 12 pass — 9 existing + 3 new).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus these three new ones.

- [ ] **Step 6: Commit**

```bash
git add hooks/dispatch.js tests/dispatch.test.js
git commit -m "fix: dispatch.js block path discarded its own reason on exit 2"
```

---

### Task 2: The auto-compact-trigger hook

**Files:**
- Create: `hooks/user-prompt-submit/auto-compact.js`
- Create: `tests/user-prompt-submit/auto-compact.test.js`
- Modify: `hooks/hooks.json`
- Modify: `hooks/lib/config.js`
- Modify: `tests/lib/config.test.js`
- Modify: `templates/truss.toml`
- Modify: `truss.toml` (this project's own config — not the template)

**Interfaces:**
- Consumes: `loadConfig(projectRoot)` from `hooks/lib/config.js` (existing signature, unchanged) — reads `config.gates.auto_compact`, `config.context.context_max`, `config.context.threshold`.
- Produces: `module.exports = function autoCompact(input, projectRoot = process.cwd())`, returning `null | { block: true, message: string }`. Called by `dispatch.js`'s `runHandlers` as `handler(input)` (single-argument call, matching every existing handler) — `projectRoot` defaults to `process.cwd()` for production use and is overridden in tests, following the exact pattern already used by `hooks/session-start/init.js` and `teach.js`.

- [ ] **Step 1: Add config defaults**

In `hooks/lib/config.js`, update `DEFAULTS`:

```javascript
const DEFAULTS = {
  gates:   { read_before_write: true, failure_ledger: true, spec_gate: true, auto_compact: true },
  routing: { stale_threshold: 10 },
  model:   { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
  log:     { events: true },
  context: { context_max: 200000, threshold: 0.6 },
};
```

- [ ] **Step 2: Write the failing config test**

Add to `tests/lib/config.test.js`, after the existing `returns defaults when truss.toml is missing` test's assertions (inside that same test, add these two lines before `fs.rmSync`):

```javascript
  assert.strictEqual(config.gates.auto_compact, true);
  assert.strictEqual(config.context.context_max, 200000);
  assert.strictEqual(config.context.threshold, 0.6);
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/lib/config.test.js`
Expected: FAIL — `config.gates.auto_compact` and `config.context` are `undefined`.

- [ ] **Step 4: Run the test to verify it passes**

(Step 1 already implements this — just re-run.)

Run: `node --test tests/lib/config.test.js`
Expected: PASS (5 tests, 5 pass).

- [ ] **Step 5: Write the failing tests for the hook itself**

Create `tests/user-prompt-submit/auto-compact.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const autoCompact = require('../../hooks/user-prompt-submit/auto-compact');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function writeTranscript(projectRoot, lines) {
  const transcriptPath = path.join(projectRoot, 'transcript.jsonl');
  fs.writeFileSync(transcriptPath, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return transcriptPath;
}

function assistantLine(usage) {
  return { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }], usage } };
}

test('returns null when usage is under threshold', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('blocks when usage is at or over threshold', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 100000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 0 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result.block, true);
  assert.match(result.message, /compact/i);
  fs.rmSync(tmp, { recursive: true });
});

test('sums input_tokens, cache_read_input_tokens, and cache_creation_input_tokens', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 40000, cache_read_input_tokens: 40000, cache_creation_input_tokens: 40000 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  // 40000 * 3 = 120000 = exactly 200000 * 0.6 -> at threshold, should block
  assert.strictEqual(result.block, true);
  fs.rmSync(tmp, { recursive: true });
});

test('uses the most recent assistant usage line, not an earlier one', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 190000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }), // would block alone
    { type: 'user', message: { content: [{ type: 'text', text: 'ok' }] } },
    assistantLine({ input_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }), // most recent — should NOT block
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when no assistant line with usage exists yet', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    { type: 'user', message: { content: [{ type: 'text', text: 'first prompt' }] } },
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('never blocks when gates.auto_compact is false, regardless of usage', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 190000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nauto_compact = false\n[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `node --test tests/user-prompt-submit/auto-compact.test.js`
Expected: FAIL — `Cannot find module '../../hooks/user-prompt-submit/auto-compact'`.

- [ ] **Step 7: Write the hook**

Create `hooks/user-prompt-submit/auto-compact.js`:

```javascript
const fs = require('fs');
const { loadConfig } = require('../lib/config');

function mostRecentUsage(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type === 'assistant' && entry.message && entry.message.usage) {
      const u = entry.message.usage;
      return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    }
  }
  return null;
}

module.exports = function autoCompact(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.gates.auto_compact) return null;
  if (!input.transcript_path || !fs.existsSync(input.transcript_path)) return null;

  const usageTotal = mostRecentUsage(input.transcript_path);
  if (usageTotal === null) return null;

  const limit = config.context.context_max * config.context.threshold;
  if (usageTotal < limit) return null;

  return {
    block: true,
    message: `[truss] Context usage (~${usageTotal} tokens) has crossed ${Math.round(config.context.threshold * 100)}% of the configured ${config.context.context_max}-token limit. Run /compact before continuing — preserve: goal, changed files, architectural decisions, unresolved errors, next step.`,
  };
};
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test tests/user-prompt-submit/auto-compact.test.js`
Expected: PASS (6 tests, 6 pass).

- [ ] **Step 9: Wire the new hook into hooks.json**

In `hooks/hooks.json`, add a new top-level entry to the `hooks` object (after `"SessionStart"`, before `"PreToolUse"` — order doesn't matter functionally, but keeps lifecycle-ish events grouped):

```json
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "exec node \"${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.js\" UserPromptSubmit",
            "timeout": 10
          }
        ]
      }
    ],
```

No `matcher` field — matches the existing `PreToolUse`/`PostToolUse` match-all pattern.

- [ ] **Step 10: Update the config template and this project's own config**

In `templates/truss.toml`, add to the `[gates]` section and a new `[context]` section:

```toml
[gates]
read_before_write = true      # block edits to files not read this session
failure_ledger    = true      # check failure ledger before edits
spec_gate         = true      # require approved criteria before coding
auto_compact      = true      # block prompts once context usage crosses [context] threshold

[routing]
stale_threshold = 10          # unread-change count before routing decisions to developer

[context]
context_max = 200000          # this session's total context window (tokens)
threshold   = 0.6             # fraction of context_max that triggers an auto-compact block
```

In this project's own `truss.toml` (not the template), make the same edit but with `context_max = 1000000` to match this project's actual 1M-token session.

- [ ] **Step 11: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus the new config and auto-compact tests.

- [ ] **Step 12: Commit**

```bash
git add hooks/user-prompt-submit/auto-compact.js tests/user-prompt-submit/auto-compact.test.js hooks/hooks.json hooks/lib/config.js tests/lib/config.test.js templates/truss.toml truss.toml
git commit -m "feat: add auto-compact trigger hook (UserPromptSubmit)"
```

---

## Manual Verification (human, not a subagent)

The hook's behavior against a real, live transcript — and Claude Code's actual handling of the block — can't be asserted by `node:test`. After both tasks are committed and merged:

- [ ] Push to `master`, then `claude plugin uninstall truss@truss-dev && claude plugin marketplace update truss-dev && claude plugin install truss@truss-dev`.
- [ ] Open a brand-new `claude` session (hooks load at session start).
- [ ] Confirm normal prompts are unaffected (no block) while context usage is low.
- [ ] To test the block path without waiting for a real session to fill up: temporarily set `[context] threshold = 0.01` in this project's `truss.toml`, submit any prompt, confirm it's rejected with the expected message, then run `/compact`, then revert `threshold` back to `0.6`.
- [ ] Confirm `[gates] auto_compact = false` fully disables the hook (no block regardless of usage).
