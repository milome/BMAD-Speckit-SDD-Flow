import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveConfirmedSource } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-compiled-prompt-runner';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-only-main-agent-confirmation-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); });

describe('Main Agent confirmed source routing', () => {
  it.each(['latest-event', 'missing-history', 'missing-source-hash', 'missing-confirmation-hash'])(
    'does not trust inline user_confirmed after %s invalidation', (damage) => {
      const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root });
      const input = { projectRoot: root, recordPath: fixture.recordPath };
      expect(resolveConfirmedSource(input).status).toBe('confirmed');
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
      record.implementationConfirmation = { status: 'user_confirmed' };
      if (damage === 'latest-event') record.confirmationHistory.push({ eventType: 'reconfirm_required' });
      if (damage === 'missing-history') delete record.confirmationHistory;
      if (damage === 'missing-source-hash') delete record.sourceDocumentHash;
      if (damage === 'missing-confirmation-hash') delete record.implementationConfirmationHash;
      fs.writeFileSync(fixture.recordPath, JSON.stringify(record), 'utf8');
      const result = resolveConfirmedSource(input);
      expect(result.status).toBe('confirmed_source_unresolvable');
      expect(result.blockingReasons).toContain('controlled_confirmation_event_missing');
    });
});
