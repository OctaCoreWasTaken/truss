#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function install({ repoRoot = REPO_ROOT } = {}) {
  const gitDir = execSync('git rev-parse --git-dir', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const hooksDir = path.isAbsolute(gitDir) ? path.join(gitDir, 'hooks') : path.join(repoRoot, gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const src = path.join(repoRoot, 'scripts', 'hooks', 'pre-commit');
  const dest = path.join(hooksDir, 'pre-commit');
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`Installed pre-commit hook: ${dest}`);
}

if (require.main === module) install();

module.exports = { install };
