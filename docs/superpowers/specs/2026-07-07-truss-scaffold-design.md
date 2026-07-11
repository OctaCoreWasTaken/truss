# Truss — Scaffold Design
**Date:** 2026-07-07
**Scope:** v0 scaffold — plugin structure, hook wiring, file formats, install mechanism

---

## Overview

Truss is a Claude Code plugin that acts as a trust layer for agentic coding. It runs alongside existing plugins (Superpowers, Context7) rather than replacing them. This document covers the scaffold: the directory structure, hook wiring, data formats, dispatcher pattern, and install mechanism that all subsequent components will build on.

---

## Directory Structure

```
truss/
├── package.json                 # npm metadata + dev-install/uninstall scripts
├── plugin.json                  # Claude Code plugin manifest
├── truss.toml                   # user-editable config (all fields optional)
├── hooks/
│   ├── dispatch.js              # single entry point per event; runs all handlers
│   ├── session-start/
│   │   └── init.js              # creates missing files, validates config, warns on bad toml
│   ├── pre-tool-use/            # handlers run before any tool executes
│   ├── post-tool-use/           # handlers run after any tool executes
│   │   └── events-log.js        # appends every tool call to EVENTS.log
│   └── stop/                    # handlers run before session ends
├── templates/
│   ├── STATE.md                 # working memory + comprehension pile template
│   ├── CONVENTIONS.md           # invariants the agent must follow template
│   └── BRIEF.md                 # per-module plain-language summary template
└── scripts/
    ├── dev-install.js           # wires plugin locally for testing
    └── dev-uninstall.js         # reverses dev-install
```

Feature handlers are added by dropping a `.js` file into the relevant event subdirectory. No other wiring required.

---

## Plugin Manifest

`plugin.json` registers the dispatcher as the single entry point for each hook event:

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

---

## Dispatcher Pattern

`dispatch.js` is the only script Claude Code invokes. It:

1. Receives the event name as a CLI argument
2. Reads the hook payload (JSON) from stdin
3. Loads every `.js` file from `hooks/<event-name>/` in alphabetical order
4. Runs each handler in alphabetical filename order, passing the payload. Handlers earlier in the alphabet run first; if ordering matters between two handlers on the same event, filename prefixes (e.g. `01-`, `02-`) control it.
5. If any handler returns a block signal, the dispatcher stops immediately (remaining handlers do not run), surfaces the block to Claude Code, and exits with a non-zero code; otherwise passes through silently

**Handler contract:** each handler exports a single function that takes the hook payload and returns either `null` (pass) or `{ block: true, message: "..." }` (gate failure). Handlers are independent — one handler's output does not affect another's input.

---

## Coexistence with Installed Plugins

**Superpowers** registers a `SessionStart` hook. Claude Code runs both in sequence: Superpowers fires first (injects skill context into the session), then truss fires (initialises missing files, validates config). No conflict.

**Context7** has no hooks — it is a pure MCP server. Truss never interacts with it.

Truss is the only plugin registering `PreToolUse`, `PostToolUse`, and `Stop`. No ordering concerns on those events.

---

## Configuration: `truss.toml`

All fields are optional. Safe defaults apply when fields are missing or the file does not exist.

```toml
[gates]
read_before_write = true      # block edits to files not read this session
failure_ledger    = true      # check failure ledger before edits
spec_gate         = true      # require approved criteria before coding

[routing]
stale_threshold = 10          # unread-change count before routing decisions to developer

[model]
classifier  = "haiku"         # model used for difficulty scoring
thresholds  = [4, 7]          # 1–4 → haiku, 5–7 → sonnet, 8–10 → opus

[log]
events = true                 # append to EVENTS.log
```

**Missing file:** `SessionStart` creates `truss.toml` from the template silently.

**Malformed file:** truss loads safe defaults for all values, appends a warning to `EVENTS.log`, and injects a one-line note into the session context so Claude surfaces it at the start of the session. The session continues normally.

---

## File Formats

### `EVENTS.log`
Append-only. One JSON object per line.

```jsonl
{"ts":"2026-07-07T10:00:00Z","event":"ToolUse","tool":"Edit","file":"src/foo.js","cost_tokens":312}
{"ts":"2026-07-07T10:00:01Z","event":"Gate","gate":"ReadBeforeWrite","file":"src/bar.js","result":"blocked"}
{"ts":"2026-07-07T10:00:02Z","event":"ModelRoute","task_score":6,"model":"sonnet"}
{"ts":"2026-07-07T10:00:03Z","event":"ConfigWarning","reason":"malformed truss.toml — using defaults"}
```

### `STATE.md`, `CONVENTIONS.md`, `BRIEF.md`
Plain markdown. Pre-populated with section headers and one-line descriptions of purpose by `SessionStart/init.js` if missing. The agent fills them in; the developer edits them to steer.

---

## Install Mechanism

### Phase 1 — Local testing (now)

`npm run dev-install` does three things:

1. Symlinks `~/.claude/plugins/cache/local/truss/dev/` → repo root, mirroring the structure the marketplace installer uses
2. Registers the plugin in `~/.claude/plugins/installed_plugins.json`
3. Adds `"truss@local": true` to `enabledPlugins` in `~/.claude/settings.json`

`npm run dev-uninstall` reverses all three steps.

Claude Code sees a dev-installed plugin identically to a marketplace-installed one.

### Phase 2 — Publishing (later)

1. Push the repo to GitHub
2. Create a thin marketplace index repo (a JSON manifest listing truss as an available plugin — same pattern as `obra/superpowers-marketplace`)
3. Users install with `claude plugin install truss@your-marketplace`

No changes to the plugin structure are required between phase 1 and phase 2.

---

## Build Order

The scaffold is step 1 of 7:

1. **Scaffold** (this doc) — plugin structure, dispatcher, file templates, install scripts
2. Read-Before-Write Gate — `PreToolUse` hook, deterministic, zero LLM calls
3. Failure Ledger — `PreToolUse` + `PostToolUse` hooks, structured file
4. Spec Gate — human-approval flow before coding begins
5. Comprehension Pile + Model Routing — staleness tracking, decision routing, difficulty classifier
6. BRIEF.md — agent-maintained per-module summaries
7. Coworker Mode — wraps Superpowers' brainstorming skill with plain-language output
