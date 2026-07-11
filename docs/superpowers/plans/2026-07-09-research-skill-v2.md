# Research Skill v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `truss:research`'s trigger with a red-flag table, add an ask-first decide step, and cap the research loop with user-prompted continuation instead of a silent stop.

**Architecture:** Two independent, sequential changes. Task 1 adds a `[research]` config section (`decide`, `max_rounds`) to `hooks/lib/config.js` and both `truss.toml` files, following the exact pattern of the existing `[gates]`/`[context]`/`[log]` sections. Task 2 rewrites `skills/research/SKILL.md` to add the red-flag table, the decide-step, and the capped iterative loop — the existing fan-out mechanism and `RESEARCH.md` entry format are carried over unchanged (renumbered only).

**Tech Stack:** Node.js (`node:test`, `node:assert`), no new dependencies.

## Global Constraints

- Config keys follow the existing `hooks/lib/config.js` `DEFAULTS` shape exactly: `{ section: { key: value } }`, merged over user's `truss.toml` via `mergeWithDefaults`.
- `truss.toml` / `templates/truss.toml` entries use the established style: `key = value      # inline comment`, one section per feature, comment explains what the value controls.
- No hook-based trigger — the design's Non-goals section rules this out explicitly (see `docs/superpowers/specs/2026-07-09-research-skill-v2-design.md`). The trigger stays instruction-based.
- Do not change the fan-out mechanism, subagent prompt shape, or `RESEARCH.md` entry format — carry the existing text over verbatim (only step numbers shift).
- Follow existing `tests/skills/skills.test.js` pattern: read `SKILL.md` as a string, assert with `assert.match(content, /regex/)` — no new test helper needed.

---

### Task 1: `[research]` config section

**Files:**
- Modify: `hooks/lib/config.js`
- Modify: `truss.toml`
- Modify: `templates/truss.toml`
- Test: `tests/lib/config.test.js`

**Interfaces:**
- Produces: `config.research.decide` (string, `"user"` | `"claude"`, default `"user"`) and `config.research.max_rounds` (number, default `3`) — read by `skills/research/SKILL.md`'s prose in Task 2 (not consumed by any hook code; the skill instructs Claude to read `truss.toml` directly).

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/config.test.js`, after the existing `'gates.plain_speak defaults to true'` test:

```javascript
test('research.decide defaults to "user"', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.research.decide, 'user');
  fs.rmSync(tmp, { recursive: true });
});

test('research.max_rounds defaults to 3', () => {
  const tmp = makeTmp();
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.research.max_rounds, 3);
  fs.rmSync(tmp, { recursive: true });
});

