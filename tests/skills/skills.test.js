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

test('research skill documents truss-skills/research.md override', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /truss-skills\/research\.md/, 'must document the override file path');
});

test('research skill documents fan-out dispatch and confirm-step trace', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /2\+ items/, 'must document the fan-out threshold');
  assert.match(content, /one subagent per item/, 'must document per-item subagent dispatch');
  assert.match(content, /Confirmed with user/, 'must document the confirm-step trace format');
});

test('research skill documents the trigger red-flag table', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /already confident/, 'must document the red-flag table');
  assert.match(content, /\| Thought \| Reality \|/, 'must document red-flag table framing');
});

test('research skill documents the decide-to-research step and config', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /\[research\]/, 'must document the [research] config section');
  assert.match(content, /decide = "user"|decide` \(default `"user"`\)|decide.*default.*user/, 'must document the decide default');
  assert.match(content, /AskUserQuestion/, 'must document the ask-first mechanism');
});

test('research skill documents capped iterative rounds with cap-reset', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /max_rounds/, 'must document the round cap config');
  assert.match(content, /reset the counter and continue/, 'must document cap-reset behavior');
});

test('research skill documents mandatory ask-every-round (not just at cap)', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /After every round, ask the user — never decide silently/, 'must document the per-round ask');
  assert.match(content, /not only once `max_rounds` is reached/, 'must document this fires before the cap too');
});

test('research skill documents mandatory sequencing after brainstorming Step 1', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /Sequencing is not optional/, 'must document the sequencing rule');
  assert.match(content, /brainstorming.*Step 1/, 'must reference brainstorming Step 1 explicitly');
});

test('reset skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/reset/SKILL.md'));
});

test('reset skill documents truss-skills/reset.md override', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/reset/SKILL.md'), 'utf8');
  assert.match(content, /truss-skills\/reset\.md/, 'must document the override file path');
});
