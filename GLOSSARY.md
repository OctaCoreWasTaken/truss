## session
One continuous conversation with Claude Code, from the moment you open it to the moment you close it (or it auto-compacts/resets). Each new session starts with an empty conversation — Claude remembers nothing from before unless something durable (a file on disk) carries it over. First introduced 2026-07-08.

## hook
A small script the Claude Code app runs automatically at a fixed moment — e.g. "right when a session starts" or "right after a tool finishes." Truss uses hooks to inject text or block actions without relying on Claude choosing to follow an instruction. First introduced 2026-07-08.

## context window
Everything currently "in view" for Claude during a session — the conversation so far, system instructions, tool definitions. It has a size limit; once full, older parts get summarized away (compaction). First introduced 2026-07-08.

## subagent
A separate, temporary instance of Claude that a task is handed off to. It starts with a blank context window (doesn't see the main conversation) and reports back only its final result — used to keep the main session's context window from filling up with work that doesn't need to stay in view. First introduced 2026-07-08.

## chokepoint
An observable moment a hook *can* see (a tool call, a file write, a session start) that stands in for a fuzzy judgment a hook *can't* see. Example: a hook can't detect "should Claude research this?", but it can detect "the brainstorming skill was just invoked" and hang the research trigger on that instead. First introduced 2026-07-09.

## hard gate vs soft gate
Two ways truss makes Claude do something. A **hard gate** is enforced by a hook — a script the app runs no matter what (block a prompt, inject text). Claude can't skip it. A **soft gate** is an instruction in a skill — Claude reads "you should research this" and is *supposed* to follow it, but under task pressure can silently not. The whole "not water-tight" problem is that truss's two most important skills (research, big-brain) are soft. First introduced 2026-07-09.

## schema
A fixed, predictable shape for a piece of information — a checklist of named fields to fill in (e.g. "files changed / decisions made / tests added"), instead of free-form paragraphs. Anyone reading it later knows exactly where to look for each fact instead of hunting through prose. First introduced 2026-07-08.
