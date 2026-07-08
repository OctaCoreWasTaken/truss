const fs = require('fs');
const { loadConfig } = require('../lib/config');

function mostRecentUsage(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type === 'assistant' && entry.message && entry.message.usage) {
      const u = entry.message.usage;
      return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    }
  }
  return null;
}

module.exports = function autoCompact(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.gates.auto_compact) return null;
  if (!input.transcript_path || !fs.existsSync(input.transcript_path)) return null;

  const usageTotal = mostRecentUsage(input.transcript_path);
  if (usageTotal === null) return null;

  const limit = config.context.context_max * config.context.threshold;
  if (usageTotal < limit) return null;

  return {
    block: true,
    message: `[truss] Context usage (~${usageTotal} tokens) has crossed ${Math.round(config.context.threshold * 100)}% of the configured ${config.context.context_max}-token limit. Run /compact before continuing — preserve: goal, changed files, architectural decisions, unresolved errors, next step.`,
  };
};
