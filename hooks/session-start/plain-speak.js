const { loadConfig } = require('../lib/config');
const RULE_TEXT = require('../lib/plain-speak-rule');

module.exports = function plainSpeak(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.gates.plain_speak) return null;
  return { additionalContext: RULE_TEXT };
};
