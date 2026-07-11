const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../../hooks/lib/config');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('returns defaults when truss.toml is missing', () => {
  const tmp = makeTmp();
  const { config, warning } = loadConfig(tmp);
  assert.strictEqual(warning, null);
  assert.strictEqual(config.model.coordinator, 'sonnet');
  assert.strictEqual(config.model.thinking, 'opus');
  assert.strictEqual(config.model.coding, 'haiku');
  assert.strictEqual(config.model.escalation, 'opus');
  assert.strictEqual(config.log.events, true);
  assert.strictEqual(config.gates.auto_compact, true);
  assert.strictEqual(config.gates.plain_speak, true);
  assert.strictEqual(config.context.context_max, 200000);
  assert.strictEqual(config.context.threshold, 0.6);
  fs.rmSync(tmp, { recursive: true });
});

test('log.decisions defaults to true', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.log.decisions, true);
  fs.rmSync(tmp, { recursive: true });
});

test('research.decide defaults to "user"', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.research.decide, 'user');
  fs.rmSync(tmp, { recursive: true });
});

test('research.max_rounds defaults to 3', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.research.max_rounds, 3);
  fs.rmSync(tmp, { recursive: true });
});

test('research config can be overridden', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[research]\ndecide = "claude"\nmax_rounds = 5\n');
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.research.decide, 'claude');
  assert.strictEqual(config.research.max_rounds, 5);
  fs.rmSync(tmp, { recursive: true });
});

test('returns warning and defaults when truss.toml has invalid section header', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates\nauto_compact = false\n');
  const { config, warning } = loadConfig(tmp);
  assert.match(warning, /malformed truss\.toml/);
  assert.strictEqual(config.gates.auto_compact, true); // default preserved
  fs.rmSync(tmp, { recursive: true });
});

test('overrides specific values while keeping defaults for the rest', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nauto_compact = false\n');
  const { config, warning } = loadConfig(tmp);
  assert.strictEqual(warning, null);
  assert.strictEqual(config.gates.auto_compact, false);
  assert.strictEqual(config.gates.model_routing, true); // default preserved
  fs.rmSync(tmp, { recursive: true });
});

test('ignores inline comments on value lines', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[log]\nevents = true      # this is a comment\n');
  const { config, warning } = loadConfig(tmp);
  assert.strictEqual(warning, null);
  assert.strictEqual(config.log.events, true); // must be boolean true, not a truthy string
  fs.rmSync(tmp, { recursive: true });
});

test('parses string and number values, overriding defaults', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), [
    '[model]',
    'thinking = "sonnet"',
    '[context]',
    'context_max = 500000',
  ].join('\n'));
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.model.thinking, 'sonnet');
  assert.strictEqual(config.model.coding, 'haiku'); // default preserved
  assert.strictEqual(config.context.context_max, 500000);
  fs.rmSync(tmp, { recursive: true });
});

test('gates.plain_speak can be overridden to false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nplain_speak = false\n');
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.gates.plain_speak, false);
  fs.rmSync(tmp, { recursive: true });
});
