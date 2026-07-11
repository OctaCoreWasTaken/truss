const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plainSpeak = require('../../hooks/user-prompt-submit/plain-speak');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('returns additionalContext with the rule text by default', () => {
  const tmp = makeTmp();

  const result = plainSpeak({}, tmp);

  assert.ok(result.additionalContext.includes('plain, jargon-free language'));
  assert.ok(result.additionalContext.includes('obligatory, not situational'));
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when gates.plain_speak is false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nplain_speak = false\n');

  const result = plainSpeak({}, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
