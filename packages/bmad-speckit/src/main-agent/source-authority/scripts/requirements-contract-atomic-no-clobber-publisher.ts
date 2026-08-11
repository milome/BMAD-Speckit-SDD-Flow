import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  artifactBytesHash,
  canonicalRequirementsJson,
  sourceBytesHash,
} from './requirements-contract-hash-domains';

export const REQUIREMENTS_ATOMIC_NO_CLOBBER_PUBLISHER_OWNER =
  'requirements-contract-atomic-no-clobber-publisher.ts#atomicNoClobberPublish/v1';

export type AtomicNoClobberPhase =
  | 'temp_created'
  | 'temp_fsynced'
  | 'temp_readback_verified'
  | 'before_publish'
  | 'after_publish';

export interface AtomicNoClobberPublication {
  schemaVersion: 'atomicNoClobberPublish/v1';
  targetPath: string;
  disposition: 'published' | 'reused';
  bytesHash: string;
  artifactBytesHash: string;
  byteLength: number;
  readbackVerified: true;
}

function canonicalBytes(input: { value?: unknown; bytes?: Buffer | string }): Buffer {
  if (input.bytes !== undefined) {
    return Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes, 'utf8');
  }
  if (!('value' in input)) throw new Error('atomic_no_clobber_payload_missing');
  return Buffer.from(canonicalRequirementsJson(input.value), 'utf8');
}

function writeFully(fd: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.length) {
    offset += fs.writeSync(fd, bytes, offset, bytes.length - offset, null);
  }
}

function fsyncDirectory(directory: string): void {
  let fd: number | null = null;
  try {
    fd = fs.openSync(directory, 'r');
    fs.fsyncSync(fd);
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

export function probeAtomicCreateIfAbsent(directory: string): void {
  fs.mkdirSync(directory, { recursive: true });
  const nonce = randomUUID();
  const source = path.join(directory, `.atomic-no-clobber-probe.${nonce}.source`);
  const target = path.join(directory, `.atomic-no-clobber-probe.${nonce}.target`);
  try {
    const fd = fs.openSync(source, 'wx', 0o600);
    fs.writeSync(fd, Buffer.from('probe', 'utf8'));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.linkSync(source, target);
    try {
      fs.linkSync(source, target);
      throw new Error('atomic_no_clobber_capability_probe_failed');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  } finally {
    if (fs.existsSync(source)) fs.unlinkSync(source);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

export function atomicNoClobberPublish(input: {
  targetPath: string;
  value?: unknown;
  bytes?: Buffer | string;
  role?: string;
  mediaType?: string;
  validateReadback?: (value: unknown, bytes: Buffer) => void;
  onPhase?: (phase: AtomicNoClobberPhase) => void;
}): AtomicNoClobberPublication {
  const targetPath = path.resolve(input.targetPath);
  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
  probeAtomicCreateIfAbsent(directory);
  const bytes = canonicalBytes(input);
  const tempPath = path.join(
    directory,
    `.${path.basename(targetPath)}.atomic-no-clobber.${process.pid}.${randomUUID()}.tmp`
  );
  let fd: number | null = null;
  let linked = false;
  try {
    fd = fs.openSync(tempPath, 'wx', 0o600);
    input.onPhase?.('temp_created');
    writeFully(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    input.onPhase?.('temp_fsynced');
    const tempReadback = fs.readFileSync(tempPath);
    if (!tempReadback.equals(bytes)) throw new Error('atomic_no_clobber_temp_readback_mismatch');
    if (input.validateReadback) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(tempReadback.toString('utf8'));
      } catch {
        throw new Error('atomic_no_clobber_readback_json_invalid');
      }
      input.validateReadback(parsed, tempReadback);
    }
    input.onPhase?.('temp_readback_verified');
    input.onPhase?.('before_publish');
    try {
      fs.linkSync(tempPath, targetPath);
      linked = true;
      fsyncDirectory(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new Error(`atomic_no_clobber_publish_failed:${(error as Error).message}`);
      }
      const current = fs.readFileSync(targetPath);
      if (!current.equals(bytes)) throw new Error('atomic_no_clobber_conflict');
    }
    const targetReadback = fs.readFileSync(targetPath);
    if (!targetReadback.equals(bytes)) throw new Error('atomic_no_clobber_target_readback_mismatch');
    input.onPhase?.('after_publish');
    return {
      schemaVersion: 'atomicNoClobberPublish/v1',
      targetPath,
      disposition: linked ? 'published' : 'reused',
      bytesHash: sourceBytesHash(bytes),
      artifactBytesHash: artifactBytesHash({
        role: input.role ?? 'immutable_json',
        mediaType: input.mediaType ?? 'application/json',
        bytes,
      }),
      byteLength: bytes.length,
      readbackVerified: true,
    };
  } finally {
    if (fd !== null) fs.closeSync(fd);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}
