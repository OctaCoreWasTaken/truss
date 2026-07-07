---
name: model-routing
description: Use when delegating implementation work to a subagent. Assigns the right model by task type — mechanical coding to a cheap model — keeping delegated work cost-efficient. For hard analytical decisions during brainstorming or planning, see truss:big-brain instead.
---

# Model Routing

The main session cannot change its own model, so routing works by choosing the **model of the subagents** you delegate to. The main session stays a thin coordinator; substantive work runs in scoped subagents.

## Roles

Read the model for each role from `truss.toml` `[model]` (fall back to these defaults if the file or key is absent):

- `coordinator` (default `sonnet`) — the main interactive session. Advisory only; you cannot set it. Handles dialogue and Q&A.
- `thinking` (default `opus`) — subagent model for hard analytical decisions. See `truss:big-brain` for when to delegate to it.
- `coding` (default `haiku`) — subagent for mechanical implementation.
- `escalation` (default `opus`) — reserved for a future failure-triggered tier. **Not used yet.**

## Rule

When implementation is delegated to a subagent, run that subagent on the `coding` model. Never delegate the interactive dialogue itself — a subagent cannot talk to the user.
