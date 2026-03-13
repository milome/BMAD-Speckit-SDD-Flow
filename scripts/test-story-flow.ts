import { createStory, getStoryState, updateStoryState, listActiveStories } from './bmad-state';

async function testStoryFlow() {
  const epic = 'E999'; // Test epic
  const story = 'S001'; // Test story

  console.log('=== BMAD Story Assistant Test Flow ===\n');

  // Stage 1: Create Story
  console.log('Stage 1: Create Story');
  console.log('---------------------');
  try {
    const newStory = createStory(epic, story, 'test-epic', 'test-story');
    console.log('✓ Story created:', newStory.epic + '-' + newStory.story);
    console.log('  State:', newStory.stage);
  } catch (e: any) {
    console.log('✗ Story creation failed:', e.message);
    // If exists, get current state
    const existing = getStoryState(epic, story);
    if (existing) {
      console.log('  Existing story state:', existing.stage);
    }
  }

  // Check state
  const state1 = getStoryState(epic, story);
  console.log('\nCurrent state:', state1?.stage || 'not found');

  // Simulate Stage 1 complete -> Stage 2
  console.log('\nStage 2: Story Audit');
  console.log('---------------------');
  updateStoryState(epic, story, { stage: 'story_audit_in_progress' });
  console.log('✓ Story audit started');

  // Simulate audit pass
  updateStoryState(epic, story, {
    stage: 'story_audit_passed',
    auditReportPath: `_bmad-output/implementation-artifacts/epic-${epic}-test-epic/story-${epic}-${story}-test-story/AUDIT_story-${epic}-${story}.md`,
  });
  console.log('✓ Story audit passed');

  // Stage 3: Dev Story
  console.log('\nStage 3: Dev Story');
  console.log('---------------------');
  updateStoryState(epic, story, { stage: 'implement_in_progress' });
  console.log('✓ Dev Story started');

  // Simulate implement complete
  updateStoryState(epic, story, { stage: 'implement_complete' });
  console.log('✓ Dev Story complete');

  // Stage 4: Post Audit
  console.log('\nStage 4: Post Audit');
  console.log('---------------------');
  updateStoryState(epic, story, { stage: 'post_audit_in_progress' });
  console.log('✓ Post audit started');

  // Simulate post audit pass
  updateStoryState(epic, story, {
    stage: 'post_audit_passed',
    auditReportPath: `_bmad-output/implementation-artifacts/epic-${epic}-test-epic/story-${epic}-${story}-test-story/AUDIT_implement-${epic}-${story}.md`,
  });
  console.log('✓ Post audit passed');

  // Complete story
  updateStoryState(epic, story, {
    stage: 'completed',
    completedAt: new Date().toISOString(),
  });
  console.log('✓ Story completed');

  // Final state
  console.log('\n=== Final State ===');
  const finalState = getStoryState(epic, story);
  console.log(JSON.stringify(finalState, null, 2));

  // List active stories
  console.log('\n=== Active Stories ===');
  const active = listActiveStories();
  console.log(`Found ${active.length} active stories`);
}

testStoryFlow().catch(console.error);
