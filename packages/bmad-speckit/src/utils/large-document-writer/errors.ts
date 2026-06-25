class LargeDocumentWriterError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'LargeDocumentWriterError';
    this.code = code;
    this.details = details;
  }
}

function block(code, details) {
  throw new LargeDocumentWriterError(code, details);
}

module.exports = {
  LargeDocumentWriterError,
  block,
};
