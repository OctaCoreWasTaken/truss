const { loadConfig } = require('../lib/config');

module.exports = function modelGate(input, projectRoot = process.cwd()) {
  if (input.tool_name !== 'Agent') return null;

  const { config } = loadConfig(projectRoot);
  if (!config.gates.model_routing) return null;

  const ti = input.tool_input || {};
  if (ti.subagent_type === 'fork') return null; // forks inherit the session model by design
  if (ti.model) return null;

  return {
    block: true,
    message: `[truss] Agent dispatch omitted "model" (subagent_type: ${ti.subagent_type || 'general-purpose'}). An omitted model silently inherits the session's model — usually the most expensive tier. Per truss.toml [model]: mechanical/1-2 file tasks -> "${config.model.coding}", integration/judgment -> "${config.model.coordinator}", architecture/design/final review -> "${config.model.thinking}". Re-dispatch with model set explicitly.`,
  };
};
