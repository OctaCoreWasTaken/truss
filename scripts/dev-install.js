#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_KEY = 'truss@local';
const REAL_REPO_ROOT = path.resolve(__dirname, '..');
const REAL_PLUGIN_CACHE_DIR = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'local', 'truss', 'dev');
const REAL_INSTALLED_PLUGINS_PATH = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
const REAL_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function install({
  repoRoot = REAL_REPO_ROOT,
  pluginCacheDir = REAL_PLUGIN_CACHE_DIR,
  installedPluginsPath = REAL_INSTALLED_PLUGINS_PATH,
  settingsPath = REAL_SETTINGS_PATH,
} = {}) {
  // 1. Symlink — lstat sees broken symlinks, existsSync doesn't
  let lstat = null;
  try { lstat = fs.lstatSync(pluginCacheDir); } catch (_) {}
  if (lstat) {
    if (!lstat.isSymbolicLink()) {
      throw new Error(`${pluginCacheDir} exists and is not a symlink — remove it manually`);
    }
    fs.unlinkSync(pluginCacheDir);
  }
  fs.mkdirSync(path.dirname(pluginCacheDir), { recursive: true });
  fs.symlinkSync(repoRoot, pluginCacheDir);
  console.log(`Symlinked: ${pluginCacheDir} -> ${repoRoot}`);

  // 2. installed_plugins.json
  let installed = { version: 2, plugins: {} };
  if (fs.existsSync(installedPluginsPath)) {
    installed = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf8'));
  }
  installed.plugins[PLUGIN_KEY] = [{
    scope: 'local',
    installPath: pluginCacheDir,
    version: 'dev',
    installedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }];
  fs.writeFileSync(installedPluginsPath, JSON.stringify(installed, null, 2));
  console.log(`Registered in installed_plugins.json`);

  // 3. settings.json
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  settings.enabledPlugins = settings.enabledPlugins || {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`Added to enabledPlugins in settings.json`);

  console.log('\nDone. Restart Claude Code for truss to take effect.');
}

if (require.main === module) install();
module.exports = { install };
