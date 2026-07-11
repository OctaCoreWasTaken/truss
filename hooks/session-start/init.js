const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');

const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '../..');

const TEMPLATES = ['truss.toml', 'CONVENTIONS.md'];

function createMissingFiles(projectRoot, pluginRoot) {
  for (const filename of TEMPLATES) {
    const dest = path.join(projectRoot, filename);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(pluginRoot, 'templates', filename), dest);
    }
  }
}

function appendEvent(projectRoot, record) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
  fs.appendFileSync(path.join(projectRoot, 'EVENTS.log'), line);
}

module.exports = function init(input, projectRoot = process.cwd(), pluginRoot = DEFAULT_PLUGIN_ROOT) {
  createMissingFiles(projectRoot, pluginRoot);
  const { warning } = loadConfig(projectRoot);
  if (warning) {
    appendEvent(projectRoot, { event: 'ConfigWarning', reason: warning });
    return { additionalContext: `[truss] Warning: ${warning}` };
  }
  return null;
};
