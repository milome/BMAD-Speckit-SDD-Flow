// Create second story for testing
import { createStory, listActiveStories, getCurrentContext } from './bmad-state';

const story2 = createStory('E001', 'S002', 'phone-validator');
console.log('Story 2 created:', story2.epic, story2.story);
console.log('---');
console.log('Active stories count:', listActiveStories().length);
console.log('Stories:', listActiveStories().map(s => `${s.epic}-${s.story}`));
console.log('---');
console.log('Current context:', getCurrentContext());
