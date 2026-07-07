#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_KEY = 'truss@local';
const REAL_PLUGIN_CACHE_DIR = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'local', 'truss', 'dev');
const REAL_INSTALLED_PLUGINS_PATH = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
const REAL_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function uninstall({
  pluginCacheDir = REAL_PLUGIN_CACHE_DIR,
  installedPluginsPath = REAL_INSTALLED_PLUGINS_PATH,
  settingsPath = REAL_SETTINGS_PATH,
} = {}) {
  // 1. Remove symlink
  if (fs.existsSync(pluginCacheDir) && fs.lstatSync(pluginCacheDir).isSymbolicLink()) {
    fs.unlinkSync(pluginCacheDir);
    console.log(`Removed symlink: ${pluginCacheDir}`);
  }

  // 2. installed_plugins.json
  if (fs.existsSync(installedPluginsPath)) {
    const installed = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf8'));
    delete installed.plugins[PLUGIN_KEY];
    fs.writeFileSync(installedPluginsPath, JSON.stringify(installed, null, 2));
    console.log(`Removed from installed_plugins.json`);
  }

  // 3. settings.json
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.enabledPlugins) {
      delete settings.enabledPlugins[PLUGIN_KEY];
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`Removed from enabledPlugins in settings.json`);
    }
  }

  console.log('\nDone. Restart Claude Code to complete uninstall.');
}

if (require.main === module) uninstall();
module.exports = { uninstall };
