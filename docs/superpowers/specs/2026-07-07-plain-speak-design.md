# Truss — Plain-Speak Design

**Date:** 2026-07-07
**Scope:** v0 — a single truss-shipped skill governing jargon-free conversational explanation during brainstorming/planning.

---

## Overview

Motivation: working in an unfamiliar, expert-heavy field (e.g. quantum simulation) surfaces dense jargon from source material that a non-specialist developer can't easily follow. This adds a skill that keeps conversational explanations accessible — defining or expanding technical terms in plain language rather than assuming domain background — whenever brainstorming or planning touches unfamiliar/technical territory. Not scoped to one project; applies generally.

Derived from `proposal.md`'s Coworker Mode (Component 7), which originally bundled three separate ideas: a critique-only stance (the agent never proposes solutions unprompted), a claim-citation rule (every stress-test claim must cite execution or a search result), and plain-language/jargon-explained output. This spec extracts only the third. The other two are explicitly out of scope here (see Deferred section).

---

## Overlap check: the "Caveman" plugin

Before designing, checked whether this duplicates an existing plugin — `ponytail`'s own skill text references "Caveman for terse prose," and it's a real, popular plugin (51k+ stars, JuliusBrussee/caveman). Confirmed **no overlap**: Caveman targets token-compression/terseness (drops filler, fragments sentences, cuts up to ~75% of output tokens). Plain-speak targets jargon-accessibility/expansion — explaining unfamiliar terms rather than assuming them. These are different axes, and can pull in opposite directions: Caveman's terse "ultra" mode assumes a reader who can fill in gaps themselves, which is the opposite of what a jargon-unfamiliar reader needs. Safe to build.

---

## Delivery

`skills/plain-speak/SKILL.md` — a static skill shipped in the truss repo, invoked as `truss:plain-speak`. Same shipping pattern as `research`/`big-brain`/`model-routing`: no dynamic generation, no CLAUDE.md editing, no new hook events, no config changes.

## Trigger

General, judgment-based description — fires when explaining domain-specific or technical concepts during brainstorming or planning to someone who may not have specialized background in that field. Same pattern as `research`/`big-brain`: no hard-coded tool/plugin-name matching, Claude applies it by judgment.

## Persistence (the key difference from research/big-brain)

`research` and `big-brain` are discrete actions ("go verify this," "delegate this analysis"). `plain-speak` is a **style**: once it applies, it should govern the rest of that brainstorming/planning activity, not just the single response that triggered it. This is modeled directly on `ponytail`'s own persistence framing ("ACTIVE EVERY RESPONSE... until changed or session end") — the skill's content states this explicitly rather than leaving it implicit.

## Scope

Governs **conversational dialogue only** — explanations, design proposals, trade-off discussions said directly to the developer. Does **not** apply to `RESEARCH.md` content, which stays precise/technical (it's also a reference for the model itself in later sessions, where precision matters more than accessibility). No changes to `research` or `big-brain`'s own files or behavior.

## Rule (skill content)

- Define or expand a technical term in plain language the first time it appears in conversation, rather than assuming familiarity.
- State the plain-language explanation **alongside** the technical term, not instead of it — the reader builds real vocabulary rather than losing precision.
- Use analogies where they build real intuition, not as decoration.
- **Keep explanations short and information-dense, not long paragraphs.** A human explaining a complex system to a colleague doesn't write sprawling prose — they say the essential thing in a few sentences. A wall of text is exactly how a reader gets lost in a complex system, which defeats this skill's own purpose. Prefer short paragraphs or a few tight sentences over multi-paragraph explanations; add length only when the specific complexity actually demands it, never as a default mode.
- This is **not** the same target as `Caveman`'s compression — no fragmented sentences or dropped grammar. Normal, well-formed, human sentences; just few of them.

---

## Testing

Same limitation as `research`/`big-brain`: the actual behavior (does an explanation come out in plain language) can't be asserted by `node:test`. Automated coverage is limited to frontmatter validity (name/description present), matching the existing `tests/skills/skills.test.js` pattern for the other three skills. Behavioral verification is manual, exercised the next time brainstorming/planning touches unfamiliar technical territory.

---

## Explicitly Deferred / Out of Scope

- **Critique-only stance** (Coworker Mode's other piece — agent never proposes solutions unprompted) — not built; a materially bigger behavioral change than this spec covers.
- **Claim-citation rule** (Coworker Mode's other piece — every claim must cite execution or search) — not built. `truss:research` already substantially covers claim-grounding for research-heavy claims specifically; a broader "every claim must cite" rule would be its own, later brainstorm if revisited.
- **Applying plain-language to `RESEARCH.md`'s own content** — deferred by explicit choice; it stays technical/precise.
