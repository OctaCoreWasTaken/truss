# Truss Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the truss plugin scaffold — directory structure, hook dispatcher, file templates, config loader, EVENTS.log appender, and dev install scripts — so every subsequent component has a home to plug into.

**Architecture:** Feature-organized hooks directory. Claude Code invokes a single `dispatch.js` per event; it loads all `.js` handler files from the matching subdirectory in alphabetical order and runs them in sequence. Adding a new feature = drop a file in the right folder.

**Tech Stack:** Node.js 22, `node:test` (built-in), no external dependencies.

## Global Constraints

- No npm dependencies — Node.js built-ins only (`fs`, `path`, `os`, `node:test`, `node:assert`)
- All handlers export a single function `(input) => null | { block: true, message: string } | { additionalContext: string }`
- Config is always loaded with safe defaults — never throw on missing or malformed `truss.toml`
- `EVENTS.log` is append-only — never truncate or rewrite
- All file paths in tests use temp directories — never touch real user home or project files

---

## File Map

```
truss/
├── package.json                          CREATE — npm metadata + scripts
├── plugin.json                           CREATE — Claude Code plugin manifest
├── .gitignore                            CREATE
├── truss.toml                            CREATE — default config (also a template)
├── hooks/
│   ├── dispatch.js                       CREATE — single entry point per event
│   ├── lib/
│   │   └── config.js                     CREATE — TOML config loader with defaults
│   ├── session-start/
│   │   └── init.js                       CREATE — creates missing files, validates config
│   ├── pre-tool-use/                     CREATE — empty dir (future handlers live here)
│   ├── post-tool-use/
│   │   └── events-log.js                 CREATE — appends tool calls to EVENTS.log
│   └── stop/                             CREATE — empty dir (future handlers live here)
├── templates/
│   ├── STATE.md                          CREATE — working memory template
│   ├── CONVENTIONS.md                    CREATE — invariants template
│   └── BRIEF.md                          CREATE — per-module summary template
├── scripts/
│   ├── dev-install.js                    CREATE — symlink plugin for local testing
│   └── dev-uninstall.js                  CREATE — reverse dev-install
└── tests/
    ├── lib/
    │   └── config.test.js                CREATE
    ├── dispatch.test.js                  CREATE
    ├── session-start/
    │   └── init.test.js                  CREATE
    ├── post-tool-use/
    │   └── events-log.test.js            CREATE
    └── scripts/
        └── dev-install.test.js           CREATE
```

---

### Task 1: Project scaffold

**Files:**
- Create: `truss/package.json`
- Create: `truss/plugin.json`
- Create: `truss/.gitignore`
- Create dirs: `truss/hooks/pre-tool-use/`, `truss/hooks/stop/`, `truss/tests/`

**Interfaces:**
- Produces: `npm test` entry point, `npm run dev-install` / `npm run dev-uninstall` scripts, plugin manifest for Claude Code

- [ ] **Step 1: Initialise git repo**

```bash
cd /home/octacore/src/python-projects/truss/truss-v3
git init
```

