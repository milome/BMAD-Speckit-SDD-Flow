/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const original = {
  appendFileSync: fs.appendFileSync,
  closeSync: fs.closeSync,
  existsSync: fs.existsSync,
  fsyncSync: fs.fsyncSync,
  linkSync: fs.linkSync,
  openSync: fs.openSync,
  readFileSync: fs.readFileSync,
  readdirSync: fs.readdirSync,
  renameSync: fs.renameSync,
  rmSync: fs.rmSync,
  writeFileSync: fs.writeFileSync,
};

function event(value) {
  const target = process.env.BMAD_LOCK_EVENT_PATH;
  if (target) original.appendFileSync(target, `${value}\n`, 'utf8');
}

function waitForFile(target) {
  const deadline = Date.now() + 10_000;
  while (!original.existsSync(target)) {
    if (Date.now() >= deadline) throw new Error(`lock_preload_timeout:${target}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}

const faultOperation = process.env.BMAD_LOCK_FAULT_OPERATION;
const faultPathIncludes = process.env.BMAD_LOCK_FAULT_PATH_INCLUDES;
const faultPathEndsWith = process.env.BMAD_LOCK_FAULT_PATH_ENDS_WITH;
const faultHeartbeatClose = process.env.BMAD_LOCK_FAULT_HEARTBEAT_CLOSE === '1';
const faultAlways = process.env.BMAD_LOCK_FAULT_ALWAYS === '1';
const holdPathIncludes = process.env.BMAD_LOCK_HOLD_PATH_INCLUDES;
const holdPathEndsWith = process.env.BMAD_LOCK_HOLD_PATH_ENDS_WITH;
const holdStagePath = process.env.BMAD_LOCK_HOLD_STAGE;
const holdResumePath = process.env.BMAD_LOCK_HOLD_RESUME;
const trackPathIncludes = process.env.BMAD_LOCK_TRACK_PATH_INCLUDES;
const beforeOpenPathEndsWith = process.env.BMAD_LOCK_HOLD_BEFORE_OPEN_PATH_ENDS_WITH;
const beforeOpenStageBase = process.env.BMAD_LOCK_HOLD_BEFORE_OPEN_STAGE_BASE;
const beforeOpenResumeBase = process.env.BMAD_LOCK_HOLD_BEFORE_OPEN_RESUME_BASE;
const readdirHoldPathIncludes = process.env.BMAD_LOCK_READDIR_HOLD_PATH_INCLUDES;
const readdirHoldStage = process.env.BMAD_LOCK_READDIR_HOLD_STAGE;
const readdirHoldResume = process.env.BMAD_LOCK_READDIR_HOLD_RESUME;
const linkHoldPathIncludes = process.env.BMAD_LOCK_LINK_HOLD_PATH_INCLUDES;
const linkHoldPathEndsWith = process.env.BMAD_LOCK_LINK_HOLD_PATH_ENDS_WITH;
const linkHoldStage = process.env.BMAD_LOCK_LINK_HOLD_STAGE;
const linkHoldResume = process.env.BMAD_LOCK_LINK_HOLD_RESUME;
const rejectLinkDestinationIncludes = process.env.BMAD_LOCK_REJECT_LINK_DESTINATION_INCLUDES;
const trackedDescriptors = new Map();
let faultInjected = false;
let holdInjected = false;
let beforeOpenHoldInjected = false;
let readdirHoldInjected = false;
let linkHoldInjected = false;
let heartbeatStarted = false;

if (
  (faultOperation && faultPathIncludes) ||
  holdPathIncludes ||
  trackPathIncludes ||
  beforeOpenPathEndsWith
) {
  fs.openSync = function patchedOpen(target, flags, ...rest) {
    if (
      !beforeOpenHoldInjected &&
      beforeOpenPathEndsWith &&
      String(target).endsWith(beforeOpenPathEndsWith)
    ) {
      beforeOpenHoldInjected = true;
      const markerName = path.basename(String(target));
      event(`before-open:${String(target)}`);
      original.writeFileSync(`${beforeOpenStageBase}-${markerName}`, '', 'utf8');
      waitForFile(`${beforeOpenResumeBase}-${markerName}`);
    }
    const descriptor = original.openSync(target, flags, ...rest);
    if (
      (faultPathIncludes && String(target).includes(faultPathIncludes)) ||
      (holdPathIncludes && String(target).includes(holdPathIncludes)) ||
      (trackPathIncludes && String(target).includes(trackPathIncludes))
    ) {
      if (
        faultPathIncludes &&
        String(target).includes(faultPathIncludes) &&
        faultPathEndsWith &&
        !String(target).endsWith(faultPathEndsWith)
      ) {
        return descriptor;
      }
      trackedDescriptors.set(descriptor, String(target));
      event(`open:${String(target)}`);
    }
    return descriptor;
  };

  fs.writeFileSync = function patchedWrite(target, ...rest) {
    if (
      !faultInjected &&
      faultOperation === 'writeFileSync' &&
      typeof target === 'number' &&
      trackedDescriptors.has(target)
    ) {
      faultInjected = true;
      event(`fault:${trackedDescriptors.get(target)}`);
      const error = new Error('injected_lock_write_failure');
      error.code = 'EIO';
      throw error;
    }
    return original.writeFileSync(target, ...rest);
  };

  fs.fsyncSync = function patchedFsync(descriptor) {
    if (
      !faultInjected &&
      faultOperation === 'exitAfterFsync' &&
      trackedDescriptors.has(descriptor)
    ) {
      faultInjected = true;
      original.fsyncSync(descriptor);
      event(`exit:${trackedDescriptors.get(descriptor)}`);
      process.exit(137);
    }
    if (!faultInjected && faultOperation === 'fsyncSync' && trackedDescriptors.has(descriptor)) {
      faultInjected = true;
      event(`fault:${trackedDescriptors.get(descriptor)}`);
      const error = new Error('injected_lock_fsync_failure');
      error.code = 'EIO';
      throw error;
    }
    const result = original.fsyncSync(descriptor);
    if (
      !holdInjected &&
      trackedDescriptors.get(descriptor)?.includes(holdPathIncludes) &&
      (!holdPathEndsWith || trackedDescriptors.get(descriptor)?.endsWith(holdPathEndsWith))
    ) {
      holdInjected = true;
      event(`hold:${trackedDescriptors.get(descriptor)}`);
      original.writeFileSync(holdStagePath, '', 'utf8');
      waitForFile(holdResumePath);
    }
    return result;
  };

  fs.closeSync = function patchedClose(descriptor) {
    if (trackedDescriptors.has(descriptor)) {
      if (
        !faultInjected &&
        faultOperation === 'closeSync' &&
        (!faultHeartbeatClose || heartbeatStarted)
      ) {
        faultInjected = true;
        event(`fault:${trackedDescriptors.get(descriptor)}`);
        const error = new Error('injected_lock_close_failure');
        error.code = 'EIO';
        throw error;
      }
      event(`close:${trackedDescriptors.get(descriptor)}`);
      trackedDescriptors.delete(descriptor);
    }
    return original.closeSync(descriptor);
  };

  fs.rmSync = function patchedRemove(target, ...rest) {
    if (
      (!faultInjected || faultAlways) &&
      faultOperation === 'rmSync' &&
      String(target).includes(faultPathIncludes) &&
      (!faultPathEndsWith || String(target).endsWith(faultPathEndsWith))
    ) {
      faultInjected = true;
      event(`fault:${String(target)}`);
      const error = new Error('injected_lock_remove_failure');
      error.code = 'EIO';
      throw error;
    }
    return original.rmSync(target, ...rest);
  };
}

if (readdirHoldPathIncludes) {
  fs.readdirSync = function patchedReaddir(target, ...rest) {
    const names = original.readdirSync(target, ...rest);
    if (
      !readdirHoldInjected &&
      beforeOpenHoldInjected &&
      String(target).includes(readdirHoldPathIncludes)
    ) {
      readdirHoldInjected = true;
      event(`readdir-hold:${String(target)}`);
      original.writeFileSync(readdirHoldStage, '', 'utf8');
      waitForFile(readdirHoldResume);
    }
    return names;
  };
}

if (linkHoldPathIncludes || rejectLinkDestinationIncludes) {
  fs.linkSync = function patchedLink(source, destination) {
    if (
      rejectLinkDestinationIncludes &&
      String(destination).includes(rejectLinkDestinationIncludes)
    ) {
      const error = new Error('marker_destination_not_flat');
      error.code = 'ELOOP';
      throw error;
    }
    const result = original.linkSync(source, destination);
    if (
      !linkHoldInjected &&
      String(destination).includes(linkHoldPathIncludes) &&
      (!linkHoldPathEndsWith || String(destination).endsWith(linkHoldPathEndsWith))
    ) {
      linkHoldInjected = true;
      event(`link-hold:${String(destination)}`);
      original.writeFileSync(linkHoldStage, '', 'utf8');
      waitForFile(linkHoldResume);
    }
    return result;
  };
}

if (process.env.BMAD_LOCK_FAKE_STUCK_HEARTBEAT === '1' || faultHeartbeatClose) {
  const workerThreads = require('node:worker_threads');
  const OriginalWorker = workerThreads.Worker;
  class StuckHeartbeatWorker {
    constructor(options) {
      this.state = new Int32Array(options.workerData.state);
      Atomics.store(this.state, 0, 1);
      Atomics.notify(this.state, 0);
    }

    unref() {}

    terminate() {
      return Promise.resolve(1);
    }
  }
  workerThreads.Worker = new Proxy(OriginalWorker, {
    construct(Target, args) {
      const [source, options] = args;
      if (options?.eval && String(source).includes('workerData.ticketDescriptor')) {
        heartbeatStarted = true;
        if (process.env.BMAD_LOCK_FAKE_STUCK_HEARTBEAT === '1') {
          return new StuckHeartbeatWorker(options);
        }
      }
      return Reflect.construct(Target, args);
    },
  });
}

process.on('exit', () => {
  for (const target of trackedDescriptors.values()) event(`leaked:${target}`);
});

const abaBarrierPath = process.env.BMAD_LOCK_ABA_BARRIER_PATH;
let abaRenameObserved = false;
let abaQuarantineObserved = false;

if (abaBarrierPath) {
  fs.renameSync = function patchedRename(source, destination) {
    if (
      !abaRenameObserved &&
      String(source) === abaBarrierPath &&
      String(destination).startsWith(`${abaBarrierPath}.quarantine-`)
    ) {
      abaRenameObserved = true;
      original.writeFileSync(process.env.BMAD_LOCK_ABA_STAGE_ONE, '', 'utf8');
      waitForFile(process.env.BMAD_LOCK_ABA_RESUME_ONE);
    }
    return original.renameSync(source, destination);
  };

  fs.readFileSync = function patchedRead(target, ...rest) {
    const value = original.readFileSync(target, ...rest);
    if (!abaQuarantineObserved && String(target).startsWith(`${abaBarrierPath}.quarantine-`)) {
      abaQuarantineObserved = true;
      original.writeFileSync(process.env.BMAD_LOCK_ABA_STAGE_TWO, '', 'utf8');
      waitForFile(process.env.BMAD_LOCK_ABA_RESUME_TWO);
    }
    return value;
  };
}

const criticalPathIncludes = process.env.BMAD_LOCK_CRITICAL_PATH_INCLUDES;
const criticalStagePath = process.env.BMAD_LOCK_CRITICAL_STAGE;
const criticalResumePath = process.env.BMAD_LOCK_CRITICAL_RESUME;
let criticalHoldInjected = false;

if (criticalPathIncludes) {
  const downstreamRenameSync = fs.renameSync;
  fs.renameSync = function patchedCriticalRename(source, destination) {
    if (!criticalHoldInjected && String(destination).includes(criticalPathIncludes)) {
      criticalHoldInjected = true;
      event(`critical:${String(destination)}`);
      original.writeFileSync(criticalStagePath, '', 'utf8');
      waitForFile(criticalResumePath);
    }
    return downstreamRenameSync(source, destination);
  };
}
