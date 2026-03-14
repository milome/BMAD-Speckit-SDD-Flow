// SessionStart hook: 注入 checkpoint 摘要
const fs = require('fs');
const path = require('path');

function sessionStart() {
  const checkpointPath = path.join('.claude', 'state', 'runtime', 'checkpoints', 'latest.md');

  if (fs.existsSync(checkpointPath)) {
    const checkpoint = fs.readFileSync(checkpointPath, 'utf8');
    // 输出紧凑恢复上下文
    console.log('[BMAD Startup Context]');
    console.log(checkpoint.substring(0, 500)); // 前500字符
  } else {
    console.log('[BMAD] No checkpoint found, fresh start');
  }
}

sessionStart();
