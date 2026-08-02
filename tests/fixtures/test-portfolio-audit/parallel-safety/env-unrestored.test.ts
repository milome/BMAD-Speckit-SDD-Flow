import { it } from 'vitest';

it('mutates process environment without restoring it', () => {
  process.env.TEST_PORTFOLIO_AUDIT_MODE = 'unsafe';
});
