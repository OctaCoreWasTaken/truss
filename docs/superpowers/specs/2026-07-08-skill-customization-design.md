# Truss — Skill Customization (`truss-skills/`) Design

**Date:** 2026-07-08
**Scope:** v0 — a project-level override mechanism letting the user replace any of truss's three skills' instruction text directly, without going through Claude or a plan/brainstorm cycle each time.

---

## Overview

Motivation: truss's skills (`plain-speak`, `research`, `big-brain`) currently ship as `SKILL.md` files inside the plugin package itself, installed via the marketplace into `~/.claude/plugins/cache/truss-dev/truss/<version>/`. Editing those files directly isn't durable for an end user — a future `claude plugin uninstall/marketplace update/install` cycle (truss's own routine dev loop) reinstalls the plugin fresh from git, silently discarding any local edit. The user wants to reshape a skill's instructions (starting with `plain-speak`'s tone/role) to their own liking, durably, without needing a new brainstorm/plan/implementation cycle every time they want to adjust the wording.

Reuses truss's existing "files as control surface" philosophy: `STATE.md`, `RESEARCH.md`, `CONVENTIONS.md`, `GLOSSARY.md`, and `truss.toml` already live in the project being worked on, not inside the plugin package, so they persist across plugin reinstalls naturally and are already user-editable. This spec extends that pattern to skill instruction text itself.

## Mode: override, not augment

A user's override file **replaces** the shipped skill's instructions wholesale, rather than adding to them. This was an explicit, informed choice: the alternative (augment — user content adds to the shipped baseline, both apply) is safer against future truss updates (a new shipped rule always reaches the user), but override gives full control, including removing or contradicting a shipped rule. The accepted trade-off: once a skill is overridden, a future truss update to that skill's shipped text stops reaching the user silently. No mechanism is built to warn about this (see Deferred).

## Location: `truss-skills/`

A new directory at the project root, one file per overridable skill:

```
truss-skills/
  plain-speak.md
  research.md
  big-brain.md
```

Lazily created — not template-scaffolded by `init.js`, only exists once the user writes one. Files are plain instruction text, no YAML frontmatter — skill discovery (the `name`/`description` the `Skill` tool and skill-listing use to decide when to invoke a skill) is a Claude Code platform mechanism truss cannot intercept, so frontmatter always stays governed by the shipped file regardless of any override; only the **body** — the rules a skill follows once active — is override-able.

A dedicated directory (rather than flat files like `PLAIN-SPEAK.md` at project root, matching `STATE.md`/`CONVENTIONS.md`'s existing convention) was chosen specifically because `research`'s override cannot be named `RESEARCH.md` — that name is already taken by `truss:research`'s own findings log. Grouping all three under `truss-skills/` sidesteps the collision and keeps them discoverable as a set.

## Mechanism per skill

### `plain-speak` — deterministic, hook-checked

`hooks/session-start/teach.js` currently reads `skills/plain-speak/SKILL.md` unconditionally, strips its frontmatter, and injects the body as `additionalContext`. This gets one new check, before that read: if `truss-skills/plain-speak.md` exists in the project root, read and inject *that* file's content instead (no frontmatter to strip — it's plain text). Otherwise, fall back to the current behavior unchanged.

This preserves the hook's existing deterministic, zero-LLM-judgment guarantee — the override is a file-existence check, not something Claude has to notice and comply with.

### `research` / `big-brain` — instruction-based, Skill-tool-loaded

These two are not hook-forced — they're loaded when Claude invokes the `Skill` tool, a Claude Code platform mechanism truss has no hook into. There is no code path available to intercept or redirect what content the `Skill` tool loads.

The only lever available: each shipped `SKILL.md` gets a short paragraph added near the top of its body, instructing Claude to check for and defer to the override file if one exists. For `skills/research/SKILL.md`, inserted after the `# Research` heading, before the existing `## Rule` section:

```markdown
Before following the rules below, check `truss-skills/research.md` in the project root — if it exists, follow that file's content instead of what follows here.
```

Same pattern for `skills/big-brain/SKILL.md`, inserted after the `# Big Brain` heading, before `## When this applies`, with `truss-skills/big-brain.md` as the path.

**This is not factored into a shared include mechanism.** These are plain markdown files Claude Code reads directly; there's no build step or templating available. Duplicating a two-line paragraph (with the skill name swapped) across two files is simpler than inventing a shared-include system for markdown.

## Reliability asymmetry (explicit, accepted)

`plain-speak`'s override is deterministic — a file-existence check in a hook, no judgment involved. `research`/`big-brain`'s override relies on Claude reading the shipped file's redirect paragraph and complying with it — the same soft-compliance dependency these two skills already have today for their normal (non-override) instructions. This is **not a regression**: it doesn't make `research`/`big-brain` less reliable than they already are, it just doesn't grant them the stronger guarantee `plain-speak` earns specifically because it's hook-forced. Explicitly considered and rejected: giving `research`/`big-brain` their own `SessionStart` hooks to match `plain-speak`'s guarantee — this would force their full content into ambient context every session, turning two skills deliberately designed as discrete, judgment-invoked actions into persistent ambient styles, a change to their fundamental nature far beyond "make them overridable."

## Testing

- `tests/session-start/teach.test.js` gets a new case: given a `truss-skills/plain-speak.md` fixture present alongside a `skills/plain-speak/SKILL.md` fixture, `teach()` returns the override file's content, not the shipped file's. Existing cases (no override present → shipped file used, frontmatter stripped) continue to cover the fallback path.
- `tests/skills/skills.test.js` gets structural checks that `skills/research/SKILL.md` and `skills/big-brain/SKILL.md` each contain the literal override-check paragraph text (mentioning `truss-skills/<name>.md`) — matching the existing pattern already used for `plain-speak`'s `GLOSSARY.md`/session-wide substring checks. This verifies the paragraph is present, not that Claude actually complies with it — the same known limitation as everything else judgment-based in truss.

---

## Explicitly Deferred / Out of Scope

- **Augment mode** — considered, rejected in favor of override (see "Mode" above). Could be revisited as a second, separate mechanism later if override's silent-update-loss trade-off proves painful in practice.
- **Shared templating/include mechanism for the override-check paragraph** — rejected; two files each carrying a short duplicated paragraph is simpler than building markdown includes for three files total.
- **`SessionStart` hooks for `research`/`big-brain`** — rejected; would change their designed nature from discrete actions to ambient styles, a bigger change than this spec covers.
- **A warning when an override silently diverges from a newer shipped skill version** (e.g. truss ships a new required rule, the user's override doesn't have it) — not built. No version-comparison mechanism exists for skill content today; revisit only if this proves to be a real problem in practice, not speculatively now.
