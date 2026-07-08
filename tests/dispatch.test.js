const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHandlers, eventToDir, formatOutput } = require('../hooks/dispatch');

const DISPATCH = path.join(__dirname, '../hooks/dispatch.js');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('eventToDir converts SessionStart to session-start', () => {
  assert.strictEqual(eventToDir('SessionStart'), 'session-start');
});

test('eventToDir converts PreToolUse to pre-tool-use', () => {
  assert.strictEqual(eventToDir('PreToolUse'), 'pre-tool-use');
});

test('eventToDir converts PostToolUse to post-tool-use', () => {
  assert.strictEqual(eventToDir('PostToolUse'), 'post-tool-use');
});

test('eventToDir converts Stop to stop', () => {
  assert.strictEqual(eventToDir('Stop'), 'stop');
});

test('returns null when event directory does not exist', () => {
  const tmp = makeTmp();
  const result = runHandlers('SessionStart', {}, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when handler returns null', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'session-start'));
  fs.writeFileSync(path.join(tmp, 'session-start', 'noop.js'), 'module.exports = () => null;');
  const result = runHandlers('SessionStart', {}, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('stops on first block and does not run subsequent handlers', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'pre-tool-use'));
  fs.writeFileSync(path.join(tmp, 'pre-tool-use', '01-blocker.js'),
    'module.exports = () => ({ block: true, message: "blocked by test" });');
  fs.writeFileSync(path.join(tmp, 'pre-tool-use', '02-should-not-run.js'),
    'module.exports = () => { throw new Error("should not run"); };');
  const result = runHandlers('PreToolUse', {}, tmp);
  assert.deepStrictEqual(result, { block: true, message: 'blocked by test' });
  fs.rmSync(tmp, { recursive: true });
});

test('accumulates additionalContext from multiple handlers', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'session-start'));
  fs.writeFileSync(path.join(tmp, 'session-start', 'a.js'),
    'module.exports = () => ({ additionalContext: "context A" });');
  fs.writeFileSync(path.join(tmp, 'session-start', 'b.js'),
    'module.exports = () => ({ additionalContext: "context B" });');
  const result = runHandlers('SessionStart', {}, tmp);
  assert.strictEqual(result.additionalContext, 'context A\n\ncontext B');
  fs.rmSync(tmp, { recursive: true });
});

test('passes input payload to each handler', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'pre-tool-use'));
  fs.writeFileSync(path.join(tmp, 'pre-tool-use', 'echo.js'),
    'module.exports = (input) => ({ additionalContext: input.tool_name });');
  const result = runHandlers('PreToolUse', { tool_name: 'Edit' }, tmp);
  assert.strictEqual(result.additionalContext, 'Edit');
  fs.rmSync(tmp, { recursive: true });
});

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

test('CLI exits 0 with no output when no handlers match', () => {
  const result = spawnSync(process.execPath, [DISPATCH, 'Stop'], {
    input: '{}',
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.trim(), '');
  assert.strictEqual(result.stderr, '');
});

test('CLI exits 0 with no output for PreToolUse (no handlers yet)', () => {
  const result = spawnSync(process.execPath, [DISPATCH, 'PreToolUse'], {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'foo.js' } }),
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.trim(), '');
});
