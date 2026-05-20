import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTROL_WRITER_SCRIPTS = [
  'scripts/ingest-architecture-confirmation.ts',
  'scripts/ingest-implementation-evidence.ts',
  'scripts/main-agent-delivery-closeout-gate.ts',
  'scripts/main-agent-implementation-readiness-gate.ts',
];

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

describe('requirement record control store enforcement', () => {
  it('forces control writers through control-events jsonl atomic reducer path', () => {
    for (const scriptPath of CONTROL_WRITER_SCRIPTS) {
      const source = readProjectFile(scriptPath);
      expect(source, `${scriptPath} must use the control-store committer`).toContain('appendControlEventAndReplay');
      expect(source, `${scriptPath} must not overwrite requirement-record.json directly`).not.toMatch(
        /writeFileSync\s*\(\s*recordPath\b/u
      );
      expect(source, `${scriptPath} must not default control events to mentor-events.jsonl`).not.toMatch(
        /data['"`]\s*,\s*['"`]mentor-events\.jsonl/u
      );
      expect(source, `${scriptPath} must not hard-code data/mentor-events.jsonl as a control log`).not.toContain(
        'data/mentor-events.jsonl'
      );
    }
  });

  it('keeps mentor-events jsonl available only to governed data products and projections', () => {
    const dataProducts = readProjectFile('scripts/main-agent-governed-data-products.ts');
    expect(dataProducts).toContain('mentor-events.jsonl');
    expect(dataProducts).not.toContain('appendControlEventAndReplay');
  });
});
