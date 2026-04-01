import { describe, expect, it } from 'vitest';
import schema from '../../docs/reference/runtime-context-registry.schema.json';

describe('runtime-context-registry schema', () => {
  it('defines the required top-level registry fields', () => {
    const props = (schema as any).properties;
    expect(props.version).toBeDefined();
    expect(props.projectRoot).toBeDefined();
    expect(props.sources).toBeDefined();
    expect(props.projectContextPath).toBeDefined();
    expect(props.epicContexts).toBeDefined();
    expect(props.storyContexts).toBeDefined();
    expect(props.runContexts).toBeDefined();
    expect(props.activeScope).toBeDefined();
  });
});
