# Plain-Speak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `truss:plain-speak`, a static skill that keeps conversational explanations jargon-free and short during brainstorming/planning.

**Architecture:** A single new skill file, `skills/plain-speak/SKILL.md`, following the exact shipping pattern already used for `skills/research/SKILL.md`, `skills/big-brain/SKILL.md`, and `skills/model-routing/SKILL.md` — a static markdown file with YAML frontmatter, auto-discovered by Claude Code, no dynamic generation, no `plugin.json` change, no hooks, no config.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert`, `fs`, `path`). Markdown skill file.

## Global Constraints

- **Node stdlib only** — no npm dependencies may be added.
- **TDD** — write the failing test first, run it to confirm it fails, then implement.
- **Ponytail minimalism** — smallest diff that works; no unrequested abstractions.
- **Skills auto-discover** from `skills/*/SKILL.md` — do **not** touch `plugin.json`.
- **This governs conversational dialogue only** — it must not reference or alter `RESEARCH.md`'s content or format.
- **Not Caveman-style compression** — the skill content must use normal, well-formed sentences; it asks for fewer of them, not fragmented/broken grammar.
- Test runner: `npm test` runs `node --test $(find tests -name '*.test.js')`.

---

### Task 1: Ship the plain-speak skill

**Files:**
- Create: `skills/plain-speak/SKILL.md`
- Modify: `tests/skills/skills.test.js`

**Interfaces:**
- Consumes: the existing `assertValidFrontmatter(skillPath)` helper already defined in `tests/skills/skills.test.js` (no signature change).
- Produces: nothing consumed by other tasks — this is the only task in the plan.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/skills/skills.test.js`, after the existing `big-brain skill has valid frontmatter` test:

```javascript
test('plain-speak skill has valid frontmatter', () => {
  assertValidFrontmatter(path.join(__dirname, '../../skills/plain-speak/SKILL.md'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/skills/skills.test.js`
Expected: FAIL — `ENOENT: no such file or directory, open '.../skills/plain-speak/SKILL.md'` (4 tests, 1 fail, 3 pass).

- [ ] **Step 3: Write the skill**

Create `skills/plain-speak/SKILL.md`:

```markdown
---
name: plain-speak
description: Use when explaining domain-specific or technical concepts during brainstorming or planning to someone who may not have specialized background in that field. Keeps explanations jargon-free, short, and information-dense instead of long technical paragraphs.
---

# Plain-Speak

When brainstorming or planning touches unfamiliar or technical territory, explain it so someone without specialized background in that field can follow — without losing precision.

## Rule

- Define or expand a technical term in plain language the first time it appears, rather than assuming familiarity.
- State the plain-language explanation **alongside** the technical term, not instead of it — this builds real vocabulary instead of just hiding the term.
- Use an analogy only when it builds real intuition, not as decoration.
- **Keep explanations short and information-dense.** A human explaining a complex system to a colleague says the essential thing in a few sentences, not a sprawling paragraph — a wall of text is exactly how a reader gets lost in a complex system, which defeats this skill's own purpose. Add length only when the specific complexity actually demands it, never as a default.
- This is **not** the same as `Caveman`'s compression style — no fragmented sentences, no dropped grammar. Normal, well-formed sentences; just fewer of them.

## Scope

This governs what you **say**, not what you write to `RESEARCH.md`. Research findings stay precise and technical there — it's a reference for later sessions too, where precision matters more than accessibility.

## Persistence

This is a style, not a one-time action — unlike `truss:research` or `truss:big-brain`, which are single steps you take and finish. Once this applies, keep applying it for the rest of the current brainstorming or planning activity, not just the response that triggered it. Stays active until that activity ends or the conversation moves off technical/domain-specific territory.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/skills/skills.test.js`
Expected: PASS (4 tests, 4 pass).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus this new one (39 tests total, 39 pass).

- [ ] **Step 6: Commit**

```bash
git add skills/plain-speak/SKILL.md tests/skills/skills.test.js
git commit -m "feat: add truss:plain-speak skill (jargon-free, short dialogue during planning)"
```

---

## Manual Verification (human, not a subagent)

Skill discovery and behavior can't be asserted by `node:test` — same limitation as `research`/`big-brain`/`model-routing`. After this task is committed and merged:

- [ ] Push to `master`, then `claude plugin uninstall truss@truss-dev --scope user && claude plugin marketplace update truss-dev && claude plugin install truss@truss-dev`.
- [ ] Open a fresh session and confirm `truss:plain-speak` appears alongside the other three skills.
- [ ] During a brainstorming/planning task that touches an unfamiliar technical concept, confirm explanations define jargon inline, stay a few sentences rather than sprawling, and the style persists across multiple responses in that activity — not just the first one.
