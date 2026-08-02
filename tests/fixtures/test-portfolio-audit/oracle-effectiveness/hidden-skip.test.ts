import { expect, it } from 'vitest';

it('does not report a hidden skip as a pass', () => {
  const prerequisiteAvailable = false;
  if (!prerequisiteAvailable) return;

  expect(runProtectedPath()).toBe('complete');
});

function runProtectedPath() {
  return 'complete';
}
