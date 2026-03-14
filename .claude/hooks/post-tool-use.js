// PostToolUse hook: 捕获高价值事件
const fs = require('fs');
const path = require('path');

function postToolUse(event) {
  // 只记录高价值事件
  const highValueEvents = ['file-modified', 'audit-request', 'git-commit-attempt'];

  if (highValueEvents.includes(event?.type)) {
    const eventPath = path.join('.claude', 'state', 'runtime', 'events', `${Date.now()}.json`);
    fs.writeFileSync(eventPath, JSON.stringify(event, null, 2));
  }
}

// 导出供 Claude Code 调用
module.exports = { postToolUse };
