const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CLAUDE_MD = fs.readFileSync(path.join(__dirname, '../CLAUDE.md'), 'utf8');

test('CLAUDE.md documents the plugin-agnostic subagent report schema', () => {
  assert.match(CLAUDE_MD, /status: DONE \| BLOCKED/, 'must document the schema fields');
  assert.match(CLAUDE_MD, /files_changed/, 'must document the files_changed field');
  assert.match(CLAUDE_MD, /whatever completion-report artifact/, 'must state the rule is plugin-agnostic, not tied to one file path');
});

test('CLAUDE.md lists DECISIONS.log as a control-surface file', () => {
  assert.match(CLAUDE_MD, /DECISIONS\.log/, 'must list DECISIONS.log alongside the other control-surface files');
});
