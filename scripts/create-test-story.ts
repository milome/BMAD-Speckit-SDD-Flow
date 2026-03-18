// Create E001-S001 story for testing
import { createStory, listActiveStories, getCurrentContext, getStoryState } from './bmad-state';

console.log('Creating E001-S001...');
const story = createStory('E001', 'S001', 'email-validator');
console.log('Story created:', JSON.stringify(story, null, 2));

console.log('\n--- Active Stories ---');
console.log(listActiveStories());

console.log('\n--- Current Context ---');
console.log(getCurrentContext());

console.log('\n--- Story State ---');
console.log(getStoryState('E001', 'S001'));
