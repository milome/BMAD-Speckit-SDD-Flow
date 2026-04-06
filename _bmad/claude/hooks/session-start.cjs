// SessionStart hook: 注入 checkpoint 摘要
const fs = require('fs');
const path = require('path');
const { autoStartRuntimeDashboard, shouldAnnounceAutoStart } = require('../../runtime/hooks/runtime-dashboard-auto-start.cjs');

async function sessionStart() {
  const checkpointPath = path.join('.claude', 'state', 'runtime', 'checkpoints', 'latest.md');
  const projectRoot = process.cwd();

  try {
    const payload = await autoStartRuntimeDashboard({ projectRoot, open: false });
    if (shouldAnnounceAutoStart(payload)) {
      console.log(`[BMAD Dashboard] ${payload.url}`);
    }
  } catch (error) {
    // quiet by default; dashboard auto-start is best-effort.
  }

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
