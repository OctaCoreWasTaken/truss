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
