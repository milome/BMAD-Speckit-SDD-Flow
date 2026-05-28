import { describe, expect, it } from 'vitest';
import { listDimensionNamesEn, parseDimensionScores, stageToMode } from '../dimension-parser';
import { resolveScoringDimensionContract } from '../../contracts/dimension-contracts';

describe('stage-aware scoring dimension contracts', () => {
  it('adds story, tasks, and bugfix top-level modes', () => {
    expect(stageToMode('story')).toBe('story');
    expect(stageToMode('tasks')).toBe('tasks');
    expect(stageToMode('bugfix')).toBe('bugfix');
  });

  it('resolves stage-specific contracts without collapsing to code dimensions', () => {
    expect(resolveScoringDimensionContract({ stage: 'story' })).toMatchObject({
      status: 'resolved',
      dimensionMode: 'story',
      dimensionContractId: 'story_document',
    });
    expect(resolveScoringDimensionContract({ stage: 'tasks' })).toMatchObject({
      status: 'resolved',
      dimensionMode: 'tasks',
      dimensionContractId: 'tasks_decomposition',
    });
    expect(resolveScoringDimensionContract({ stage: 'bugfix' })).toMatchObject({
      status: 'resolved',
      dimensionMode: 'bugfix',
      dimensionContractId: 'bugfix_implementation',
    });
  });

  it('blocks inconsistent explicit mode and contract id', () => {
    const result = resolveScoringDimensionContract({
      stage: 'story',
      dimensionMode: 'bugfix',
      dimensionContractId: 'story_document',
    });
    expect(result.status).toBe('blocked');
    expect(result.blockingReasons).toContain('dimension_mode_conflicts_with_contract_id');
  });

  it('parses each new mode with exactly four top-level dimensions', () => {
    const story = parseDimensionScores(
      [
        'Story Scope Integrity: 90/100',
        'Story Acceptance Coverage: 85/100',
        'Story Evidence Traceability: 80/100',
        'Story Execution Readiness: 75/100',
      ].join('\n'),
      'story'
    );
    const tasks = parseDimensionScores(
      [
        'Task Atomicity: 90/100',
        'Task Dependency Order: 85/100',
        'Task Evidence Binding: 80/100',
        'Task Execution Readiness: 75/100',
      ].join('\n'),
      'tasks'
    );
    const bugfix = parseDimensionScores(
      [
        'Root Cause Accuracy: 90/100',
        'Fix Correctness: 85/100',
        'Regression Protection: 80/100',
        'Bugfix Evidence Closure: 75/100',
      ].join('\n'),
      'bugfix'
    );

    expect(story.map((item) => item.dimension)).toEqual([
      'Story Scope Integrity',
      'Story Acceptance Coverage',
      'Story Evidence Traceability',
      'Story Execution Readiness',
    ]);
    expect(tasks).toHaveLength(4);
    expect(bugfix).toHaveLength(4);
  });

  it('keeps atomic check items separate from top-level dimensions', () => {
    const resolution = resolveScoringDimensionContract({ stage: 'bugfix' });
    expect(resolution.expectedDimensions).toHaveLength(4);
    expect(resolution.atomicItemSetId).toBe('bugfix_atomic_check_items');
    expect(resolution.expectedDimensions).not.toContain('fix_correctness');
    expect(listDimensionNamesEn('bugfix')).toEqual([
      'Root Cause Accuracy',
      'Fix Correctness',
      'Regression Protection',
      'Bugfix Evidence Closure',
    ]);
  });
});
