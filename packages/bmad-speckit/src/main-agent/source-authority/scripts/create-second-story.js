"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Create second story for testing
const bmad_state_1 = require("./bmad-state");
const story2 = (0, bmad_state_1.createStory)('E001', 'S002', 'phone-validator');
console.log('Story 2 created:', story2.epic, story2.story);
console.log('---');
console.log('Active stories count:', (0, bmad_state_1.listActiveStories)().length);
console.log('Stories:', (0, bmad_state_1.listActiveStories)().map((s) => `${s.epic}-${s.story}`));
console.log('---');
console.log('Current context:', (0, bmad_state_1.getCurrentContext)());
