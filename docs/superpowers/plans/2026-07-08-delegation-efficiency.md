# Delegation Efficiency + Skill Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three components from `docs/superpowers/specs/2026-07-08-delegation-efficiency-design.md` — fan-out research, a plugin-agnostic subagent report schema, and a `DECISIONS.log` audit trail — closing the instruction-only-step-gets-silently-skipped gap found in `research` and `big-brain` this session.

**Architecture:** Four independent, additive changes, each touching one surface: (1) `hooks/lib/config.js` gains a new `[log] decisions` default (real code, TDD). (2) `skills/research/SKILL.md`'s Step 3 gains fan-out dispatch + a confirm-step trace (skill text). (3) `skills/big-brain/SKILL.md` gains a `DECISIONS.log` append instruction (skill text). (4) `CLAUDE.md` gains the plugin-agnostic report schema rule and lists `DECISIONS.log` as a control-surface file (project instructions). Skill-text and CLAUDE.md changes are verified the same way this repo already verifies `plain-speak`'s prior rewrite: a `node:test` assertion that greps the file for required content markers — not unit tests of behavior, since none of these three are hook-executed code.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert`, `fs`, `path`). Markdown skill/doc files. No new npm dependencies.

## Global Constraints

- **Node stdlib only** — no npm dependencies may be added.
- **TDD** — write the failing test first, run it to confirm it fails, then implement.
- **Ponytail minimalism** — smallest diff that works; no unrequested abstractions. No new skill file, no "report adapter" subsystem, no hook-enforced version of any of these three fixes (all rejected during brainstorming — see the design doc's "Not in scope" section).
- **`DECISIONS.log` is lazily created** — no template file in `templates/`, same pattern as `RESEARCH.md`/`GLOSSARY.md`. Never pre-created by this plan; only appended to by future skill invocations.
- **No changes to `dispatch.js` or `hooks/session-start/init.js`** — none of these four tasks touch hook dispatch.
- Test runner: `npm test` runs `node --test $(find tests -name '*.test.js')`.
- Existing skill-doc test pattern to follow (from `tests/skills/skills.test.js`): `assert.match(content, /regex/, 'message')` against the raw file text — this plan's Tasks 2–4 use the same pattern.

---

### Task 1: `[log] decisions` config default

**Files:**
- Modify: `hooks/lib/config.js:4-9` (the `DEFAULTS` object)
- Modify: `hooks/lib/config.test.js`
- Modify: `truss.toml` (project's own config — dogfooding, same precedent as the auto-compact task committing real `[context]` values)

**Interfaces:**
- Consumes: nothing new.
- Produces: `config.log.decisions` (boolean, default `true`), read by later skill-text instructions (Tasks 2–3) as an advisory toggle — same pattern as the existing `config.log.events` toggle already read by `hooks/post-tool-use/events-log.js`, except this one is checked by Claude's own judgment when appending to `DECISIONS.log`, not by a hook (no hook can observe a `big-brain` delegation or a report's `decisions` field — that's the whole reason this stays instruction-based).

- [ ] **Step 1: Write the failing test**

Add this test to `hooks/lib/config.test.js`, after the existing `returns defaults when truss.toml is missing` test:

```javascript
test('log.decisions defaults to true', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.log.decisions, true);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test hooks/lib/config.test.js`
Expected: FAIL — `config.log.decisions` is `undefined`, not `true`.

- [ ] **Step 3: Add the default**

In `hooks/lib/config.js`, change:

```javascript
const DEFAULTS = {
  gates:   { failure_ledger: true, auto_compact: true },
  model:   { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
  log:     { events: true },
  context: { context_max: 200000, threshold: 0.6 },
};
```

to:

```javascript
const DEFAULTS = {
  gates:   { failure_ledger: true, auto_compact: true },
  model:   { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
  log:     { events: true, decisions: true },
  context: { context_max: 200000, threshold: 0.6 },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test hooks/lib/config.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus this new one.

- [ ] **Step 6: Update the project's own `truss.toml`**

In `truss.toml`, change:

```toml
[log]
events = true                 # append every tool call to EVENTS.log
```

to:

```toml
[log]
events    = true              # append every tool call to EVENTS.log
decisions = true               # append big-brain delegations and report decisions to DECISIONS.log
```

- [ ] **Step 7: Commit**

```bash
git add hooks/lib/config.js hooks/lib/config.test.js truss.toml
git commit -m "feat: add [log] decisions config default for DECISIONS.log"
```

---

### Task 2: Fan-out research + confirm-step trace

**Files:**
- Modify: `skills/research/SKILL.md`
- Modify: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: `config.log.decisions` (Task 1) — advisory only, checked before appending the confirm-step trace line.
- Produces: the fan-out dispatch pattern later research invocations follow; no other task depends on this one's output directly.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/skills/skills.test.js`, after the existing `research skill documents truss-skills/research.md override` test:

```javascript
test('research skill documents fan-out dispatch and confirm-step trace', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/research/SKILL.md'), 'utf8');
  assert.match(content, /2\+ items/, 'must document the fan-out threshold');
  assert.match(content, /one subagent per item/, 'must document per-item subagent dispatch');
  assert.match(content, /Confirmed with user/, 'must document the confirm-step trace format');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — current `SKILL.md` has none of these three markers.

- [ ] **Step 3: Rewrite the skill**

Replace `skills/research/SKILL.md` with:

```markdown
---
name: research
description: Use when brainstorming or planning with the user, before finalizing any plan or spec — and also in plain conversation whenever the user names an unfamiliar library/API, asks what the current best/frontier method for something is, or you're about to state a frontier/SOTA claim from memory. Researches the external libraries, APIs, algorithms, and techniques relied on and records findings (when planning) or just answers with sources (in conversation), so answers rest on verified facts and known prior art instead of assumptions, stale memory, or reinvented wheels.
---

# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

Before following the rules below, check `truss-skills/research.md` in the project root — if it exists, follow that file's content instead of what follows here.

## Rule

For **every** bit of information, whether it is a framework, API, library, algorithm, or technique, research properly to ensure the information you use is correct — regardless of how confident you feel. Do not ask yourself "am I unsure about this?"; that self-check is exactly what fails. If the plan touches it, research it.

When the plan involves designing an algorithm or approach (not just calling a library), also do a **prior-art check**: search for existing documented methods that solve the same problem before designing a new one. Record methods considered and rejected, with why — not just the one chosen. Goal is to avoid rediscovering or reinventing what is already published.

Prefer primary sources: papers (arXiv etc.), official docs/specs, standards bodies. Treat blogs/forums as secondary — usable, but noted as lower-confidence in the entry.

Lazy-developer framing: finding a documented answer is cheaper than deriving one from memory. Search first, invent second — same instinct as reuse-over-build, applied to knowledge instead of code.

## Casual conversation (not brainstorming/planning)

Full ritual below is for plans/specs. In plain chat, lighter version:

- User asks "what's the current best way to do X" / names unfamiliar lib or API / you're about to assert a frontier or SOTA claim → search (context7 for libs/APIs, WebSearch/WebFetch for algorithms/frontier work) before answering.
- Cite what you found, answer directly. No user confirm-list step — that ceremony is for plans, not one-off questions. No fan-out either — a single lookup doesn't benefit from it.
- Still log it (see step 4) if the finding could matter to a future decision. Skip logging only for trivial lookups (e.g. "what's the current npm version") with no forward value.
- If the conversation turns into a plan the user wants to act on, switch to the full Steps below.
- Skip this whole thing for routine debugging/local-code questions — no search value there.

## Steps

1. **Check `RESEARCH.md` first.** Skip anything with a relevant, current entry — do not re-research it.
2. **Compile the research list and confirm with the user.** List every external library, API, framework, algorithm, or unfamiliar pattern the plan touches that is not already covered. Show this list to the user and ask whether they want to add anything before you begin; incorporate their additions. This is a prompt-and-continue, not an approval gate. (Casual conversation skips this step — see above.) Note whether the user added anything — this is recorded in each entry's `Confirmed with user` line in Step 4.
3. **Research each item, routed by kind:**
   - **Library/API/framework docs** → context7 first (resolve the library, query its docs). Fall back to WebSearch / WebFetch for anything context7 does not cover.
   - **Algorithm/technique/prior-art** → context7 will not have this. Go straight to WebSearch/WebFetch for papers, surveys, and reference implementations. Look specifically for existing solutions to the same problem, not just background theory.
   - **Fan-out when the confirmed list (Step 2) has 2+ items.** Spawn one subagent per item, in parallel (a single message, multiple `Agent` tool calls, `subagent_type: general-purpose`). Each subagent's prompt contains only: the one item, its kind (library/API vs. algorithm/prior-art, routing it per the rules above), and the exact entry format from Step 4 to return as its sole output — nothing else from the wider plan or conversation. Wait for all subagents to return, then write every returned entry into `RESEARCH.md` yourself, sequentially, in one pass — subagents never write the file directly, avoiding concurrent-write races on a shared file. A list of exactly 1 item stays inline — no subagent spawned, nothing to gain from fanning out a single item.
4. **Record findings in `RESEARCH.md`, sorted into two sections.** Create the file if it does not exist, with both headers:

   ```
   # Verified
   # Avoid
   ```

   Append entries under the matching header — never overwrite an existing entry.

   **`# Verified`** — usable, sourced, goes into plans/code:

   ## <library / API / algorithm / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query> | Paper: <citation/link>
   Source confidence: primary (paper/official doc/spec) | secondary (blog/forum)
   Findings: <what was verified, in plain language>
   Used in: <the spec/plan file this informed, or "casual — <topic>" if outside a plan>
   Confirmed with user: yes | additions: <none/list> (omit this line for casual-conversation entries — Step 2's confirm-list only happens in the full ritual)

   **`# Avoid`** — tried, considered, or found broken; kept so it isn't retried:

   ## <library / API / algorithm / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query> | Paper: <citation/link>
   Why avoid: <deprecated, doesn't work, wrong fit, superseded by X, etc.>
   Found while researching: <the item/plan this came up during>

Fold the verified facts into the plan as you build it. Check `# Avoid` before proposing an approach — don't re-suggest something already ruled out.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus this new one.

- [ ] **Step 6: Commit**

```bash
git add skills/research/SKILL.md tests/skills/skills.test.js
git commit -m "feat: fan-out research to parallel subagents, trace confirm-step"
```

---

### Task 3: `big-brain` delegation trace to `DECISIONS.log`

**Files:**
- Modify: `skills/big-brain/SKILL.md`
- Modify: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: `config.log.decisions` (Task 1) — advisory only.
- Produces: the `DECISIONS.log` line format (`YYYY-MM-DD HH:MM | big-brain | <question> | verdict: <conclusion>`), also relied on by Task 4's CLAUDE.md text (which describes the `report`-tagged line using the same file and format).

- [ ] **Step 1: Write the failing test**

Add this test to `tests/skills/skills.test.js`, after the existing `big-brain skill documents truss-skills/big-brain.md override` test:

```javascript
test('big-brain skill documents DECISIONS.log trace', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../skills/big-brain/SKILL.md'), 'utf8');
  assert.match(content, /DECISIONS\.log/, 'must document the decision log');
  assert.match(content, /verdict:/, 'must document the log line format');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — current `SKILL.md` has neither marker.

- [ ] **Step 3: Rewrite the skill**

Replace `skills/big-brain/SKILL.md` with:

```markdown
---
name: big-brain
description: Use at any hard decision point — evaluating competing approaches, an architecture call, stress-testing or reviewing a design, a choice that's expensive to get wrong. Delegate unconditionally when a decision like this appears; do not first ask yourself whether it's hard enough to need it. Delegates the analysis to a stronger subagent instead of deciding it alone.
---

# Big Brain

Some decisions are cheap to get wrong. Some aren't. When you hit one that isn't — don't reason it through yourself. Delegate it.

Before following the rules below, check `truss-skills/big-brain.md` in the project root — if it exists, follow that file's content instead of what follows here.

## When this applies

- Evaluating competing approaches or architectures.
- Stress-testing or reviewing a design before committing to it.
- A decision that's expensive to unwind if it turns out wrong.

This list is illustrative, not exhaustive. **Delegate unconditionally when a decision like this appears — do not first ask yourself "is this hard enough to need it?"** That self-check is exactly the judgment that fails, the same failure mode `truss:research` exists to prevent. Noticing the decision is the trigger, not a reason to evaluate whether it qualifies.

## What to do (coordinator)

Delegate the analysis to a subagent running the `thinking` model from `truss.toml [model]` (default `opus`). Give it the concrete question and enough context to reason about it in isolation, then relay its conclusion back into the conversation.

Never delegate the conversation itself — only a self-contained analytical question. A subagent cannot talk to the user.

After relaying the conclusion, append one line to `DECISIONS.log` (create the file if it doesn't exist yet — same lazy-creation pattern as `RESEARCH.md`):

```
YYYY-MM-DD HH:MM | big-brain | <one-line question> | verdict: <one-line conclusion>
```

This is the only record of whether a hard decision actually got delegated — without it, there's no way to check after the fact that this skill fired when it should have. Skip only if `truss.toml`'s `[log] decisions` is explicitly set to `false`.

## What to do (delegated subagent)

Your job here is to **reason and decide**, not to re-research from scratch. Check `RESEARCH.md` first and work from what's already there. Only research a specific fact if it is genuinely missing and the decision hinges on it — research should be the exception in this role, not the default first move. Spend your effort on the analysis itself: comparing the options, finding the flaw, making the call.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus this new one.

- [ ] **Step 6: Commit**

```bash
git add skills/big-brain/SKILL.md tests/skills/skills.test.js
git commit -m "feat: trace big-brain delegations to DECISIONS.log"
```

---

### Task 4: Plugin-agnostic report schema in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`
- Create: `tests/claude-md.test.js`

**Interfaces:**
- Consumes: `DECISIONS.log`'s line format (Task 3) — the `report`-tagged line reuses the same file and a matching format (`YYYY-MM-DD HH:MM | report | <decision>`).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Write the failing test**

Create `tests/claude-md.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/claude-md.test.js`
Expected: FAIL — `CLAUDE.md` has none of these markers yet.

- [ ] **Step 3: Update `CLAUDE.md`**

In `CLAUDE.md`, change this line in the `## Truss` section:

```markdown
- Truss files are the control surface: `STATE.md` (where we are), `RESEARCH.md` (what's known), `CONVENTIONS.md`, `GLOSSARY.md` (taught vocabulary), `EVENTS.log` (auto tool log), `truss.toml` (config). Read/update them, don't invent parallel scratch files.
```

to:

```markdown
- Truss files are the control surface: `STATE.md` (where we are), `RESEARCH.md` (what's known), `CONVENTIONS.md`, `GLOSSARY.md` (taught vocabulary), `DECISIONS.log` (big-brain delegations + subagent report decisions, auditable), `EVENTS.log` (auto tool log), `truss.toml` (config). Read/update them, don't invent parallel scratch files.
- **Subagent completion reports, any workflow:** whatever completion-report artifact the active development workflow produces (Superpowers' `subagent-driven-development` task reports, another plugin's equivalent, or a plain reply if none is active), it opens with a fixed schema before any free-form narrative:
  ```
  status: DONE | BLOCKED
  commit: <hash>
  files_changed: <list>
  tests: <before X/Y pass> -> <after X/Y pass>
  decisions: <one line each, only if the brief was deviated from>
  blockers: <one line each, or "none">
  ```
  Prose is still allowed below the schema block. Don't hard-code this to any one plugin's file path — the schema is a property of any subagent report, the artifact's location isn't. The `decisions` field also gets appended, one line per entry, to `DECISIONS.log` (`YYYY-MM-DD HH:MM | report | <decision>`) — this keeps the rule auditable even though truss doesn't own the report file itself.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/claude-md.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus these new ones.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md tests/claude-md.test.js
git commit -m "docs: plugin-agnostic subagent report schema + DECISIONS.log control surface"
```

---

## Manual Verification (human, not a subagent)

Instruction-based skill/doc changes can't be asserted by `node:test` beyond "the text is present" — same limitation as every other truss skill. After all four tasks are committed:

- [ ] Trigger a real `research` cycle (brainstorming/planning) with 2+ items in the confirmed list. Confirm parallel `Agent` dispatches happen (not sequential inline research) and `RESEARCH.md` ends up with all entries correctly written, including the `Confirmed with user` line.
- [ ] Trigger a real `big-brain` delegation. Confirm `DECISIONS.log` is created (if it didn't exist) and gets a `big-brain`-tagged line with question + verdict.
- [ ] Complete a real subagent task (via `subagent-driven-development` or otherwise). Confirm the completion report opens with the six-field schema, and if a `decisions` field is non-empty, confirm `DECISIONS.log` gets the matching `report`-tagged line.
