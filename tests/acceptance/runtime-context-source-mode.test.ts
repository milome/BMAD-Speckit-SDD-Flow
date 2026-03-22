import { describe, expect, it } from 'vitest';
import schema from '../../docs/reference/runtime-context.schema.json';

describe('runtime-context sourceMode', () => {
  it('supports all official source modes', () => {
    const props = (schema as any).properties;
    expect(props.sourceMode).toBeDefined();
    expect(props.sourceMode.enum).toContain('full_bmad');
    expect(props.sourceMode.enum).toContain('seeded_solutioning');
    expect(props.sourceMode.enum).toContain('standalone_story');
  });
});
