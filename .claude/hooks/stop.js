// Stop hook: 生成 checkpoint
const fs = require('fs');
const path = require('path');

function stop() {
  const checkpointDir = path.join('.claude', 'state', 'runtime', 'checkpoints');
  const checkpointPath = path.join(checkpointDir, 'latest.md');

  const timestamp = new Date().toISOString();
  const checkpoint = `# BMAD Checkpoint
Generated: ${timestamp}

## Session End
`;

  fs.mkdirSync(checkpointDir, { recursive: true });
  fs.writeFileSync(checkpointPath, checkpoint);

  console.log('[BMAD] Checkpoint saved');
}

stop();
