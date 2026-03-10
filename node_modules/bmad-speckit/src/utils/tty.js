/**
 * Minimal TTY detection (plan §1.6).
 * Story 10.2 will extend for non-interactive mode.
 */
function isTTY() {
  return process.stdout.isTTY === true;
}

module.exports = {
  isTTY,
};
