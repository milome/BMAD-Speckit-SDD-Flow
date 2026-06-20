"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Create E001-S001 story for testing
const bmad_state_1 = require("./bmad-state");
console.log('Creating E001-S001...');
const story = (0, bmad_state_1.createStory)('E001', 'S001', 'email-validator');
console.log('Story created:', JSON.stringify(story, null, 2));
console.log('\n--- Active Stories ---');
console.log((0, bmad_state_1.listActiveStories)());
console.log('\n--- Current Context ---');
console.log((0, bmad_state_1.getCurrentContext)());
console.log('\n--- Story State ---');
console.log((0, bmad_state_1.getStoryState)('E001', 'S001'));
