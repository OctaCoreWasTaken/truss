---
name: research
description: Use when brainstorming or planning with the user, before finalizing any plan or spec — and also in plain conversation whenever the user names an unfamiliar library/API, asks what the current best/frontier method for something is, or you're about to state a frontier/SOTA claim from memory. Researches the external libraries, APIs, algorithms, and techniques relied on and records findings (when planning) or just answers with sources (in conversation), so answers rest on verified facts and known prior art instead of assumptions, stale memory, or reinvented wheels.
---

# Research

When brainstorming or planning, build the plan on **verified information**, not on what you already believe.

Before following the rules below, check `truss-skills/research.md` in the project root — if it exists, follow that file's content instead of what follows here.

## Rule

For **every** bit of information, whether it is a framework, API, library, algorithm, or technique, research properly to ensure the information you use is correct — regardless of how confident you feel. Do not ask yourself "am I unsure about this?"; that self-check is exactly what fails. If the plan touches it, research it.

When the plan involves designing an algorithm or approach (not just calling a library), also do a **prior-art check**: search for existing documented methods that solve the same problem before designing a new one. Record methods considered and rejected, with why — not just the one chosen. Goal is to avoid rediscovering or reinventing what is already published.

Prefer primary sources: papers (arXiv etc.), official docs/specs, standards bodies. Treat blogs/forums as secondary — usable, but noted as lower-confidence in the entry.

Lazy-developer framing: finding a documented answer is cheaper than deriving one from memory. Search first, invent second — same instinct as reuse-over-build, applied to knowledge instead of code.

## Casual conversation (not brainstorming/planning)

Full ritual below is for plans/specs. In plain chat, lighter version:

- User asks "what's the current best way to do X" / names unfamiliar lib or API / you're about to assert a frontier or SOTA claim → search (context7 for libs/APIs, WebSearch/WebFetch for algorithms/frontier work) before answering.
- Cite what you found, answer directly. No user confirm-list step — that ceremony is for plans, not one-off questions. No fan-out either — a single lookup doesn't benefit from it.
- Still log it (see step 4) if the finding could matter to a future decision. Skip logging only for trivial lookups (e.g. "what's the current npm version") with no forward value.
- If the conversation turns into a plan the user wants to act on, switch to the full Steps below.
- Skip this whole thing for routine debugging/local-code questions — no search value there.

## Steps

1. **Check `RESEARCH.md` first.** Skip anything with a relevant, current entry — do not re-research it.
2. **Compile the research list and confirm with the user.** List every external library, API, framework, algorithm, or unfamiliar pattern the plan touches that is not already covered. Show this list to the user and ask whether they want to add anything before you begin; incorporate their additions. This is a prompt-and-continue, not an approval gate. (Casual conversation skips this step — see above.) Note whether the user added anything — this is recorded in each entry's `Confirmed with user` line in Step 4.
3. **Research each item, routed by kind:**
   - **Library/API/framework docs** → context7 first (resolve the library, query its docs). Fall back to WebSearch / WebFetch for anything context7 does not cover.
   - **Algorithm/technique/prior-art** → context7 will not have this. Go straight to WebSearch/WebFetch for papers, surveys, and reference implementations. Look specifically for existing solutions to the same problem, not just background theory.
   - **Fan-out when the confirmed list (Step 2) has 2+ items.** Spawn one subagent per item, in parallel (a single message, multiple `Agent` tool calls, `subagent_type: general-purpose`). Each subagent's prompt contains only: the one item, its kind (library/API vs. algorithm/prior-art, routing it per the rules above), and the exact entry format from Step 4 to return as its sole output — nothing else from the wider plan or conversation. Wait for all subagents to return, then write every returned entry into `RESEARCH.md` yourself, sequentially, in one pass — subagents never write the file directly, avoiding concurrent-write races on a shared file. A list of exactly 1 item stays inline — no subagent spawned, nothing to gain from fanning out a single item.
4. **Record findings in `RESEARCH.md`, sorted into two sections.** Create the file if it does not exist, with both headers:

   ```
   # Verified
   # Avoid
   ```

   Append entries under the matching header — never overwrite an existing entry.

   **`# Verified`** — usable, sourced, goes into plans/code:

   ## <library / API / algorithm / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query> | Paper: <citation/link>
   Source confidence: primary (paper/official doc/spec) | secondary (blog/forum)
   Findings: <what was verified, in plain language>
   Used in: <the spec/plan file this informed, or "casual — <topic>" if outside a plan>
   Confirmed with user: yes | additions: <none/list> (omit this line for casual-conversation entries — Step 2's confirm-list only happens in the full ritual)

   **`# Avoid`** — tried, considered, or found broken; kept so it isn't retried:

   ## <library / API / algorithm / pattern> — YYYY-MM-DD
   Source: context7 (/org/project) | WebSearch: <query> | Paper: <citation/link>
   Why avoid: <deprecated, doesn't work, wrong fit, superseded by X, etc.>
   Found while researching: <the item/plan this came up during>

Fold the verified facts into the plan as you build it. Check `# Avoid` before proposing an approach — don't re-suggest something already ruled out.
