/**
 * Minimal TTY detection (plan §1.6). Checks process.stdout.isTTY.
 * @returns {boolean} True if stdout is a TTY.
 */
function isTTY() {
  return process.stdout.isTTY === true;
}

module.exports = {
  isTTY,
};
