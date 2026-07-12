const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { install } = require('../../scripts/install-git-hooks');

function makeRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
  execSync('git init -q', { cwd: tmp });
  fs.mkdirSync(path.join(tmp, 'scripts', 'hooks'), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, '../../scripts/hooks/pre-commit'),
    path.join(tmp, 'scripts', 'hooks', 'pre-commit')
  );
  return tmp;
}

test('installs a pre-commit hook that is executable', () => {
  const repoRoot = makeRepo();
  install({ repoRoot });
  const hookPath = path.join(repoRoot, '.git', 'hooks', 'pre-commit');
  assert.ok(fs.existsSync(hookPath));
  const mode = fs.statSync(hookPath).mode;
  assert.ok(mode & 0o100, 'hook must be executable');
  fs.rmSync(repoRoot, { recursive: true });
});

test('installed hook content matches the source pre-commit script', () => {
  const repoRoot = makeRepo();
  install({ repoRoot });
  const installed = fs.readFileSync(path.join(repoRoot, '.git', 'hooks', 'pre-commit'), 'utf8');
  const source = fs.readFileSync(path.join(repoRoot, 'scripts', 'hooks', 'pre-commit'), 'utf8');
  assert.strictEqual(installed, source);
  fs.rmSync(repoRoot, { recursive: true });
});