Expected: `Initialized empty Git repository in .../truss-v3/.git/`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "truss",
  "version": "0.1.0",
  "description": "Trust layer for agentic coding",
  "type": "commonjs",
  "scripts": {
    "test": "node --test --recursive tests/",
    "dev-install": "node scripts/dev-install.js",
    "dev-uninstall": "node scripts/dev-uninstall.js"
  },
  "engines": { "node": ">=18" }
}
```

- [ ] **Step 3: Create `plugin.json`**

```json
{
  "name": "truss",
  "version": "0.1.0",
  "description": "Trust layer for agentic coding",
  "hooks": {
    "SessionStart": { "command": "node hooks/dispatch.js SessionStart" },
    "PreToolUse":   { "command": "node hooks/dispatch.js PreToolUse" },
    "PostToolUse":  { "command": "node hooks/dispatch.js PostToolUse" },
    "Stop":         { "command": "node hooks/dispatch.js Stop" }
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 5: Create empty hook and test directories**

```bash
mkdir -p hooks/pre-tool-use hooks/stop hooks/lib hooks/session-start hooks/post-tool-use
mkdir -p templates scripts tests/lib tests/session-start tests/post-tool-use tests/scripts
```

- [ ] **Step 6: Verify structure**

```bash
find . -not -path './.git/*' -not -path './node_modules/*' | sort
```

Expected output includes `./hooks/pre-tool-use`, `./hooks/stop`, `./plugin.json`, `./package.json`

- [ ] **Step 7: Commit**

```bash
git add package.json plugin.json .gitignore
git commit -m "feat: project scaffold — package.json, plugin.json, directory structure"
```

---

### Task 2: Config loader

**Files:**
- Create: `hooks/lib/config.js`
- Test: `tests/lib/config.test.js`

**Interfaces:**
- Produces: `loadConfig(projectRoot: string) => { config: Config, warning: string | null }`
  where `Config = { gates: { read_before_write, failure_ledger, spec_gate }, routing: { stale_threshold }, model: { classifier, thresholds }, log: { events } }`
- Consumed by: `hooks/session-start/init.js`, `hooks/post-tool-use/events-log.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/config.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../../hooks/lib/config');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('returns defaults when truss.toml is missing', () => {
  const tmp = makeTmp();
  const { config, warning } = loadConfig(tmp);
  assert.strictEqual(warning, null);
  assert.strictEqual(config.gates.read_before_write, true);
  assert.strictEqual(config.gates.failure_ledger, true);
  assert.strictEqual(config.gates.spec_gate, true);
  assert.strictEqual(config.routing.stale_threshold, 10);
  assert.strictEqual(config.model.classifier, 'haiku');
  assert.deepStrictEqual(config.model.thresholds, [4, 7]);
  assert.strictEqual(config.log.events, true);
  fs.rmSync(tmp, { recursive: true });
});

test('returns warning and defaults when truss.toml has invalid section header', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates\nread_before_write = false\n');
  const { config, warning } = loadConfig(tmp);
  assert.match(warning, /malformed truss\.toml/);
  assert.strictEqual(config.gates.read_before_write, true); // default preserved
  fs.rmSync(tmp, { recursive: true });
});

test('overrides specific values while keeping defaults for the rest', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[gates]\nread_before_write = false\n');
  const { config, warning } = loadConfig(tmp);
  assert.strictEqual(warning, null);
  assert.strictEqual(config.gates.read_before_write, false);
  assert.strictEqual(config.gates.failure_ledger, true); // default preserved
  fs.rmSync(tmp, { recursive: true });
});

test('parses string, number, boolean, and array values', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), [
    '[model]',
    'classifier = "sonnet"',
    'thresholds = [3, 8]',
    '[routing]',
    'stale_threshold = 5',
  ].join('\n'));
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.model.classifier, 'sonnet');
  assert.deepStrictEqual(config.model.thresholds, [3, 8]);
  assert.strictEqual(config.routing.stale_threshold, 5);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/lib/config.test.js
```

Expected: FAIL — `Cannot find module '../../hooks/lib/config'`

- [ ] **Step 3: Implement `hooks/lib/config.js`**

```js
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  gates:   { read_before_write: true, failure_ledger: true, spec_gate: true },
  routing: { stale_threshold: 10 },
  model:   { classifier: 'haiku', thresholds: [4, 7] },
  log:     { events: true },
};

function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map(v => parseValue(v.trim()));
  }
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

function parseToml(content) {
  const result = {};
  let section = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[')) {
      const m = trimmed.match(/^\[(\w+)\]$/);
      if (!m) throw new Error(`Invalid section header: ${trimmed}`);
      section = m[1];
      result[section] = {};
      continue;
    }
    if (!trimmed.includes('=')) throw new Error(`Invalid line: ${trimmed}`);
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    if (!key.match(/^\w+$/)) throw new Error(`Invalid key: ${key}`);
    if (section === null) throw new Error('Key-value pair before any section');
    result[section][key] = parseValue(rawVal);
  }
  return result;
}

function mergeWithDefaults(parsed) {
  const result = {};
  for (const [section, vals] of Object.entries(DEFAULTS)) {
    result[section] = { ...vals, ...(parsed[section] || {}) };
  }
  return result;
}

function loadConfig(projectRoot) {
  const tomlPath = path.join(projectRoot, 'truss.toml');
  if (!fs.existsSync(tomlPath)) return { config: { ...DEFAULTS }, warning: null };
  try {
    const parsed = parseToml(fs.readFileSync(tomlPath, 'utf8'));
    return { config: mergeWithDefaults(parsed), warning: null };
  } catch (e) {
    return { config: { ...DEFAULTS }, warning: `malformed truss.toml — using defaults (${e.message})` };
  }
}

module.exports = { loadConfig };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/lib/config.test.js
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/lib/config.js tests/lib/config.test.js
git commit -m "feat: config loader — reads truss.toml with safe defaults and malformed-file warning"
```

---

### Task 3: File templates

**Files:**
- Create: `templates/truss.toml`
- Create: `templates/STATE.md`
- Create: `templates/CONVENTIONS.md`
- Create: `templates/BRIEF.md`

**Interfaces:**
- Produces: template files copied by `hooks/session-start/init.js` into the project root on first run

No TDD — static content.

- [ ] **Step 1: Create `templates/truss.toml`**

```toml
# truss configuration — all fields are optional, defaults shown below
# Edit to control truss behaviour. Delete any section to use the default.

[gates]
read_before_write = true      # block edits to files not read this session
failure_ledger    = true      # check failure ledger before edits
spec_gate         = true      # require approved criteria before coding

[routing]
stale_threshold = 10          # unread-change count before routing decisions to developer

[model]
classifier  = "haiku"         # model used for difficulty scoring
thresholds  = [4, 7]          # 1-4 -> haiku, 5-7 -> sonnet, 8-10 -> opus

[log]
events = true                 # append every tool call to EVENTS.log
```

- [ ] **Step 2: Create `templates/STATE.md`**

```markdown
# State

Working memory and comprehension pile for the current session.
The agent fills this in; the developer edits it to steer.

## Current Task
<!-- What the agent is currently working on -->

## Comprehension Pile
<!-- Per-module staleness counts — updated automatically by truss -->

| Module | Unread Changes |
|--------|---------------|

## Notes
<!-- Anything the agent needs to remember across tool calls -->
```

- [ ] **Step 3: Create `templates/CONVENTIONS.md`**

```markdown
# Conventions

Invariants the agent must always follow in this project.
Edit this file to add, change, or remove conventions.
The agent checks this file before making design decisions.

## Code Style
<!-- e.g. 2-space indentation, single quotes, no semicolons -->

## Architecture Rules
<!-- e.g. no direct DB calls outside the repository layer -->

## Never Skip
<!-- e.g. input validation, error handling, security checks -->
```

- [ ] **Step 4: Create `templates/BRIEF.md`**

```markdown
# Brief: [Module Name]

Plain-language summary of what this module does and why it exists.
Maintained by the agent — updated whenever this module changes significantly.

## What It Does
<!-- One paragraph, no code -->

## Why It Exists
<!-- The problem it solves -->

## Recent Changes
<!-- Last 2-3 significant changes, in plain language -->
```

- [ ] **Step 5: Commit**

```bash
git add templates/
git commit -m "feat: file templates — STATE.md, CONVENTIONS.md, BRIEF.md, truss.toml"
```

---

### Task 4: Dispatcher

**Files:**
- Create: `hooks/dispatch.js`
- Test: `tests/dispatch.test.js`

**Interfaces:**
- Consumes: handler files at `hooks/<event-dir>/*.js`, each exporting `(input) => null | { block, message } | { additionalContext }`
- Produces: CLI script called by Claude Code as `node hooks/dispatch.js <EventName>`; outputs `{"decision":"block","reason":"..."}` (exit 2) or `{"additionalContext":"..."}` (exit 0) to stdout
- Exported: `runHandlers(event, input, hooksDir?) => null | { block, message } | { additionalContext }`
- Exported: `eventToDir(event: string) => string`

- [ ] **Step 1: Write the failing tests**

Create `tests/dispatch.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runHandlers, eventToDir } = require('../hooks/dispatch');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

test('eventToDir converts SessionStart to session-start', () => {
  assert.strictEqual(eventToDir('SessionStart'), 'session-start');
});

test('eventToDir converts PreToolUse to pre-tool-use', () => {
  assert.strictEqual(eventToDir('PreToolUse'), 'pre-tool-use');
});

test('eventToDir converts PostToolUse to post-tool-use', () => {
  assert.strictEqual(eventToDir('PostToolUse'), 'post-tool-use');
});

test('eventToDir converts Stop to stop', () => {
  assert.strictEqual(eventToDir('Stop'), 'stop');
});

test('returns null when event directory does not exist', () => {
  const tmp = makeTmp();
  const result = runHandlers('SessionStart', {}, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when handler returns null', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'session-start'));
  fs.writeFileSync(path.join(tmp, 'session-start', 'noop.js'), 'module.exports = () => null;');
  const result = runHandlers('SessionStart', {}, tmp);
  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('stops on first block and does not run subsequent handlers', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'pre-tool-use'));
  fs.writeFileSync(path.join(tmp, 'pre-tool-use', '01-blocker.js'),
    'module.exports = () => ({ block: true, message: "blocked by test" });');
  fs.writeFileSync(path.join(tmp, 'pre-tool-use', '02-should-not-run.js'),
    'module.exports = () => { throw new Error("should not run"); };');
  const result = runHandlers('PreToolUse', {}, tmp);
  assert.deepStrictEqual(result, { block: true, message: 'blocked by test' });
  fs.rmSync(tmp, { recursive: true });
});

test('accumulates additionalContext from multiple handlers', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'session-start'));
  fs.writeFileSync(path.join(tmp, 'session-start', 'a.js'),
    'module.exports = () => ({ additionalContext: "context A" });');
  fs.writeFileSync(path.join(tmp, 'session-start', 'b.js'),
    'module.exports = () => ({ additionalContext: "context B" });');
  const result = runHandlers('SessionStart', {}, tmp);
  assert.strictEqual(result.additionalContext, 'context A\n\ncontext B');
  fs.rmSync(tmp, { recursive: true });
});

test('passes input payload to each handler', () => {
  const tmp = makeTmp();
  fs.mkdirSync(path.join(tmp, 'pre-tool-use'));
  fs.writeFileSync(path.join(tmp, 'pre-tool-use', 'echo.js'),
    'module.exports = (input) => ({ additionalContext: input.tool_name });');
  const result = runHandlers('PreToolUse', { tool_name: 'Edit' }, tmp);
  assert.strictEqual(result.additionalContext, 'Edit');
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/dispatch.test.js
```

Expected: FAIL — `Cannot find module '../hooks/dispatch'`

- [ ] **Step 3: Implement `hooks/dispatch.js`**

```js
const fs = require('fs');
const path = require('path');

function eventToDir(event) {
  return event.replace(/([A-Z])/g, (match, letter, offset) =>
    (offset > 0 ? '-' : '') + letter.toLowerCase()
  );
}

function runHandlers(event, input, hooksDir = __dirname) {
  const dir = path.join(hooksDir, eventToDir(event));
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const contexts = [];

  for (const file of files) {
    const handler = require(path.join(dir, file));
    const result = handler(input);
    if (result && result.block) return result;
    if (result && result.additionalContext) contexts.push(result.additionalContext);
  }

  return contexts.length > 0 ? { additionalContext: contexts.join('\n\n') } : null;
}

if (require.main === module) {
  const event = process.argv[2];
  const raw = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(raw || '{}');
  const result = runHandlers(event, input);

  if (result && result.block) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: result.message }) + '\n');
    process.exit(2);
  }
  if (result && result.additionalContext) {
    process.stdout.write(JSON.stringify({ additionalContext: result.additionalContext }) + '\n');
  }
  process.exit(0);
}

module.exports = { runHandlers, eventToDir };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/dispatch.test.js
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/dispatch.js tests/dispatch.test.js
git commit -m "feat: hook dispatcher — routes events to feature handlers, accumulates context, stops on block"
```

---

### Task 5: SessionStart init handler

**Files:**
- Create: `hooks/session-start/init.js`
- Test: `tests/session-start/init.test.js`

**Interfaces:**
- Consumes: `loadConfig(projectRoot)` from `hooks/lib/config.js`
- Consumes: template files from `templates/`
- Produces: handler `(input, projectRoot?, pluginRoot?) => null | { additionalContext }`
  — copies missing files from templates into `projectRoot`
  — returns `{ additionalContext: "[truss] Warning: ..." }` if config is malformed, `null` otherwise

- [ ] **Step 1: Write the failing tests**

Create `tests/session-start/init.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const init = require('../../hooks/session-start/init');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
}

function makePluginRoot(tmp) {
  const pluginRoot = path.join(tmp, 'plugin');
  const templatesDir = path.join(pluginRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(path.join(templatesDir, 'truss.toml'), '[log]\nevents = true\n');
  fs.writeFileSync(path.join(templatesDir, 'STATE.md'), '# State\n');
  fs.writeFileSync(path.join(templatesDir, 'CONVENTIONS.md'), '# Conventions\n');
  return pluginRoot;
}

test('creates STATE.md from template when missing', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  init({}, project, pluginRoot);

  assert.ok(fs.existsSync(path.join(project, 'STATE.md')));
  assert.strictEqual(fs.readFileSync(path.join(project, 'STATE.md'), 'utf8'), '# State\n');
  fs.rmSync(tmp, { recursive: true });
});

test('creates CONVENTIONS.md from template when missing', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  init({}, project, pluginRoot);

  assert.ok(fs.existsSync(path.join(project, 'CONVENTIONS.md')));
  fs.rmSync(tmp, { recursive: true });
});

test('creates truss.toml from template when missing', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  init({}, project, pluginRoot);

  assert.ok(fs.existsSync(path.join(project, 'truss.toml')));
  fs.rmSync(tmp, { recursive: true });
});

test('does not overwrite existing STATE.md', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);
  fs.writeFileSync(path.join(project, 'STATE.md'), '# My existing state\n');

  init({}, project, pluginRoot);

  assert.strictEqual(
    fs.readFileSync(path.join(project, 'STATE.md'), 'utf8'),
    '# My existing state\n'
  );
  fs.rmSync(tmp, { recursive: true });
});

test('returns null when config is valid', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);

  const result = init({}, project, pluginRoot);

  assert.strictEqual(result, null);
  fs.rmSync(tmp, { recursive: true });
});

test('returns additionalContext warning and writes to EVENTS.log when truss.toml is malformed', () => {
  const tmp = makeTmp();
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const pluginRoot = makePluginRoot(tmp);
  // Pre-create a malformed truss.toml so init does not overwrite it with the template
  fs.writeFileSync(path.join(project, 'truss.toml'), '[gates\nbad');

  const result = init({}, project, pluginRoot);

  assert.ok(result.additionalContext.includes('[truss] Warning'));
  const log = fs.readFileSync(path.join(project, 'EVENTS.log'), 'utf8').trim();
  const record = JSON.parse(log);
  assert.strictEqual(record.event, 'ConfigWarning');
  assert.ok(record.ts);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/session-start/init.test.js
```

Expected: FAIL — `Cannot find module '../../hooks/session-start/init'`

- [ ] **Step 3: Implement `hooks/session-start/init.js`**

```js
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');

const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '../..');

const TEMPLATES = ['truss.toml', 'STATE.md', 'CONVENTIONS.md'];

function createMissingFiles(projectRoot, pluginRoot) {
  for (const filename of TEMPLATES) {
    const dest = path.join(projectRoot, filename);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(pluginRoot, 'templates', filename), dest);
    }
  }
}

function appendEvent(projectRoot, record) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
  fs.appendFileSync(path.join(projectRoot, 'EVENTS.log'), line);
}

module.exports = function init(input, projectRoot = process.cwd(), pluginRoot = DEFAULT_PLUGIN_ROOT) {
  createMissingFiles(projectRoot, pluginRoot);
  const { warning } = loadConfig(projectRoot);
  if (warning) {
    appendEvent(projectRoot, { event: 'ConfigWarning', reason: warning });
    return { additionalContext: `[truss] Warning: ${warning}` };
  }
  return null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/session-start/init.test.js
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/session-start/init.js tests/session-start/init.test.js
git commit -m "feat: SessionStart init handler — creates missing files from templates, warns on bad config"
```

---

### Task 6: PostToolUse events-log handler

**Files:**
- Create: `hooks/post-tool-use/events-log.js`
- Test: `tests/post-tool-use/events-log.test.js`

**Interfaces:**
- Consumes: `loadConfig(projectRoot)` from `hooks/lib/config.js`
- Consumes: hook input `{ tool_name: string, tool_input: { file_path?: string, ... } }`
- Produces: handler `(input, projectRoot?) => null` — appends one JSON line to `EVENTS.log`

- [ ] **Step 1: Write the failing tests**

Create `tests/post-tool-use/events-log.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/post-tool-use/events-log.test.js
```

Expected: FAIL — `Cannot find module '../../hooks/post-tool-use/events-log'`

- [ ] **Step 3: Implement `hooks/post-tool-use/events-log.js`**

```js
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');

module.exports = function eventsLog(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.log.events) return null;

  const record = {
    ts: new Date().toISOString(),
    event: 'ToolUse',
    tool: input.tool_name,
  };
  if (input.tool_input && input.tool_input.file_path) {
    record.file = input.tool_input.file_path;
  }

  fs.appendFileSync(path.join(projectRoot, 'EVENTS.log'), JSON.stringify(record) + '\n');
  return null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/post-tool-use/events-log.test.js
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/post-tool-use/events-log.js tests/post-tool-use/events-log.test.js
git commit -m "feat: PostToolUse events-log handler — appends tool calls to EVENTS.log"
```

---

### Task 7: Dev install and uninstall scripts

**Files:**
- Create: `scripts/dev-install.js`
- Create: `scripts/dev-uninstall.js`
- Test: `tests/scripts/dev-install.test.js`

**Interfaces:**
- Produces: `install({ repoRoot, pluginCacheDir, installedPluginsPath, settingsPath }) => void`
- Produces: `uninstall({ pluginCacheDir, installedPluginsPath, settingsPath }) => void`
- CLI: `npm run dev-install` / `npm run dev-uninstall` (calls with real home-dir paths)

- [ ] **Step 1: Write the failing tests**

Create `tests/scripts/dev-install.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { install } = require('../../scripts/dev-install');
const { uninstall } = require('../../scripts/dev-uninstall');

function makeEnv() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'truss-test-'));
  const repoRoot = path.join(tmp, 'repo');
  fs.mkdirSync(repoRoot);
  return {
    tmp,
    repoRoot,
    pluginCacheDir: path.join(tmp, 'cache', 'local', 'truss', 'dev'),
    installedPluginsPath: path.join(tmp, 'installed_plugins.json'),
    settingsPath: path.join(tmp, 'settings.json'),
  };
}

test('install creates a symlink pointing to repoRoot', () => {
  const env = makeEnv();
  install(env);
  const stat = fs.lstatSync(env.pluginCacheDir);
  assert.ok(stat.isSymbolicLink());
  assert.strictEqual(fs.readlinkSync(env.pluginCacheDir), env.repoRoot);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install registers plugin in installed_plugins.json', () => {
  const env = makeEnv();
  install(env);
  const data = JSON.parse(fs.readFileSync(env.installedPluginsPath, 'utf8'));
  assert.ok(data.plugins['truss@local']);
  assert.strictEqual(data.plugins['truss@local'][0].installPath, env.pluginCacheDir);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install adds truss@local to enabledPlugins in settings.json', () => {
  const env = makeEnv();
  install(env);
  const settings = JSON.parse(fs.readFileSync(env.settingsPath, 'utf8'));
  assert.strictEqual(settings.enabledPlugins['truss@local'], true);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install merges into existing settings.json without overwriting other keys', () => {
  const env = makeEnv();
  fs.writeFileSync(env.settingsPath, JSON.stringify({ model: 'sonnet', enabledPlugins: { 'other@local': true } }));
  install(env);
  const settings = JSON.parse(fs.readFileSync(env.settingsPath, 'utf8'));
  assert.strictEqual(settings.model, 'sonnet');
  assert.strictEqual(settings.enabledPlugins['other@local'], true);
  assert.strictEqual(settings.enabledPlugins['truss@local'], true);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install fails if pluginCacheDir exists as a real directory', () => {
  const env = makeEnv();
  fs.mkdirSync(env.pluginCacheDir, { recursive: true });
  assert.throws(() => install(env), /exists and is not a symlink/);
  fs.rmSync(env.tmp, { recursive: true });
});

test('install replaces existing symlink', () => {
  const env = makeEnv();
  fs.mkdirSync(path.dirname(env.pluginCacheDir), { recursive: true });
  fs.symlinkSync('/old/path', env.pluginCacheDir);
  install(env);
  assert.strictEqual(fs.readlinkSync(env.pluginCacheDir), env.repoRoot);
  fs.rmSync(env.tmp, { recursive: true });
});

test('uninstall removes symlink and deregisters plugin', () => {
  const env = makeEnv();
  install(env);
  uninstall(env);
  assert.strictEqual(fs.existsSync(env.pluginCacheDir), false);
  const data = JSON.parse(fs.readFileSync(env.installedPluginsPath, 'utf8'));
  assert.strictEqual(data.plugins['truss@local'], undefined);
  const settings = JSON.parse(fs.readFileSync(env.settingsPath, 'utf8'));
  assert.strictEqual(settings.enabledPlugins['truss@local'], undefined);
  fs.rmSync(env.tmp, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/scripts/dev-install.test.js
```

Expected: FAIL — `Cannot find module '../../scripts/dev-install'`

- [ ] **Step 3: Implement `scripts/dev-install.js`**

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_KEY = 'truss@local';
const REAL_REPO_ROOT = path.resolve(__dirname, '..');
const REAL_PLUGIN_CACHE_DIR = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'local', 'truss', 'dev');
const REAL_INSTALLED_PLUGINS_PATH = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
const REAL_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function install({
  repoRoot = REAL_REPO_ROOT,
  pluginCacheDir = REAL_PLUGIN_CACHE_DIR,
  installedPluginsPath = REAL_INSTALLED_PLUGINS_PATH,
  settingsPath = REAL_SETTINGS_PATH,
} = {}) {
  // 1. Symlink
  if (fs.existsSync(pluginCacheDir)) {
    if (!fs.lstatSync(pluginCacheDir).isSymbolicLink()) {
      throw new Error(`${pluginCacheDir} exists and is not a symlink — remove it manually`);
    }
    fs.unlinkSync(pluginCacheDir);
  }
  fs.mkdirSync(path.dirname(pluginCacheDir), { recursive: true });
  fs.symlinkSync(repoRoot, pluginCacheDir);
  console.log(`Symlinked: ${pluginCacheDir} -> ${repoRoot}`);

  // 2. installed_plugins.json
  let installed = { version: 2, plugins: {} };
  if (fs.existsSync(installedPluginsPath)) {
    installed = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf8'));
  }
  installed.plugins[PLUGIN_KEY] = [{
    scope: 'local',
    installPath: pluginCacheDir,
    version: 'dev',
    installedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }];
  fs.writeFileSync(installedPluginsPath, JSON.stringify(installed, null, 2));
  console.log(`Registered in installed_plugins.json`);

  // 3. settings.json
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  settings.enabledPlugins = settings.enabledPlugins || {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`Added to enabledPlugins in settings.json`);

  console.log('\nDone. Restart Claude Code for truss to take effect.');
}

if (require.main === module) install();
module.exports = { install };
```

- [ ] **Step 4: Implement `scripts/dev-uninstall.js`**

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_KEY = 'truss@local';
const REAL_PLUGIN_CACHE_DIR = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'local', 'truss', 'dev');
const REAL_INSTALLED_PLUGINS_PATH = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
const REAL_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function uninstall({
  pluginCacheDir = REAL_PLUGIN_CACHE_DIR,
  installedPluginsPath = REAL_INSTALLED_PLUGINS_PATH,
  settingsPath = REAL_SETTINGS_PATH,
} = {}) {
  // 1. Remove symlink
  if (fs.existsSync(pluginCacheDir) && fs.lstatSync(pluginCacheDir).isSymbolicLink()) {
    fs.unlinkSync(pluginCacheDir);
    console.log(`Removed symlink: ${pluginCacheDir}`);
  }

  // 2. installed_plugins.json
  if (fs.existsSync(installedPluginsPath)) {
    const installed = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf8'));
    delete installed.plugins[PLUGIN_KEY];
    fs.writeFileSync(installedPluginsPath, JSON.stringify(installed, null, 2));
    console.log(`Removed from installed_plugins.json`);
  }

  // 3. settings.json
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.enabledPlugins) {
      delete settings.enabledPlugins[PLUGIN_KEY];
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`Removed from enabledPlugins in settings.json`);
    }
  }

  console.log('\nDone. Restart Claude Code to complete uninstall.');
}

if (require.main === module) uninstall();
module.exports = { uninstall };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test tests/scripts/dev-install.test.js
```

Expected: all 7 tests PASS

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests PASS across all files

- [ ] **Step 7: Commit**

```bash
git add scripts/dev-install.js scripts/dev-uninstall.js tests/scripts/dev-install.test.js
git commit -m "feat: dev-install/uninstall scripts — symlinks plugin into Claude Code plugin cache for local testing"
```

- [ ] **Step 8: Run dev-install to wire the plugin**

```bash
npm run dev-install
```

Expected output:
```
Symlinked: ~/.claude/plugins/cache/local/truss/dev -> <repo-path>
Registered in installed_plugins.json
Added to enabledPlugins in settings.json

Done. Restart Claude Code for truss to take effect.
```

- [ ] **Step 9: Verify plugin appears in Claude Code**

Restart Claude Code and confirm no startup errors. The plugin is now wired; subsequent components (Read-Before-Write Gate, Failure Ledger, etc.) can be added by dropping handler files into `hooks/pre-tool-use/` and `hooks/post-tool-use/`.
