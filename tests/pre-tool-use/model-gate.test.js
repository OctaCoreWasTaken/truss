const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const modelGate = require('../../hooks/pre-tool-use/model-gate');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('ignores tool calls other than Agent', () => {
  const tmp = makeTmp();
  const result = modelGate({ tool_name: 'Bash', tool_input: { command: 'ls' } }, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('blocks Agent dispatch with no model set', () => {
  const tmp = makeTmp();
  const result = modelGate({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', description: 'x', prompt: 'y' } }, tmp);
  assert.strictEqual(result.block, true);
  assert.match(result.message, /model/i);
  fs.rmSync(tmp, { recursive: true });
});

test('allows Agent dispatch when model is set', () => {
  const tmp = makeTmp();
  const result = modelGate({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'haiku', description: 'x', prompt: 'y' } }, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('allows fork dispatch with no model — forks always inherit session model', () => {
  const tmp = makeTmp();
  const result = modelGate({ tool_name: 'Agent', tool_input: { subagent_type: 'fork', description: 'x', prompt: 'y' } }, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('never blocks when gates.model_routing is false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nmodel_routing = false\n');
  const result = modelGate({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', description: 'x', prompt: 'y' } }, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('block message names the configured coding/thinking tiers', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[model]\ncoding = "haiku"\nthinking = "opus"\n');
  const result = modelGate({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', description: 'x', prompt: 'y' } }, tmp);
  assert.match(result.message, /haiku/);
  assert.match(result.message, /opus/);
  fs.rmSync(tmp, { recursive: true });
});
