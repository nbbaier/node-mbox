/**
 * node-mbox - Modern TypeScript library for parsing and manipulating mbox files
 *
 * @packageDocumentation
 */

export { Mbox } from './Mbox';
export { MboxParserStream } from './MboxStream';
export {
  MboxMessage,
  MboxOptions,
  GetMessageOptions,
  MessageContent,
  MessageBoundary,
  MboxState,
  MboxNotReadyError,
  MessageNotFoundError,
  MboxMessageJSON,
  MboxEvents,
} from './types';

// Optional parser exports (only available if mailparser is installed)
export type {
  ParsedEmail,
  EmailAttachment,
  ParserOptions,
} from './parsers/EmailParser';

export type { ExtractionOptions, ExtractionResult } from './utils/AttachmentExtractor';

// Export parser classes for advanced usage
export { EmailParser } from './parsers/EmailParser';
export { AttachmentExtractor } from './utils/AttachmentExtractor';
