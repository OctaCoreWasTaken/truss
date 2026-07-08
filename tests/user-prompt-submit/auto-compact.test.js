const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const autoCompact = require('../../hooks/user-prompt-submit/auto-compact');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function writeTranscript(projectRoot, lines) {
  const transcriptPath = path.join(projectRoot, 'transcript.jsonl');
  fs.writeFileSync(transcriptPath, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return transcriptPath;
}

function assistantLine(usage) {
  return { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }], usage } };
}

test('returns null when usage is under threshold', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('blocks when usage is at or over threshold', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 100000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 0 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result.block, true);
  assert.match(result.message, /compact/i);
  fs.rmSync(tmp, { recursive: true });
});

test('sums input_tokens, cache_read_input_tokens, and cache_creation_input_tokens', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 40000, cache_read_input_tokens: 40000, cache_creation_input_tokens: 40000 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  // 40000 * 3 = 120000 = exactly 200000 * 0.6 -> at threshold, should block
  assert.strictEqual(result.block, true);
  fs.rmSync(tmp, { recursive: true });
});

test('uses the most recent assistant usage line, not an earlier one', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 190000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }), // would block alone
    { type: 'user', message: { content: [{ type: 'text', text: 'ok' }] } },
    assistantLine({ input_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }), // most recent — should NOT block
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when no assistant line with usage exists yet', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    { type: 'user', message: { content: [{ type: 'text', text: 'first prompt' }] } },
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('never blocks when gates.auto_compact is false, regardless of usage', () => {
  const tmp = makeTmp();
  const transcriptPath = writeTranscript(tmp, [
    assistantLine({ input_tokens: 190000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
  ]);
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nauto_compact = false\n[context]\ncontext_max = 200000\nthreshold = 0.6\n');

  const result = autoCompact({ transcript_path: transcriptPath }, tmp);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
