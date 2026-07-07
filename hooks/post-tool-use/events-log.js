const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');

module.exports = function eventsLog(input, projectRoot = process.cwd()) {
  const { config } = loadConfig(projectRoot);
  if (!config.log.events) return null;

  const record = {
    ts: new Date().toISOString(),
    event: 'ToolUse',
    tool: input.tool_name,
  };
  if (input.tool_input && input.tool_input.file_path) {
    record.file = input.tool_input.file_path;
  }

  fs.appendFileSync(path.join(projectRoot, 'EVENTS.log'), JSON.stringify(record) + '\n');
  return null;
};
