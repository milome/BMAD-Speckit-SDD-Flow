/**
 * Story State Tracker
 * @module story-state-tracker
 *
 * Tracks and manages story state machine transitions.
 */

import { StoryState, StateFile, ValidationResult, ValidatorOptions } from './types';
import { VALID_STATE_TRANSITIONS } from './constants';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Tracker for story state machine
 */
export class StoryStateTracker {
  /** Tracker configuration options */
  options: ValidatorOptions;
  /** Current state file path */
  private stateFilePath: string;
  /** Cached state */
  private cachedState: StateFile | null = null;

  /**
   * Creates a new StoryStateTracker instance
   * @param options - Tracker configuration options
   */
  constructor(options: ValidatorOptions) {
    this.options = options;
    this.stateFilePath = this.getStateFilePath();
  }

  /**
   * Gets the current state from the state file
   * @returns Promise resolving to the current state file
   */
  async getCurrentState(): Promise<StateFile> {
    return await this.loadState();
  }

  /**
   * Transitions to a new state
   * @param newState - The target state to transition to
   * @returns Promise resolving to the updated state file
   * @throws Error if transition is invalid
   */
  async transitionTo(newState: StoryState): Promise<StateFile> {
    const currentState = await this.loadState();

    // Validate transition
    const validation = this.validateTransition(currentState.state, newState);
    if (!validation.passed) {
      throw new Error(
        `Invalid state transition: ${currentState.state} -> ${newState}. ${validation.message}`
      );
    }

    // Update state
    const timestamp = new Date().toISOString();
    const updatedState: StateFile = {
      ...currentState,
      state: newState,
      updatedAt: timestamp,
      history: [...currentState.history, { state: newState, timestamp }],
    };

    // Save state
    await this.saveState(updatedState);
    this.cachedState = updatedState;

    return updatedState;
  }

  /**
   * Validates a state transition
   * @param from - Source state
   * @param to - Target state
   * @returns Validation result
   */
  validateTransition(from: StoryState, to: StoryState): ValidationResult {
    // Cannot transition to same state
    if (from === to) {
      return {
        passed: false,
        check: 'state_transition',
        message: `Cannot transition to the same state: ${from}`,
        severity: 'error',
      };
    }

    // Check if transition is valid
    const isValid = VALID_STATE_TRANSITIONS.some((t) => t.from === from && t.to === to);

    if (!isValid) {
      const validTransitions = VALID_STATE_TRANSITIONS.filter((t) => t.from === from)
        .map((t) => t.to)
        .join(', ');

      return {
        passed: false,
        check: 'state_transition',
        message: `Invalid transition from ${from} to ${to}. Valid transitions from ${from}: ${validTransitions || 'none'}`,
        severity: 'error',
      };
    }

    return {
      passed: true,
      check: 'state_transition',
      message: `Valid transition: ${from} -> ${to}`,
      severity: 'info',
    };
  }

  /**
   * Loads state from file or creates initial state
   * @returns Promise resolving to the state file
   */
  async loadState(): Promise<StateFile> {
    // Return cached state if available
    if (this.cachedState) {
      return this.cachedState;
    }

    // Check if state file exists
    if (fs.existsSync(this.stateFilePath)) {
      try {
        const content = fs.readFileSync(this.stateFilePath, 'utf-8');
        const state = yaml.load(content) as StateFile;
        this.cachedState = state;
        return state;
      } catch (error) {
        // If file is corrupted, create new initial state
        console.warn(`Failed to load state file: ${error}. Creating new state.`);
      }
    }

    // Create initial state
    const initialState = await this.initializeState();
    return initialState;
  }

  /**
   * Saves state to file
   * @param state - The state file to save
   */
  async saveState(state: StateFile): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.stateFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write state file
    const content = yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
    });

    fs.writeFileSync(this.stateFilePath, content, 'utf-8');
  }

  /**
   * Initializes a new state file
   * @returns Promise resolving to the initial state file
   */
  async initializeState(): Promise<StateFile> {
    const timestamp = new Date().toISOString();
    const initialState: StateFile = {
      state: StoryState.STORY_CREATED,
      epic: this.options.epic,
      story: this.options.story,
      history: [{ state: StoryState.STORY_CREATED, timestamp }],
      updatedAt: timestamp,
    };

    await this.saveState(initialState);
    this.cachedState = initialState;

    return initialState;
  }

  /**
   * Gets the state file path
   * @returns The path to the state file
   */
  private getStateFilePath(): string {
    const basePath = this.options.outputPath || '_bmad-output/implementation-artifacts';
    return path.join(
      basePath,
      `epic-${this.options.epic}-${this.options.epicSlug}`,
      `story-${this.options.epic}-${this.options.storySlug.replace(/-/g, '-')}`,
      'state.yaml'
    );
  }

  /**
   * Gets all valid transitions from a given state
   * @param state - The source state
   * @returns Array of valid target states
   */
  getValidTransitions(state: StoryState): StoryState[] {
    return VALID_STATE_TRANSITIONS.filter((t) => t.from === state).map((t) => t.to as StoryState);
  }

  /**
   * Checks if a transition is valid
   * @param from - Source state
   * @param to - Target state
   * @returns True if transition is valid
   */
  canTransition(from: StoryState, to: StoryState): boolean {
    return VALID_STATE_TRANSITIONS.some((t) => t.from === from && t.to === to);
  }

  /**
   * Gets the state history
   * @returns Promise resolving to array of state history entries
   */
  async getStateHistory(): Promise<Array<{ state: StoryState; timestamp: string }>> {
    const state = await this.loadState();
    return state.history;
  }
}
