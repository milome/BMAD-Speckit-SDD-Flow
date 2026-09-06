const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rename = fs.renameSync;
const root = path.resolve(process.env.REQ_TRACE_CRASH_ROOT);
const point = process.env.REQ_TRACE_CRASH_POINT;
let interrupted = false;
fs.renameSync = function(from, to, ...rest) {
  const result = rename.call(this, from, to, ...rest);
  const target = path.resolve(to);
  const isJournal = path.basename(target) === 'journal.json' &&
    path.dirname(path.dirname(target)) === root;
  const state = isJournal ? JSON.parse(fs.readFileSync(target, 'utf8')).state : null;
  const matches = point === `journal:${state}` || target === path.join(root, point);
  if (!interrupted && matches) {
    interrupted = true;
    if (process.env.REQ_TRACE_CRASH_CONTENDER === 'true') {
      const env = { ...process.env };
      delete env.REQ_TRACE_CRASH_POINT;
      delete env.REQ_TRACE_CRASH_ROOT;
      delete env.REQ_TRACE_CRASH_CONTENDER;
      const contender = spawnSync(process.execPath, process.argv.slice(1), {
        env, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true,
      });
      fs.writeSync(1, `${JSON.stringify({ testOnly: true, contenderStatus: contender.status,
        contenderStdout: contender.stdout, contenderStderr: contender.stderr })}\n`);
    }
    fs.writeSync(1, `${JSON.stringify({ testOnly: true, processExit: 86, point, target, state })}\n`);
    process.exit(86);
  }
  return result;
};
