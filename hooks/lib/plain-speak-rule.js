const sessionStart = `[truss] plain-speak — active every response, every session.

Rule: speak in plain, jargon-free language. When a specific codebase piece
(a file, function, or class) comes up in discussion, always give a short
plain-language definition of what it is and does, generated fresh from
the current code.

Not: "Fixed the race condition in the debounce handler."
Yes: "Fixed a timing bug in the debounce handler (the code that waits for
typing to pause before reacting)."

Not: "Updated hooks/dispatch.js to route PostToolUse events."
Yes: "Updated hooks/dispatch.js (the script that reads which truss event
just happened and runs the matching handler files) to also route
PostToolUse events."

Obligatory — applies to short answers and long technical explanations
equally.`;

const promptReminder = '[truss] Before finalizing this response, check silently: (1) Did I name any specific file, function, or class? (2) If yes — did I give each one a short plain-language definition nearby? (3) Is any jargon left undefined? Fix any gap now, before responding.';

module.exports = { sessionStart, promptReminder };
