/**
 * Custom error classes for mbox parsing
 */

/**
 * Error thrown when a file does not conform to mbox format
 */
export class MboxValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MboxValidationError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MboxValidationError);
    }
  }
}
