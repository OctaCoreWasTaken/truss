# Truss Reset Command + Plain-Speak/STATE.md/GLOSSARY.md Removal

## Motivation

- Caveman (phrasing) and plain-speak (depth/jargon) were meant to layer, but plain-speak's hard-gate injection made explanations read as full prose regardless of caveman being active. User wants caveman as the sole phrasing/depth rule going forward and plain-speak removed rather than debugged.
- STATE.md was a manual, human-maintained duplicate of what plain-speak's design docs already tracked in `docs/superpowers/`. With plain-speak gone, its main consumer/rationale goes with it.
- GLOSSARY.md's only producer was plain-speak's "vocabulary tracking" instruction. No skill will write to or read it once plain-speak is removed.
- There is currently no way to return a truss-instrumented project to a clean first-session state without manually deleting files. Needed for testing truss itself and for starting a project over without losing the audit trail (`EVENTS.log`).

## Scope

### 1. Remove plain-speak

Delete:
- `skills/plain-speak/`
- `hooks/session-start/teach.js`
- `tests/session-start/teach.test.js`

Edit:
- `hooks/lib/config.js` — drop `plain_speak` from `DEFAULTS.gates`
- `truss.toml`, `templates/truss.toml` — drop the `plain_speak` line from `[gates]`
- `tests/lib/config.test.js` — drop plain-speak assertions
- `tests/skills/skills.test.js` — drop plain-speak assertions
- `CLAUDE.md` — "Three shipped skills" → "Two shipped skills"; remove any plain-speak reference

### 2. Remove STATE.md

Delete:
- `STATE.md`
- `templates/STATE.md`

Edit:
- `hooks/session-start/init.js` — remove `'STATE.md'` from the `TEMPLATES` array
- `tests/session-start/init.test.js` — drop STATE.md assertions
- `CLAUDE.md` — remove `STATE.md` from the control-surface file list

### 3. Remove GLOSSARY.md

Delete:
- `GLOSSARY.md`

Edit:
- `CLAUDE.md` — remove `GLOSSARY.md` from the control-surface file list

Out of scope: `docs/superpowers/plans/*`, `docs/superpowers/specs/*`, `.superpowers/sdd/*`, `proposal.md` — historical/design records, not truss runtime state. Left untouched even though some reference plain-speak/STATE.md by name.

### 4. New `truss:reset` skill

**`scripts/reset.js`** (deterministic, follows the `dev-install.js`/`dev-uninstall.js` pattern already in `scripts/`):
- Delete `RESEARCH.md` and `DECISIONS.log` if present (both are lazily recreated by `truss:research` / `truss:big-brain` the next time they're needed — same lazy-creation pattern already used for those files)
- Overwrite `truss.toml` with the contents of `templates/truss.toml`
- Overwrite `CONVENTIONS.md` with the contents of `templates/CONVENTIONS.md`
- Leave `EVENTS.log` untouched — this is the one thing the user explicitly wants preserved across a reset
- Leave `settings.local.json`, `docs/superpowers/*`, `.superpowers/*` untouched — not truss-owned state
- Exposed as a function so it's directly unit-testable, plus a `require.main === module` CLI entry point so `node scripts/reset.js` works standalone

**`skills/reset/SKILL.md`**: minimal skill — frontmatter `name: reset`, description covering "user asks to reset/wipe truss state." Body: run `node scripts/reset.js` via Bash, then report which files were touched. No independent logic in the skill itself — it delegates entirely to the script so behavior is deterministic rather than instruction-followed.

Invocation: `/truss:reset` (user, in chat) or the Skill tool with `skill: "truss:reset"` (me). Same underlying script either way.

### Testing

- `tests/scripts/reset.test.js`: sets up a temp project dir with all the target files present (including some with modified content, to prove overwrite works), runs `reset.js`, asserts:
  - `RESEARCH.md`, `DECISIONS.log` are gone
  - `truss.toml` content matches `templates/truss.toml`
  - `CONVENTIONS.md` content matches `templates/CONVENTIONS.md`
  - `EVENTS.log` content is unchanged
- Update existing tests per the edits listed in sections 1–2 above so the full suite reflects the removals (no test should still assert plain-speak/STATE.md behavior).

## Error handling

`reset.js` treats every target file as optional — a missing `RESEARCH.md`/`DECISIONS.log` (nothing to delete) or missing `truss.toml`/`CONVENTIONS.md` (nothing to overwrite, just write the template fresh) is not an error, matching `init.js`'s existing "create if missing" tolerance.
