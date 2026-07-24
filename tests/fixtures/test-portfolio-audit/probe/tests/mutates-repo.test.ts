import { writeFileSync } from 'node:fs';

test('mutates only the disposable sandbox repository', () => {
  writeFileSync('probe-mutation.txt', 'sandbox mutation\n', 'utf8');
});
