import { it } from 'vitest';

it('restores process environment in the same lifecycle', () => {
  const previous = process.env.TEST_PORTFOLIO_AUDIT_MODE;
  try {
    process.env.TEST_PORTFOLIO_AUDIT_MODE = 'isolated';
  } finally {
    process.env.TEST_PORTFOLIO_AUDIT_MODE = previous;
  }
});
