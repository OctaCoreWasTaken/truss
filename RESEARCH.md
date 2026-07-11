# Verified

## Claude Code hook `transcript_path` JSONL format — 2026-07-08
Source: WebSearch (code.claude.com/docs/en/hooks, claude-dev.tools/docs/jsonl-format, and corroborating community docs)
Findings: `transcript_path` (present on all hook inputs) points to a JSONL file under `~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`, one JSON object per line. Each line has a `type` discriminator (`user`/`assistant`/`system`) plus `message.content` (array of content blocks: `text`, `thinking`, `tool_use`, `tool_result`) and, for assistant turns, `message.usage` — the real API-reported token accounting for that turn: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. This is the actual number the API reported, not an approximation, and it already reflects the full input sent for that turn — including system prompt, skill descriptions, and MCP tool schemas that a char-count-of-visible-text approach cannot see.
Used in: `docs/superpowers/specs/2026-07-08-auto-compact-trigger-design.md` (auto-compact trigger hook) — resolved the spec's original char/4-approximation design (with its named "estimation drift" limitation) in favor of summing the most recent assistant turn's `message.usage` fields, which eliminates that limitation rather than tolerating it.

## Claude Code hook block/decision contract (UserPromptSubmit, general) — 2026-07-08
Source: WebSearch (code.claude.com/docs/en/hooks and corroborating community docs)
Findings: A hook signals blocking either via exit code 2 (stderr shown to the user, any stdout JSON is ignored) or via exit code 0 with structured JSON on stdout (`{"decision": "block", "reason": "..."}` for UserPromptSubmit; `reason` is shown to the user only — it is not added to Claude's context, and `additionalContext` is only appended when the result is NOT a block). These are two separate, mutually exclusive signaling paths — mixing them (writing JSON to stdout, then exiting with code 2) causes the JSON to be silently discarded.
Used in: `docs/superpowers/specs/2026-07-08-auto-compact-trigger-design.md` — this is what surfaced the pre-existing `hooks/dispatch.js` bug (block path wrote JSON to stdout, then exited with code 2, which discards it) folded into that plan as a prerequisite fix.

## Claude Code hook context-editing capability (tool-call pruning feasibility) — 2026-07-08
Source: WebSearch + WebFetch (code.claude.com/docs/en/hooks)
Findings: `PostToolUse` can rewrite the CURRENT tool's result before it ever enters the transcript, via `{"hookSpecificOutput": {"hookEventName": "PostToolUse", "updatedToolOutput": "..."}}` (or block it entirely with `decision: "block"`). This happens once, at the moment that specific tool call resolves. No hook can retroactively edit, truncate, or remove a `tool_use`/`tool_result` pair that is already committed to the transcript — once in context, it stays until Claude Code's own compaction runs. `PreCompact` only gates whether compaction proceeds (block/backup); it cannot customize what the summarizer keeps or drops.
Verdict: the roadmap's original "tool-call pruning + auto-summary" idea (keep last N tool calls in full, summarize the rest retroactively) is **not buildable as specified** — there is no retroactive-rewrite hook. The buildable variant is front-loaded instead: a `PostToolUse` hook caps/summarizes large outputs (big file reads, verbose grep/bash dumps) at the moment they're generated, before they ever bloat context, rather than cleaning up history after the fact.
Used in: current brainstorming session on token-efficiency roadmap (tool-call pruning item).

## Aider repo-map — 2026-07-11
Source: WebFetch (aider.chat/docs/repomap.html, aider.chat/2023/10/22/repomap.html) | WebSearch: "Aider GitHub Paul Gauthier repo-map PageRank implementation"
Source confidence: primary
Findings: Aider's repo-map uses tree-sitter to parse source into an AST, extracting function signatures, class/method definitions, and critical source lines — not prose explanations, only structural signatures. Ranking uses PageRank over a dependency graph (files as nodes, imports/calls as edges), personalized toward files already in chat context. The map is regenerated fresh per request (cached by file mtime via diskcache, not incrementally updated) and sized to a token budget (default 1,000 via `--map-tokens`). Known scaling limit: 50k+ files/vendored lines slows PageRank; `.aiderignore` filtering mitigates (up to 80% token reduction). No human-readable prose per symbol anywhere — purely elided signatures.
Used in: casual — truss codebase-doc-tree brainstorm
Confirmed with user: yes | additions: none

## Tree-sitter/ctags/SCIP/LSP symbol indexing — 2026-07-11
Source: WebSearch/WebFetch (tree-sitter GitHub README, py-tree-sitter docs, sourcegraph/scip proto, ctags-json-output docs, LSP 3.17 spec)
Source confidence: primary
Findings: Tree-sitter extracts fine-grained symbols (function/class/method/variable) via AST + S-expression queries; incremental parsing reuses unchanged subtrees (~70% re-parse time reduction on edits) but stores no prose — documentation attachment would be a separate layer on top. Universal-ctags' JSON output likewise has structural fields only (name/path/kind/scope/line), no doc-string field. LSP `textDocument/documentSymbol` returns a hierarchical file→class→method→field tree but the core protocol carries no documentation field either (language servers bolt docs on separately via hover). SCIP (Sourcegraph's protocol) is the one format built for this: `SymbolInformation` has an explicit `documentation` (markdown) field, `display_name`, `kind`, and `enclosing_symbol` for parent nesting — proto-binary, re-indexed by full re-parse on file change, not incremental at the protocol level.
Used in: casual — truss codebase-doc-tree brainstorm
Confirmed with user: yes | additions: none

