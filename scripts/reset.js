#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '..');

const LAZY_FILES = ['RESEARCH.md', 'DECISIONS.log'];
const TEMPLATE_FILES = ['truss.toml', 'CONVENTIONS.md'];

function reset({
  projectRoot = process.cwd(),
  pluginRoot = DEFAULT_PLUGIN_ROOT,
} = {}) {
  for (const filename of LAZY_FILES) {
    const target = path.join(projectRoot, filename);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log(`Deleted: ${filename}`);
    }
  }

  for (const filename of TEMPLATE_FILES) {
    const src = path.join(pluginRoot, 'templates', filename);
    const dest = path.join(projectRoot, filename);
    fs.copyFileSync(src, dest);
    console.log(`Reset: ${filename}`);
  }

  console.log('\nDone. EVENTS.log left untouched.');
}

if (require.main === module) reset();
module.exports = { reset };
