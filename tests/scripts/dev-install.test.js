const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { install } = require('../../scripts/dev-install');
const { uninstall } = require('../../scripts/dev-uninstall');

function makeEnv() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
  const repoRoot = path.join(tmp, 'repo');
  fs.mkdirSync(repoRoot);
  return {
    tmp,
    repoRoot,
    pluginCacheDir: path.join(tmp, 'cache', 'local', 'truss', 'dev'),
    installedPluginsPath: path.join(tmp, 'installed_plugins.json'),
    settingsPath: path.join(tmp, 'settings.json'),
  };
}

test('install creates a symlink pointing to repoRoot', () => {
  const env = makeEnv();
  install(env);
  const stat = fs.lstatSync(env.pluginCacheDir);
  assert.ok(stat.isSymbolicLink());
  assert.strictEqual(fs.readlinkSync(env.pluginCacheDir), env.repoRoot);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install registers plugin in installed_plugins.json', () => {
  const env = makeEnv();
  install(env);
  const data = JSON.parse(fs.readFileSync(env.installedPluginsPath, 'utf8'));
  assert.ok(data.plugins['truss@local']);
  assert.strictEqual(data.plugins['truss@local'][0].installPath, env.pluginCacheDir);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install adds truss@local to enabledPlugins in settings.json', () => {
  const env = makeEnv();
  install(env);
  const settings = JSON.parse(fs.readFileSync(env.settingsPath, 'utf8'));
  assert.strictEqual(settings.enabledPlugins['truss@local'], true);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install merges into existing settings.json without overwriting other keys', () => {
  const env = makeEnv();
  fs.writeFileSync(env.settingsPath, JSON.stringify({ model: 'sonnet', enabledPlugins: { 'other@local': true } }));
  install(env);
  const settings = JSON.parse(fs.readFileSync(env.settingsPath, 'utf8'));
  assert.strictEqual(settings.model, 'sonnet');
  assert.strictEqual(settings.enabledPlugins['other@local'], true);
  assert.strictEqual(settings.enabledPlugins['truss@local'], true);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install fails if pluginCacheDir exists as a real directory', () => {
  const env = makeEnv();
  fs.mkdirSync(env.pluginCacheDir, { recursive: true });
  assert.throws(() => install(env), /exists and is not a symlink/);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install replaces existing symlink', () => {
  const env = makeEnv();
  fs.mkdirSync(path.dirname(env.pluginCacheDir), { recursive: true });
  fs.symlinkSync('/old/path', env.pluginCacheDir);
  install(env);
  assert.strictEqual(fs.readlinkSync(env.pluginCacheDir), env.repoRoot);
  fs.rmSync(env.tmp, { recursive: true });
});

test('uninstall removes symlink and deregisters plugin', () => {
  const env = makeEnv();
  install(env);
  uninstall(env);
  assert.strictEqual(fs.existsSync(env.pluginCacheDir), false);
  const data = JSON.parse(fs.readFileSync(env.installedPluginsPath, 'utf8'));
  assert.strictEqual(data.plugins['truss@local'], undefined);
  const settings = JSON.parse(fs.readFileSync(env.settingsPath, 'utf8'));
  assert.strictEqual(settings.enabledPlugins['truss@local'], undefined);
  fs.rmSync(env.tmp, { recursive: true });
});