## Living/AI-maintained documentation tools (Swimm, AutomaDocs, Repowise, Mintlify Autopilot) — 2026-07-11
Source: WebSearch/WebFetch (repowise.dev, falconer.com/guides/living-documentation, automadocs.com, mintlify.com/blog/autopilot, github.com/repowise-dev/repowise, thectoclub.com/tools/swimm-review)
Source confidence: primary (vendor docs) / secondary (review site for Swimm adoption-friction claims)
Findings: This space already contains a close match to the proposed design. **Repowise** indexes a codebase once, then keeps it in sync per-commit via file watchers (incremental — only modified files + dependents re-processed, not a full regen); generates per-module LLM documentation with freshness/confidence scoring, in multiple styles (including a literal "caveman" style), across 15 languages; exposes symbol-level queries returning exact source line-bounds; and auto-hosts an MCP server so an agent can query the docs directly rather than a human reading them. **Swimm** uses "code-coupled documentation" — docs linked to specific code tokens, flagged when the linked code changes, human re-approves before it's trusted again; adoption friction reported around setup complexity and search slowness on large repos, and it recommends blocking PRs on unresolved snippet drift to actually stay current (soft nudges get ignored). **AutomaDocs** regenerates from AST on every commit and is the one tool that explicitly tracks a staleness/health score per doc (most others detect changes reactively but don't measure drift as a number). **Mintlify Autopilot** proposes doc updates the moment code ships, human-reviewed before publish. Cross-tool failure modes reported: awareness gaps (system doesn't know a change happened), routing failures (alerts nobody sees), edit friction (a 10-minute doc fix nobody schedules), and drift compounding until a periodic audit catches it too late. Consensus: "maintenance, not initial writing, is the primary time sink" — matches this design's core risk.
Used in: casual — truss codebase-doc-tree brainstorm
Confirmed with user: yes | additions: none

## Doc-sync enforcement patterns (hooks/linters against drifted docs) — 2026-07-11
Source: WebSearch/WebFetch (github.com/mkhrdev/cc-spec-driven, github.com/suhteevah/docsync, code.claude.com/docs/en/hooks, medium.com/@fedestyla — git hooks for docs/AI agents)
Source confidence: primary (official docs + repos) / secondary (Medium post)
Findings: Three enforcement mechanisms found. (1) AST diffing — DocSync tree-sitter-parses staged code, diffs symbols against existing docs, flags undocumented/stale/dead-referenced entries. (2) Git pre-commit hooks — hard-block the commit itself on detected drift; reported to outperform soft nudges ("hard blocks transform documentation from optional hygiene to a technical requirement enforced at source control"). (3) Claude Code PostToolUse hooks — fire *after* a Write/Edit already succeeded; **cannot retroactively block that edit**, only pass `additionalContext` forward or affect the *next* tool call. This directly corrects proposal.md's Component-1-adjacent finding-table claim of a PostToolUse hook that "rejects non-compliant diffs" — that phrasing is not literally accurate for Claude Code's hook model; a real block on a diff missing its doc update needs a `PreToolUse` gate on the *next* edit to that symbol, or a `Stop` hook refusing to end the session/task while stale entries remain. cc-spec-driven's own PostToolUse hook is used for spec-first workflow validation and follow-up triggering, not doc-retrofit blocking.
Used in: casual — truss codebase-doc-tree brainstorm
Confirmed with user: yes | additions: none

# Avoid

(none yet)
