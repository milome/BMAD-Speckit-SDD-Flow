import * as fs from 'fs';
import * as path from 'path';

const QUEUE_DIR = '.claude/state/runtime/queue';

interface QueueItem {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
}

export function processQueue(): void {
  const pendingDir = path.join(QUEUE_DIR, 'pending');
  const processingDir = path.join(QUEUE_DIR, 'processing');
  const doneDir = path.join(QUEUE_DIR, 'done');
  const failedDir = path.join(QUEUE_DIR, 'failed');

  // 确保目录存在
  [pendingDir, processingDir, doneDir, failedDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // 处理 pending 队列
  const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));

  for (const file of pendingFiles) {
    const itemPath = path.join(pendingDir, file);
    const processingPath = path.join(processingDir, file);

    // 移动到 processing
    fs.renameSync(itemPath, processingPath);

    try {
      const item: QueueItem = JSON.parse(fs.readFileSync(processingPath, 'utf8'));

      // 处理事件
      processEvent(item);

      // 移动到 done
      fs.renameSync(processingPath, path.join(doneDir, file));
    } catch (error) {
      // 移动到 failed
      fs.renameSync(processingPath, path.join(failedDir, file));
    }
  }
}

function processEvent(item: QueueItem): void {
  // 更新 current-run.json
  const currentRunPath = '.claude/state/runtime/current-run.json';
  let currentRun: QueueItem[] = [];

  if (fs.existsSync(currentRunPath)) {
    currentRun = JSON.parse(fs.readFileSync(currentRunPath, 'utf8'));
  }

  currentRun.push(item);
  fs.writeFileSync(currentRunPath, JSON.stringify(currentRun, null, 2));
}

// 如果直接运行
if (require.main === module) {
  processQueue();
}
