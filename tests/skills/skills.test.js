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
