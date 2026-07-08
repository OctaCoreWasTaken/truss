---
name: research
description: Use when brainstorming or planning with the user, before finalizing any plan or spec. Researches the external libraries, APIs, and patterns the plan relies on and records the findings, so plans rest on verified facts instead of assumptions.
---

# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

Before following the rules below, check `truss-skills/research.md` in the project root — if it exists, follow that file's content instead of what follows here.

## Rule

For **every** external library, API, framework, or unfamiliar pattern the plan relies on, research it — regardless of how confident you feel. Do not ask yourself "am I unsure about this?"; that self-check is exactly what fails. If the plan touches it, research it.

## Steps

1. **Check `RESEARCH.md` first.** Skip anything with a relevant, current entry — do not re-research it.
2. **Compile the research list and confirm with the user.** List every external library, API, framework, or unfamiliar pattern the plan touches that is not already covered. Show this list to the user and ask whether they want to add anything before you begin; incorporate their additions. This is a prompt-and-continue, not an approval gate.
3. **Research each item.** Use context7 first (resolve the library, query its docs). Fall back to WebSearch / WebFetch for anything context7 does not cover.
4. **Record findings in `RESEARCH.md`.** Create the file if it does not exist. Append one entry per item:

   ## <library / API / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query>
   Findings: <what was verified, in plain language>
   Used in: <the spec/plan file this informed>

   Append only — never overwrite an existing entry.

Fold the verified facts into the plan as you build it.
