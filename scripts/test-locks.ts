// Test locking functionality
import { acquireLock, getLock, releaseLock, listActiveStories } from './bmad-state';

console.log('Testing locks...\n');

// Try to acquire lock on E001-S001
const lock1 = acquireLock('E001', 'S001', 'agent-session-1');
console.log('Lock E001-S001 acquired:', lock1);
console.log('Lock status:', getLock('E001', 'S001'));

// Try to acquire same lock with different owner (should fail)
const lock2 = acquireLock('E001', 'S001', 'agent-session-2');
console.log('Lock E001-S001 by agent-2:', lock2, '(should be false)');

// Acquire lock on different story (should succeed)
const lock3 = acquireLock('E001', 'S002', 'agent-session-2');
console.log('Lock E001-S002 by agent-2:', lock3, '(should be true)');

console.log('\n--- All Locks ---');
console.log('E001-S001:', getLock('E001', 'S001').locked ? 'locked' : 'unlocked');
console.log('E001-S002:', getLock('E001', 'S002').locked ? 'locked' : 'unlocked');

// Release locks
releaseLock('E001', 'S001', 'agent-session-1');
releaseLock('E001', 'S002', 'agent-session-2');
console.log('\nLocks released');
