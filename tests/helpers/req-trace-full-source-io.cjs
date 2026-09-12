const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');

function startIoMeter(limitWrittenBytes = 24 * 1024 * 1024) {
  const original = Object.fromEntries(['readFileSync', 'writeFileSync', 'appendFileSync', 'copyFileSync']
    .map((name) => [name, fs[name]]));
  const totals = { readBytes: 0, writtenBytes: 0, readCalls: 0, writeCalls: 0, copyCalls: 0 };
  const nextWrite = (bytes) => {
    if (totals.writtenBytes + bytes > limitWrittenBytes) throw new Error('test_only_full_source_io_budget_exceeded');
    totals.writtenBytes += bytes;
    totals.writeCalls += 1;
  };
  fs.readFileSync = function (...args) {
    const result = original.readFileSync.apply(fs, args);
    totals.readBytes += typeof result === 'string' ? Buffer.byteLength(result, 'utf8') : result.byteLength;
    totals.readCalls += 1;
    return result;
  };
  for (const name of ['writeFileSync', 'appendFileSync']) fs[name] = function (...args) {
    const value = args[1];
    nextWrite(typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : value.byteLength);
    return original[name].apply(fs, args);
  };
  fs.copyFileSync = function (...args) {
    const bytes = fs.statSync(args[0]).size;
    nextWrite(bytes);
    totals.readBytes += bytes;
    totals.readCalls += 1;
    totals.copyCalls += 1;
    return original.copyFileSync.apply(fs, args);
  };
  syncBuiltinESMExports();
  return { snapshot: () => ({ ...totals, limitWrittenBytes,
    measuredMethods: ['readFileSync', 'writeFileSync', 'appendFileSync', 'copyFileSync'] }),
  stop() { Object.assign(fs, original); syncBuiltinESMExports(); return this.snapshot(); } };
}

if (process.env.REQ_TRACE_FULL_IO_RECEIPT) {
  const write = fs.writeFileSync;
  const meter = startIoMeter(Number(process.env.REQ_TRACE_FULL_IO_LIMIT || 24 * 1024 * 1024));
  process.once('exit', () => write(process.env.REQ_TRACE_FULL_IO_RECEIPT,
    `${JSON.stringify(meter.stop())}\n`, { encoding: 'utf8', flag: 'wx' }));
}

module.exports = { startIoMeter };
