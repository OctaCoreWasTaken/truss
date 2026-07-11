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

Delegate the analysis to a subagent with `subagent_type: truss-thinker`, running the `thinking` model from `truss.toml [model]` (default `opus`). `truss-thinker` is scoped to Read/Grep/Glob/WebSearch/WebFetch — no Bash/Edit/Write/Agent tool schemas loaded — which keeps fixed per-agent overhead down; do not fall back to `general-purpose`, it carries tools this role never uses. Give it the concrete question and enough context to reason about it in isolation, then relay its conclusion back into the conversation.

Never delegate the conversation itself — only a self-contained analytical question. A subagent cannot talk to the user.

After relaying the conclusion, append one line to `DECISIONS.log` (create the file if it doesn't exist yet — same lazy-creation pattern as `RESEARCH.md`):

```
YYYY-MM-DD HH:MM | big-brain | <one-line question> | verdict: <one-line conclusion>
```

This is the only record of whether a hard decision actually got delegated — without it, there's no way to check after the fact that this skill fired when it should have. Skip only if `truss.toml`'s `[log] decisions` is explicitly set to `false`.

## What to do (delegated subagent)

Your job here is to **reason and decide**, not to re-research from scratch. Check `RESEARCH.md` first and work from what's already there. Only research a specific fact if it is genuinely missing and the decision hinges on it — research should be the exception in this role, not the default first move. Spend your effort on the analysis itself: comparing the options, finding the flaw, making the call.
