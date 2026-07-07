---
name: model-routing
description: Use when brainstorming, planning, or delegating implementation work. Routes work to the right model by task type — deep reasoning to a stronger model, mechanical coding to a cheaper one — through scoped subagents, keeping the main session cheap.
---

# Model Routing

The main session cannot change its own model, so routing works by choosing the **model of the subagents** you delegate to. The main session stays a thin coordinator; substantive work runs in scoped subagents.

## Roles

Read the model for each role from `truss.toml` `[model]` (fall back to these defaults if the file or key is absent):

- `coordinator` (default `sonnet`) — the main interactive session. Advisory only; you cannot set it. Handles dialogue and Q&A.
- `thinking` (default `opus`) — subagent for hard planning analysis.
- `coding` (default `haiku`) — subagent for mechanical implementation.
- `escalation` (default `opus`) — reserved for a future failure-triggered tier. **Not used yet.**

## Rules

**Thinking.** When brainstorming or planning and you hit a genuinely hard analytical sub-problem — evaluating approaches, stress-testing or reviewing a design, an architecture decision — delegate that reasoning to a subagent on the `thinking` model, then relay its result into the dialogue. **When in doubt, delegate** — err toward the stronger model rather than deciding unaided.

**Coding.** When implementation is delegated to a subagent, run that subagent on the `coding` model.

Never delegate the interactive dialogue itself — a subagent cannot talk to the user. Only delegate self-contained reasoning or implementation.
