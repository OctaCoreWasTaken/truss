const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const init = require('../../hooks/session-start/init');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function makePluginRoot(tmp) {
  const pluginRoot = path.join(tmp, 'plugin');
  const templatesDir = path.join(pluginRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(path.join(templatesDir, 'truss.toml'), '[log]\nevents = true\n');
  fs.writeFileSync(path.join(templatesDir, 'CONVENTIONS.md'), '# Conventions\n');
  return pluginRoot;
}

test('creates CONVENTIONS.md from template when missing', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  init({}, project, pluginRoot);

  assert.ok(fs.existsSync(path.join(project, 'CONVENTIONS.md')));
  fs.rmSync(tmp, { recursive: true });
});

test('creates truss.toml from template when missing', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  init({}, project, pluginRoot);

  assert.ok(fs.existsSync(path.join(project, 'truss.toml')));
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when config is valid', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  const result = init({}, project, pluginRoot);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('returns additionalContext warning and writes to EVENTS.log when truss.toml is malformed', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);
  // Pre-create a malformed truss.toml so init does not overwrite it with the template
  fs.writeFileSync(path.join(project, 'truss.toml'), '[gates\nbad');

  const result = init({}, project, pluginRoot);

  assert.ok(result.additionalContext.includes('[truss] Warning'));
  const log = fs.readFileSync(path.join(project, 'EVENTS.log'), 'utf8').trim();
  const record = JSON.parse(log);
  assert.strictEqual(record.event, 'ConfigWarning');
  assert.ok(record.ts);
  fs.rmSync(tmp, { recursive: true });
});
