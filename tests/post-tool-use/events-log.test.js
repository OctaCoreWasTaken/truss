const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const eventsLog = require('../../hooks/post-tool-use/events-log');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function readLog(dir) {
  return fs.readFileSync(path.join(dir, 'EVENTS.log'), 'utf8')
    .trim().split('\n').map(l => JSON.parse(l));
}

test('appends ToolUse record with tool name and timestamp', () => {
  const tmp = makeTmp();
  eventsLog({ tool_name: 'Edit', tool_input: {} }, tmp);
  const [record] = readLog(tmp);
  assert.strictEqual(record.event, 'ToolUse');
  assert.strictEqual(record.tool, 'Edit');
  assert.ok(record.ts);
  fs.rmSync(tmp, { recursive: true });
});

test('includes file path when tool_input has file_path', () => {
  const tmp = makeTmp();
  eventsLog({ tool_name: 'Edit', tool_input: { file_path: 'src/foo.js' } }, tmp);
  const [record] = readLog(tmp);
  assert.strictEqual(record.file, 'src/foo.js');
  fs.rmSync(tmp, { recursive: true });
});

test('omits file field when tool_input has no file_path', () => {
  const tmp = makeTmp();
  eventsLog({ tool_name: 'Bash', tool_input: { command: 'ls' } }, tmp);
  const [record] = readLog(tmp);
  assert.strictEqual(record.file, undefined);
  fs.rmSync(tmp, { recursive: true });
});

test('appends multiple records without overwriting', () => {
  const tmp = makeTmp();
  eventsLog({ tool_name: 'Edit', tool_input: {} }, tmp);
  eventsLog({ tool_name: 'Read', tool_input: {} }, tmp);
  const records = readLog(tmp);
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[1].tool, 'Read');
  fs.rmSync(tmp, { recursive: true });
});

test('skips logging when config.log.events is false', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[log]\nevents = false\n');
  eventsLog({ tool_name: 'Edit', tool_input: {} }, tmp);
  assert.strictEqual(fs.existsSync(path.join(tmp, 'EVENTS.log')), false);
  fs.rmSync(tmp, { recursive: true });
});

test('returns null', () => {
  const tmp = makeTmp();
  const result = eventsLog({ tool_name: 'Edit', tool_input: {} }, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});
