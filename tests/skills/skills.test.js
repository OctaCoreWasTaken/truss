const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function assertValidFrontmatter(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.startsWith('---\n'), `${skillPath} must start with a frontmatter fence`);
  const end = content.indexOf('\n---', 4);
  assert.ok(end > 0, `${skillPath} must have a closing frontmatter fence`);
  const fm = content.slice(4, end);
  assert.match(fm, /^name:\s*\S+/m, `${skillPath} frontmatter must define name`);
  assert.match(fm, /^description:\s*\S+/m, `${skillPath} frontmatter must define description`);
}

test('research skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/research/SKILL.md'));
});

test('model-routing skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/model-routing/SKILL.md'));
});

test('big-brain skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/big-brain/SKILL.md'));
});

test('plain-speak skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/plain-speak/SKILL.md'));
});

test('plain-speak skill documents session-wide teaching mode', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/plain-speak/SKILL.md'), 'utf8');
  assert.match(content, /GLOSSARY\.md/, 'must document glossary tracking');
  assert.match(content, /whole session/, 'must document session-wide scope');
});
