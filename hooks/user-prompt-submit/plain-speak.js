const { loadConfig } = require('../lib/config');
const { promptReminder } = require('../lib/plain-speak-rule');

module.exports = function plainSpeak(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.gates.plain_speak) return null;
  return { additionalContext: promptReminder };
};
