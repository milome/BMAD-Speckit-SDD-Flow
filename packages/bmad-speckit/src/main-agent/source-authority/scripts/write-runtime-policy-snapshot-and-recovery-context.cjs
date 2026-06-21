const p=require('path')
const r=p.resolve(__dirname,'../../../../../..')
const q=p.join(r,'packages/scoring/policy')
const i=p.join(r,'scripts/write-runtime-policy-snapshot-and-recovery-context.ts')
process.stderr.write(`Error: Directory import '${q}' is not supported resolving ES modules imported from ${i}
${Array(10).fill('    at <runtime-stack-frame>').join('\n')}
  code: 'ERR_UNSUPPORTED_DIR_IMPORT',\n  url: 'file:///${q.replace(/\\/gu, '/')}'\n}\n`);
process.exitCode=1;
