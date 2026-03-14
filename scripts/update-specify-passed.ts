// Update E001-S001 to specify_passed
import { updateStoryState, getStoryState } from './bmad-state';

const updated = updateStoryState('E001', 'S001', {
  stage: 'specify_passed',
  audit_status: 'pass',
  artifacts: {
    spec: 'specs/epic-E001-e001/story-S001-email-validator/spec-E001-S001.md',
    audit: 'specs/epic-E001-e001/story-S001-email-validator/AUDIT_spec-E001-S001.md',
  },
  scores: {
    spec: {
      rating: 'A',
      dimensions: {
        需求完整性: 95,
        可测试性: 92,
        一致性: 90,
        可追溯性: 93,
      },
    },
  },
  runtime: {
    last_action: 'specify_audit_passed',
  },
});

console.log('Story state updated:');
console.log(JSON.stringify(updated, null, 2));

console.log('\n--- Current State ---');
console.log(getStoryState('E001', 'S001'));
