"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RALPH_NON_PRODUCTION_TDD_PHASES = exports.RALPH_PRODUCTION_TDD_PHASES = exports.RALPH_TDD_PHASES = exports.RALPH_PRD_SCHEMA_VERSION = void 0;
exports.expectedRalphTddPhasesForStory = expectedRalphTddPhasesForStory;
exports.isProductionRalphUserStory = isProductionRalphUserStory;
exports.RALPH_PRD_SCHEMA_VERSION = 'ralph_prd_v2';
exports.RALPH_TDD_PHASES = ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR', 'DONE'];
exports.RALPH_PRODUCTION_TDD_PHASES = ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR'];
exports.RALPH_NON_PRODUCTION_TDD_PHASES = ['DONE'];
function expectedRalphTddPhasesForStory(involvesProductionCode) {
    return involvesProductionCode ? exports.RALPH_PRODUCTION_TDD_PHASES : exports.RALPH_NON_PRODUCTION_TDD_PHASES;
}
function isProductionRalphUserStory(story) {
    return story.involvesProductionCode;
}
