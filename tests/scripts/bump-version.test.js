const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bumpVersion, bumpPatch } = require('../../scripts/bump-version');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function writeRepo(repoRoot, version) {
  fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ name: 'truss', version }));
  fs.mkdirSync(path.join(repoRoot, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'truss', version }));
  fs.writeFileSync(
    path.join(repoRoot, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ name: 'truss-dev', plugins: [{ name: 'truss', version, source: './' }] })
  );
}

test('bumpPatch increments the patch component', () => {
  assert.strictEqual(bumpPatch('0.1.0'), '0.1.1');
  assert.strictEqual(bumpPatch('1.2.9'), '1.2.10');
});

test('bumps version across package.json, plugin.json, and marketplace.json', () => {
  const tmp = makeTmp();
  writeRepo(tmp, '0.1.0');

  const newVersion = bumpVersion({ repoRoot: tmp });

  assert.strictEqual(newVersion, '0.1.1');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8')).version, '0.1.1');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.1');
  assert.strictEqual(
    JSON.parse(fs.readFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), 'utf8')).plugins[0].version,
    '0.1.1'
  );
  fs.rmSync(tmp, { recursive: true });
});

test('also bumps a root-level plugin.json when present', () => {
  const tmp = makeTmp();
  writeRepo(tmp, '0.1.0');
  fs.writeFileSync(path.join(tmp, 'plugin.json'), JSON.stringify({ name: 'truss', version: '0.1.0' }));

  bumpVersion({ repoRoot: tmp });

  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, 'plugin.json'), 'utf8')).version, '0.1.1');
  fs.rmSync(tmp, { recursive: true });
});

test('skips root-level plugin.json silently when absent', () => {
  const tmp = makeTmp();
  writeRepo(tmp, '0.1.0');

  assert.doesNotThrow(() => bumpVersion({ repoRoot: tmp }));
  fs.rmSync(tmp, { recursive: true });
});
