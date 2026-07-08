# Delegation Efficiency + Skill Hardening — Design

## Goal

Push truss's token efficiency further via deeper subagent delegation, and close audit gaps found in the three shipped skills (`research`, `big-brain`, `plain-speak`) where an instruction-only step can be silently skipped with no way to catch it after the fact — the same failure class that let `plain-speak`'s `GLOSSARY.md` tracking go unenforced this session.

Not in scope (researched and rejected during brainstorming, see `RESEARCH.md`):
- Retroactive tool-call-history pruning/summarization — no Claude Code hook can rewrite a `tool_use`/`tool_result` pair already committed to the transcript. Only the *current* tool's output can be rewritten, via `PostToolUse`'s `updatedToolOutput`, at the moment it's generated.
- Compressing CLI tool output at the source (e.g. shrinking `git status`/`grep` output) — already covered by the user's existing `rtk` tool (measured 17.4% token savings), would be redundant.
- Hook-enforced ("hard gate") versions of any fix here — not buildable. Hooks observe tool calls, not judgment calls like "was this decision hard enough to delegate" or "did I actually explain this in plain language." Same reason truss's own `proposal.md` already killed the "Comprehension Pile" component. All three fixes below stay instruction-based, with a persistent artifact for after-the-fact audit instead of a mechanical gate.

## Component 1: Fan-out research

**Problem:** `truss:research`'s Step 3 (research each confirmed item) currently happens inline, one context, sequentially — items accumulate in the same conversation before `RESEARCH.md` gets written.

**Change:** When the confirmed research list (`truss:research` Step 2) has 2+ items, spawn one subagent per item in parallel — a single message with multiple `Agent` tool calls, `subagent_type: general-purpose` (needs context7 + WebSearch/WebFetch access). Each subagent's prompt contains only: the one item, its kind (library/API vs. algorithm/prior-art — routes it to context7-first or WebSearch-first per the skill's existing Step 3 routing), and the exact `RESEARCH.md` entry format (`# Verified` / `# Avoid` template from the skill) to return as its sole output.

The orchestrator waits for all subagents to return, then writes every returned entry into `RESEARCH.md` itself, sequentially, in one pass — subagents never write the file directly, avoiding concurrent-write races on a shared file.

Lists of exactly 1 item stay inline (no parallelism to gain from fanning out a single item).

Casual-conversation research (`truss:research`'s lighter no-confirm-list path for one-off questions) is unaffected — already a single lookup, fan-out doesn't apply.

**Why this is safe:** each subagent's context is the smallest possible for its job (one item, not the whole plan/conversation) — matches the researched pattern (isolated fan-out subagents measured at ~9K tokens vs. ~15K for a single accumulating context, cited in this session's research).

## Component 2: Plugin-agnostic subagent report schema

**Problem:** Downstream readers of a subagent's completion report (the next task's subagent, a reviewer, whole-branch review) currently read free-form prose to extract a handful of facts (what changed, what was decided, what's blocked).

**Change:** An instruction, not a file template: whatever completion-report artifact the *active* development workflow actually produces — Superpowers' `subagent-driven-development` (`.superpowers/sdd/task-N-report.md`), another plugin's equivalent, or a plain reply if no SDD-style plugin is active — it opens with a fixed schema before any free-form narrative:

```
status: DONE | BLOCKED
commit: <hash>
files_changed: <list>
tests: <before X/Y pass> -> <after X/Y pass>
decisions: <one line each, only if the brief was deviated from>
blockers: <one line each, or "none">
```

Free-form prose is still allowed below the schema block — the schema is what gets scanned first, prose remains for anyone who wants the full narrative.

**Deliberately not hard-coded to Superpowers' file path or a new "report adapter" skill.** Truss is meant to layer on top of whatever plugins are installed, not assume one specific workflow. Baking a specific plugin's private file layout into a shipped truss instruction would break for any user not running that exact plugin. This was evaluated via a `truss:big-brain` delegation during this design's brainstorming — verdict: couple to the concept (a subagent completion report exists), not the path. Once Component 3 ships, this kind of delegation gets logged to `DECISIONS.log` for future reference; this particular one predates the log's existence.

**Audit-trail cost of going plugin-agnostic:** truss can no longer point a hook at a fixed file to verify the schema was used, since it no longer knows the report's path. Mitigation: the `decisions` field also gets appended, one line per entry, to `DECISIONS.log` (Component 3) — the one artifact truss does own regardless of which other plugins are active.

This is one paragraph of instruction plus one append call — not a fourth component, not a shared cross-plugin abstraction.

## Component 3: `DECISIONS.log` + research confirm-step trace

**Problem:** `truss:big-brain` has no persistent trace of its own delegations — unlike `research` (`RESEARCH.md`) and `plain-speak` (`GLOSSARY.md`), there is currently no file to check, after the fact, whether a hard decision actually got delegated to a `thinking`-tier subagent. Separately, `truss:research`'s Step 2 (compile list, confirm with user before researching) is easy to skip silently under task momentum — confirmed in practice this session — and `RESEARCH.md` entries don't currently record whether that step happened.

**Change:** New file `DECISIONS.log`, created lazily on first write (same pattern as `RESEARCH.md`/`GLOSSARY.md` — no pre-creation, no empty scaffold). Append-only, one line per event:

```
YYYY-MM-DD HH:MM | big-brain | <one-line question> | verdict: <one-line conclusion>
YYYY-MM-DD HH:MM | report    | <one-line decision, from a subagent report's "decisions" field>
```

- **`big-brain` delegations:** every dispatch to a `thinking`-tier subagent appends a `big-brain` line — question asked, verdict returned. Makes "did big-brain actually fire on the hard calls" a grep, not a guess.
- **Subagent report decisions** (Component 2): the schema's `decisions` field also appends a `report` line here, keeping the plugin-agnostic report schema auditable even without a known file path.

**`research`'s confirm-step trace:** not a separate log entry — appended directly onto the matching `RESEARCH.md` entry itself (`Confirmed with user: yes | additions: <none/list>`), since `RESEARCH.md` is already structured per-item and this fact belongs next to the finding it produced.

**Config:** `truss.toml` `[log]` section gains one line, matching the existing `events` toggle:

```toml
[log]
events    = true
decisions = true   # append big-brain delegations and report decisions to DECISIONS.log
```

## Testing

All three components are instruction-based (skill text), not hook code — no new automated test suite. Verification is: (1) the next real research cycle with 2+ items produces parallel `Agent` dispatches and a correctly-collated `RESEARCH.md`; (2) the next subagent completion report (regardless of which plugin produces it) opens with the six-field schema; (3) `DECISIONS.log` exists and has an entry after the next `big-brain` delegation. Existing `truss.toml`/config test suite (53 passing) gets one new assertion for the `[log] decisions` default.

## Out of scope / deferred

- A generic "report normalization" subsystem for arbitrary plugins — explicitly rejected by the `big-brain` delegation in this design; the fix is instruction + one log line, nothing more.
- Auto-tuning fan-out threshold (currently fixed at 2+) from observed data — revisit only if real usage shows the fixed threshold is wrong.
