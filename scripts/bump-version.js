#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REAL_REPO_ROOT = path.resolve(__dirname, '..');

function bumpPatch(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

function bumpVersion({ repoRoot = REAL_REPO_ROOT } = {}) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pluginJsonPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');
  const marketplaceJsonPath = path.join(repoRoot, '.claude-plugin', 'marketplace.json');
  const rootPluginJsonPath = path.join(repoRoot, 'plugin.json');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const newVersion = bumpPatch(packageJson.version);

  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  pluginJson.version = newVersion;
  fs.writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');

  const marketplaceJson = JSON.parse(fs.readFileSync(marketplaceJsonPath, 'utf8'));
  marketplaceJson.plugins[0].version = newVersion;
  fs.writeFileSync(marketplaceJsonPath, JSON.stringify(marketplaceJson, null, 2) + '\n');

  if (fs.existsSync(rootPluginJsonPath)) {
    const rootPluginJson = JSON.parse(fs.readFileSync(rootPluginJsonPath, 'utf8'));
    rootPluginJson.version = newVersion;
    fs.writeFileSync(rootPluginJsonPath, JSON.stringify(rootPluginJson, null, 2) + '\n');
  }

  return newVersion;
}

if (require.main === module) {
  const newVersion = bumpVersion();
  console.log(`Bumped version to ${newVersion} (package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json)`);
}

module.exports = { bumpVersion, bumpPatch };
