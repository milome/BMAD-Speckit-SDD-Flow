import { createServer } from 'node:net';
import { it } from 'vitest';

it('binds a fixed port', () => {
  createServer().listen(43123);
});
