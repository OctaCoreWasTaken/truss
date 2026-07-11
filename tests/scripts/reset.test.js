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
