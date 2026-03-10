/**
 * FeedbackCommand - feedback subcommand (Story 13.5, PRD §5.5, §5.12.1)
 * Outputs feedback entry (URL or guidance) and full-flow compatible AI list.
 * No TTY dependency; process.exit(0) on success.
 */
const FULL_FLOW_AI_LIST = [
  'cursor-agent',
  'claude',
  'qwen',
  'auggie',
  'codebuddy',
  'amp',
  'qodercli',
  'kiro-cli',
];

/** Feedback entry URL or guidance (PRD §5.5) */
const FEEDBACK_GUIDANCE =
  'Run `bmad-speckit feedback` to get the feedback entry, or visit: https://github.com/bmad-method/bmad-method/issues';

/**
 * Returns feedback hint text for init stdout (Story 13.5 T1.3).
 * Used by init.js after POST_INIT_GUIDE_MSG.
 * @returns {string}
 */
function getFeedbackHintText() {
  return 'Feedback: Run `bmad-speckit feedback` to get the feedback entry.';
}

/**
 * FeedbackCommand handler (Story 13.5 T1.1)
 * Outputs feedback entry and full-flow compatible AI list; exits 0.
 */
function feedbackCommand() {
  console.log('Feedback entry:', FEEDBACK_GUIDANCE);
  console.log('');
  console.log('Full-flow compatible AI (PRD §5.12.1):');
  FULL_FLOW_AI_LIST.forEach((ai) => console.log(`  - ${ai}`));
  process.exit(0);
}

module.exports = {
  feedbackCommand,
  getFeedbackHintText,
  FULL_FLOW_AI_LIST,
};
