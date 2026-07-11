---
name: reset
description: Use when the user asks to reset, wipe, or start truss over in this project — returns truss's own state to a fresh first-session default while preserving EVENTS.log.
---

# Reset

Wipes truss's own state back to defaults, as if this were a brand new project. `EVENTS.log` (the audit trail) is the one thing this never touches — everything else truss owns gets deleted or reset to template defaults.

Before following the rules below, check `truss-skills/reset.md` in the project root — if it exists, follow that file's content instead of what follows here.

## What to do

Run the reset script, then report what it printed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/reset.js"
```

The script, not this skill, is the source of truth for exactly what gets touched — see `scripts/reset.js`. It:
- Deletes `RESEARCH.md` and `DECISIONS.log` (both lazily recreated by `truss:research` / `truss:big-brain` the next time they're needed)
- Overwrites `truss.toml` and `CONVENTIONS.md` with their template defaults
- Leaves `EVENTS.log` untouched

Do not perform any of these file operations by hand — always go through the script, so the result is deterministic rather than instruction-followed.
