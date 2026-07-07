---
name: big-brain
description: Use at any hard decision point — evaluating competing approaches, an architecture call, stress-testing or reviewing a design, a choice that's expensive to get wrong. If there's even a moment of doubt about whether a decision deserves more thought, that doubt IS the trigger. Delegates the analysis to a stronger subagent instead of deciding it alone.
---

# Big Brain

Some decisions are cheap to get wrong. Some aren't. When you hit one that isn't — don't just reason it through yourself. Delegate it.

## When this applies

- Evaluating competing approaches or architectures.
- Stress-testing or reviewing a design before committing to it.
- A decision that's expensive to unwind if it turns out wrong.
- Any moment you notice yourself thinking "I should really think hard about this."

**If you're unsure whether a decision qualifies, that uncertainty is the signal — delegate.** Deciding for yourself whether you need help is exactly the judgment that fails here; don't trust it in this one spot either.

## What to do

Delegate the analysis to a subagent running the `thinking` model from `truss.toml [model]` (default `opus`). Give it the concrete question and enough context to reason about it in isolation, then relay its conclusion back into the conversation.

Never delegate the conversation itself — only a self-contained analytical question. A subagent cannot talk to the user.
