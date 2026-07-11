const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plainSpeak = require('../../hooks/session-start/plain-speak');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('returns additionalContext with the rich rule and examples by default', () => {
  const tmp = makeTmp();

  const result = plainSpeak({}, tmp);

  assert.ok(result.additionalContext.includes('plain, jargon-free language'));
  assert.ok(result.additionalContext.includes('Obligatory'));
  assert.ok(result.additionalContext.includes('Not:'), 'must include a before/after example');
  assert.ok(result.additionalContext.includes('Yes:'), 'must include a before/after example');
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when gates.plain_speak is false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nplain_speak = false\n');

  const result = plainSpeak({}, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