test('research config can be overridden', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'truss.toml'), '[research]\ndecide = "claude"\nmax_rounds = 5\n');
  const { config } = loadConfig(tmp);
  assert.strictEqual(config.research.decide, 'claude');
  assert.strictEqual(config.research.max_rounds, 5);
  fs.rmSync(tmp, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 3 new failures — `TypeError: Cannot read properties of undefined (reading 'decide')` (or similar), since `config.research` does not exist yet.

- [ ] **Step 3: Add the `research` section to `DEFAULTS`**

In `hooks/lib/config.js`, change:

```javascript
const DEFAULTS = {
  gates:   { failure_ledger: true, auto_compact: true, plain_speak: true },
  model:   { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
  log:     { events: true, decisions: true },
  context: { context_max: 200000, threshold: 0.6 },
};
```

to:

```javascript
const DEFAULTS = {
  gates:    { failure_ledger: true, auto_compact: true, plain_speak: true },
  model:    { coordinator: 'sonnet', thinking: 'opus', coding: 'haiku', escalation: 'opus' },
  log:      { events: true, decisions: true },
  context:  { context_max: 200000, threshold: 0.6 },
  research: { decide: 'user', max_rounds: 3 },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Document the section in both `truss.toml` files**

In `templates/truss.toml`, append after the `[log]` section:

```toml
[research]
decide     = "user"   # who decides if research is needed: "user" | "claude"
max_rounds = 3         # iterative research rounds before prompting user to continue
```

In this project's own `truss.toml`, append the same block after `[log]`:

```toml
[research]
decide     = "user"   # who decides if research is needed: "user" | "claude"
max_rounds = 3         # iterative research rounds before prompting user to continue
```

- [ ] **Step 6: Commit**

```bash
git add hooks/lib/config.js truss.toml templates/truss.toml tests/lib/config.test.js
git commit -m "feat: add [research] decide/max_rounds config section"
```

---

### Task 2: Rewrite `skills/research/SKILL.md`

**Files:**
- Modify: `skills/research/SKILL.md`
- Test: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: `config.research.decide`, `config.research.max_rounds` from Task 1 (referenced in prose only — the skill tells Claude to read `truss.toml` itself, no code path reads these).
- Produces: no code interface — this task changes skill instruction text only.

- [ ] **Step 1: Write the failing tests**

Add to `tests/skills/skills.test.js`, after the existing `'research skill documents fan-out dispatch and confirm-step trace'` test:

```javascript
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
  assert.match(content, /resets the round counter to 0/, 'must document cap-reset behavior');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 3 new failures — the new content (red-flag table, decide step, cap-reset) does not exist in `SKILL.md` yet.

- [ ] **Step 3: Rewrite `skills/research/SKILL.md`**

Replace the entire file with:

```markdown
---
name: research
description: Use when brainstorming or planning with the user, before finalizing any plan or spec — and also in plain conversation whenever the user names an unfamiliar library/API, asks what the current best/frontier method for something is, or you're about to state a frontier/SOTA claim from memory. Researches the external libraries, APIs, algorithms, and techniques relied on and records findings (when planning) or just answers with sources (in conversation), so answers rest on verified facts and known prior art instead of assumptions, stale memory, or reinvented wheels.
---

# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

Before following the rules below, check `truss-skills/research.md` in the project root — if it exists, follow that file's content instead of what follows here.

## Trigger

If there is even a 1% chance a brainstorming or planning session has started, this skill applies. Do not wait to feel unsure before checking — noticing the moment is the trigger, not a reason to evaluate whether it qualifies.

| Thought | Reality |
|---|---|
| "I'm already confident about this" | Confidence is exactly what fails — that's the rule, not an exception to it. |
| "This is a small/simple task" | Small tasks still touch libraries, APIs, or techniques that can be wrong. |
| "I'll research if I hit a problem" | By the time a problem shows up, it's already baked into the plan. Research before, not after. |
| "This doesn't need a formal skill" | If the skill exists and the trigger applies, use it. |
| "I remember how this works" | Memory is stale by definition — that's what research corrects. |

## Rule

For **every** bit of information, whether it is a framework, API, library, algorithm, or technique, research properly to ensure the information you use is correct — regardless of how confident you feel. Do not ask yourself "am I unsure about this?"; that self-check is exactly what fails. If the plan touches it, research it.

When the plan involves designing an algorithm or approach (not just calling a library), also do a **prior-art check**: search for existing documented methods that solve the same problem before designing a new one. Record methods considered and rejected, with why — not just the one chosen. Goal is to avoid rediscovering or reinventing what is already published.

Prefer primary sources: papers (arXiv etc.), official docs/specs, standards bodies. Treat blogs/forums as secondary — usable, but noted as lower-confidence in the entry.

Lazy-developer framing: finding a documented answer is cheaper than deriving one from memory. Search first, invent second — same instinct as reuse-over-build, applied to knowledge instead of code.

## Casual conversation (not brainstorming/planning)

Full ritual below is for plans/specs. In plain chat, lighter version:

- User asks "what's the current best way to do X" / names unfamiliar lib or API / you're about to assert a frontier or SOTA claim → search (context7 for libs/APIs, WebSearch/WebFetch for algorithms/frontier work) before answering.
- Cite what you found, answer directly. No user confirm-list step — that ceremony is for plans, not one-off questions. No fan-out either — a single lookup doesn't benefit from it.
- Still log it (see step 5) if the finding could matter to a future decision. Skip logging only for trivial lookups (e.g. "what's the current npm version") with no forward value.
- If the conversation turns into a plan the user wants to act on, switch to the full Steps below.
- Skip this whole thing for routine debugging/local-code questions — no search value there.

## Steps

1. **Check `RESEARCH.md` first.** Skip anything with a relevant, current entry — do not re-research it.

2. **Decide whether research is needed at all.** Not every brainstorm or plan touches an external library, API, or technique. The decision owner is set by `truss.toml`'s `[research] decide` (default `"user"`):
   - `decide = "user"` (default): ask the user directly, e.g. `AskUserQuestion` with "Does this need research (external libs/APIs/algorithms), or is it self-contained?"
   - `decide = "claude"`: skip the ask, judge it yourself — still bound by the Trigger red-flag table above, so "I'm confident" is not grounds to skip.
   If the answer is no, stop here — nothing further in this skill applies to this task.

3. **Compile the research list and confirm with the user.** List every external library, API, framework, algorithm, or unfamiliar pattern the plan touches that is not already covered. Show this list to the user and ask whether they want to add anything before you begin; incorporate their additions. This is a prompt-and-continue, not an approval gate. (Casual conversation skips this step — see above.) Note whether the user added anything — this is recorded in each entry's `Confirmed with user` line in Step 5.

4. **Research each item, routed by kind:**
   - **Library/API/framework docs** → context7 first (resolve the library, query its docs). Fall back to WebSearch / WebFetch for anything context7 does not cover.
   - **Algorithm/technique/prior-art** → context7 will not have this. Go straight to WebSearch/WebFetch for papers, surveys, and reference implementations. Look specifically for existing solutions to the same problem, not just background theory.
   - **Fan-out when the confirmed list (Step 3) has 2+ items.** Spawn one subagent per item, in parallel (a single message, multiple `Agent` tool calls, `subagent_type: general-purpose`). Each subagent's prompt contains only: the one item, its kind (library/API vs. algorithm/prior-art, routing it per the rules above), and the exact entry format from Step 5 to return as its sole output — nothing else from the wider plan or conversation. Wait for all subagents to return, then write every returned entry into `RESEARCH.md` yourself, sequentially, in one pass — subagents never write the file directly, avoiding concurrent-write races on a shared file. A list of exactly 1 item stays inline — no subagent spawned, nothing to gain from fanning out a single item.

5. **Record findings in `RESEARCH.md`, sorted into two sections.** Create the file if it does not exist, with both headers:

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
   Confirmed with user: yes | additions: <none/list> (omit this line for casual-conversation entries — Step 3's confirm-list only happens in the full ritual)

   **`# Avoid`** — tried, considered, or found broken; kept so it isn't retried:

   ## <library / API / algorithm / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query> | Paper: <citation/link>
   Why avoid: <deprecated, doesn't work, wrong fit, superseded by X, etc.>
   Found while researching: <the item/plan this came up during>

6. **Decide whether another round is needed.** After a round returns, check the findings against the original list from Step 3 — did anything surface a genuinely new unknown worth researching, or is the list covered? If covered, stop; the research is done for this task.

   If another round is warranted, check the round counter against `truss.toml`'s `[research] max_rounds` (default `3`):
   - Under the cap: increment the counter, go back to Step 3 for the new items, continue.
   - At the cap: do not silently stop. Ask the user: "Research cap reached (`max_rounds`) — continue researching, or proceed with what's gathered?" Yes resets the round counter to 0 and continues from Step 3. No proceeds with what's already in `RESEARCH.md`.

Fold the verified facts into the plan as you build it. Check `# Avoid` before proposing an approach — don't re-suggest something already ruled out.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass, including the 3 new ones and every pre-existing `skills.test.js` assertion (fan-out threshold, confirm-step trace, override path — all carried over verbatim in the rewrite).

- [ ] **Step 5: Commit**

```bash
git add skills/research/SKILL.md tests/skills/skills.test.js
git commit -m "feat: research skill red-flag trigger, decide-step, capped iterative loop"
```

---

## Self-Review Notes

- **Spec coverage:** all 5 design sections have a task — Trigger + Decide-step + Iterative loop/cap in Task 2, Config in Task 1. Fan-out and Recording are explicitly unchanged (Non-goals), carried over verbatim.
- **No placeholders:** every step has complete file content or exact test code, no "TBD"/"similar to above".
- **Type consistency:** `config.research.decide` (string) and `config.research.max_rounds` (number) match between Task 1's `DEFAULTS` and Task 2's prose references — same names throughout.
