/**
 * Main Mbox class - provides a modern TypeScript interface for mbox files
 * Uses stream-based architecture for memory efficiency
 */

import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { MboxParserStream } from './MboxStream';
import {
  MboxMessage,
  MboxMessageJSON,
  MboxOptions,
  GetMessageOptions,
  MessageContent,
  MessageBoundary,
  MboxState,
  MboxNotReadyError,
  MessageNotFoundError,
} from './types';
import { EmailParser, ParsedEmail, ParserOptions, EmailAttachment } from './parsers/EmailParser';
import {
  AttachmentExtractor,
  ExtractionOptions,
  ExtractionResult,
} from './utils/AttachmentExtractor';

/**
 * Main class for parsing and manipulating mbox files.
 *
 * Provides both Promise-based (modern) and Event-based (legacy) APIs.
 *
 * @example
 * // Modern async/await usage
 * const mbox = await Mbox.create('mailbox.mbox');
 * const message = await mbox.get(0);
 * console.log(message);
 *
 * @example
 * // Legacy event-based usage
 * const mbox = new Mbox('mailbox.mbox');
 * mbox.on('init', (success) => {
 *   if (success) {
 *     mbox.get(0);
 *   }
 * });
 * mbox.on('get', (success, index, data) => {
 *   console.log(data);
 * });
 */
interface NormalizedMboxOptions {
  debug: boolean;
  bufferSize: number;
  encoding: BufferEncoding;
  savedIndex?: MboxMessageJSON[];
  strict: boolean;
}

export class Mbox extends EventEmitter {
  private filename: string;
  private messages: MboxMessage[] = [];
  private originalMessages: MboxMessage[] = [];
  private state: MboxState = MboxState.INIT;
  private options: NormalizedMboxOptions;
  private readyPromise: Promise<void>;
  private readyResolve?: () => void;
  private readyReject?: (error: Error) => void;
  private parser?: EmailParser;

  /**
   * Creates a new Mbox instance.
   * Note: The constructor starts async initialization immediately.
   * Use static create() method or wait for 'init' event before calling other methods.
   *
   * @param filename - Path to the mbox file
   * @param options - Configuration options
   */
  constructor(filename: string, options: MboxOptions = {}) {
    super();

    this.filename = filename;
    this.options = {
      debug: options.debug ?? false,
      bufferSize: options.bufferSize ?? 65536,
      encoding: options.encoding ?? 'utf8',
      strict: options.strict ?? false,
      ...(options.savedIndex !== undefined && { savedIndex: options.savedIndex }),
    };

    // Create a promise that resolves when initialization completes
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    // Start initialization
    this.initialize();
  }

  /**
   * Static factory method for creating a ready-to-use Mbox instance.
   * This is the recommended way to create an Mbox instance in modern code.
   *
   * @param filename - Path to the mbox file
   * @param options - Configuration options
   * @returns A Promise that resolves to a ready Mbox instance
   */
  static async create(filename: string, options: MboxOptions = {}): Promise<Mbox> {
    const mbox = new Mbox(filename, options);
    await mbox.ready();
    return mbox;
  }

  /**
   * Returns a Promise that resolves when the mbox is ready for operations.
   * Useful when using the constructor directly instead of the static create() method.
   */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Initializes the mbox by scanning the file and building an index.
   * Can use a saved index if provided in options.
   */
  private async initialize(): Promise<void> {
    try {
      this.state = MboxState.INDEXING;

      // Check if file exists
      await fs.promises.access(this.filename, fs.constants.R_OK);

      // Use saved index if provided
      if (this.options.savedIndex) {
        this.messages = this.options.savedIndex.map(MboxMessage.fromJSON);
        this.originalMessages = this.messages.map(
          (msg) => new MboxMessage(msg.index, msg.offset, msg.size, msg.deleted)
        );
        this.state = MboxState.READY;
        this.readyResolve?.();
        this.emit('init', true);
        return;
      }

      // Otherwise, scan the file
      await this.scanFile();

      this.state = MboxState.READY;
      this.readyResolve?.();
      this.emit('init', true);
    } catch (error) {
      this.state = MboxState.ERROR;
      const err = error instanceof Error ? error : new Error(String(error));
      this.readyReject?.(err);
      this.emit('init', false, err);
      // Only emit error event if there are listeners to avoid unhandled error exceptions
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
    }
  }

  /**
   * Scans the mbox file to build an index of message offsets and sizes.
   */
  private async scanFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(this.filename, {
        highWaterMark: this.options.bufferSize,
      });
      const parser = new MboxParserStream({ strict: this.options.strict });

      readStream.pipe(parser);

      parser.on('data', (boundary: MessageBoundary) => {
        // A boundary was found. This closes the *previous* message.
        if (this.messages.length > 0) {
          const prev = this.messages[this.messages.length - 1];
          if (prev) {
            // Update the previous message with its size
            const newPrev = prev.withSize(boundary.offset - prev.offset);
            this.messages[this.messages.length - 1] = newPrev;
          }
        }

        // Start a new message
        const newMessage = new MboxMessage(
          this.messages.length,
          boundary.offset,
          0 // Size will be calculated when next boundary is found
        );
        this.messages.push(newMessage);
      });

      parser.on('end', async () => {
        // Calculate size for the last message
        if (this.messages.length > 0) {
          const stat = await fs.promises.stat(this.filename);
          const last = this.messages[this.messages.length - 1];
          if (last) {
            const newLast = last.withSize(stat.size - last.offset);
            this.messages[this.messages.length - 1] = newLast;
          }
        }

        // Create a backup of original messages
        this.originalMessages = this.messages.map(
          (msg) => new MboxMessage(msg.index, msg.offset, msg.size, msg.deleted)
        );

        resolve();
      });

      readStream.on('error', (err) => {
        reject(err);
      });

      parser.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Returns the total number of messages (including deleted ones).
   */
  count(): number {
    return this.messages.filter((msg) => !msg.deleted).length;
  }

  /**
   * Returns the total number of messages including deleted ones.
   */
  totalCount(): number {
    return this.messages.length;
  }

  /**
   * Retrieves a message by its index.
   *
   * Modern Promise-based API:
   * @example
   * const message = await mbox.get(0);
   *
   * Legacy event-based API (for backwards compatibility):
   * @example
   * mbox.get(0);
   * mbox.on('get', (success, index, data) => { ... });
   *
   * @param index - The message index (0-based)
   * @param options - Options for retrieving the message
   * @returns Promise that resolves to the message content (string or stream)
   */
  async get(index: number, options: GetMessageOptions = {}): Promise<MessageContent> {
    try {
      // Validate state
      if (this.state !== MboxState.READY) {
        throw new MboxNotReadyError(this.state);
      }

      // Validate index
      if (index < 0 || index >= this.messages.length) {
        throw new MessageNotFoundError(index, 'out-of-bounds');
      }

      const msg = this.messages[index];
      if (!msg) {
        throw new MessageNotFoundError(index, 'out-of-bounds');
      }

      if (msg.deleted) {
        throw new MessageNotFoundError(index, 'deleted');
      }

      // Create a read stream for this message's byte range
      const stream = fs.createReadStream(this.filename, {
        start: msg.offset,
        end: msg.offset + msg.size - 1, // 'end' is inclusive
        encoding: options.asStream ? undefined : (options.encoding ?? this.options.encoding),
      });

      // Return stream if requested
      if (options.asStream) {
        this.emit('get', true, index);
        return stream;
      }

      // Otherwise, collect stream into a string
      const content = await this.streamToString(stream);
      this.emit('get', true, index, content);
      return content;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('get', false, index);
      throw err;
    }
  }

  /**
   * Marks a message as deleted.
   * The message is not physically removed until write() is called.
   *
   * @param index - The message index to delete
   */
  async delete(index: number): Promise<void> {
    try {
      if (this.state !== MboxState.READY) {
        throw new MboxNotReadyError(this.state);
      }

      if (index < 0 || index >= this.messages.length) {
        throw new MessageNotFoundError(index, 'out-of-bounds');
      }

      const msg = this.messages[index];
      if (!msg) {
        throw new MessageNotFoundError(index, 'out-of-bounds');
      }

      if (msg.deleted) {
        throw new MessageNotFoundError(index, 'deleted');
      }

      msg.markDeleted();
      this.emit('delete', true, index);
    } catch (error) {
      this.emit('delete', false, index);
      throw error;
    }
  }

  /**
   * Resets all deleted messages (undoes all deletions).
   * Messages are restored to their original state.
   */
  reset(): void {
    try {
      if (this.state !== MboxState.READY) {
        throw new MboxNotReadyError(this.state);
      }

      // Restore from original backup
      this.messages = this.originalMessages.map(
        (msg) => new MboxMessage(msg.index, msg.offset, msg.size, msg.deleted)
      );

      this.emit('reset', true);
    } catch (error) {
      this.emit('reset', false);
      throw error;
    }
  }

  /**
   * Writes all non-deleted messages to a new mbox file.
   * This physically removes deleted messages from the file.
   *
   * @param destination - Path to the output file
   */
  async write(destination: string): Promise<void> {
    try {
      if (this.state !== MboxState.READY) {
        throw new MboxNotReadyError(this.state);
      }

      const writeStream = fs.createWriteStream(destination);

      // Stream each non-deleted message to the output file
      for (const msg of this.messages) {
        if (msg.deleted) continue;

        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(this.filename, {
            start: msg.offset,
            end: msg.offset + msg.size - 1,
          });

          // Pipe to writeStream but don't close it yet
          readStream.pipe(writeStream, { end: false });

          readStream.on('end', () => resolve());
          readStream.on('error', (err) => reject(err));
        });
      }

      // Close the write stream
      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      this.emit('write', true, destination);
    } catch (error) {
      this.emit('write', false, destination);
      throw error;
    }
  }

  /**
   * Exports the message index for saving/caching.
   * Can be restored later using the savedIndex option.
   */
  exportIndex(): ReturnType<MboxMessage['toJSON']>[] {
    return this.messages.map((msg) => msg.toJSON());
  }

  /**
   * Returns the current state of the Mbox instance.
   */
  getState(): MboxState {
    return this.state;
  }

  /**
   * Helper method to convert a stream to a string
   */
  private async streamToString(stream: Readable): Promise<string> {
    const chunks: string[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk.toString()));
      stream.on('end', () => resolve(chunks.join('')));
      stream.on('error', reject);
    });
  }

  /**
   * Enable email parsing functionality
   * Requires 'mailparser' peer dependency
   *
   * @returns this for method chaining
   * @throws Error if mailparser is not installed
   *
   * @example
   * const mbox = await Mbox.create('mail.mbox');
   * mbox.useParser();
   * const email = await mbox.getParsed(0);
   */
  useParser(): this {
    if (!this.parser) {
      this.parser = new EmailParser();
    }
    return this;
  }

  /**
   * Get and parse a message in one operation
   * Returns structured email object instead of raw string
   *
   * @param index - The message index to retrieve and parse
   * @param options - Parser options
   * @returns Parsed email with structured data
   * @throws Error if parser not initialized (call useParser() first)
   * @throws MboxNotReadyError if mbox not ready
   * @throws MessageNotFoundError if index invalid or message deleted
   *
   * @example
   * const mbox = await Mbox.create('mail.mbox');
   * mbox.useParser();
   * const email = await mbox.getParsed(0);
   * console.log(email.subject, email.attachments);
   */
  async getParsed(index: number, options: ParserOptions = {}): Promise<ParsedEmail> {
    if (!this.parser) {
      throw new Error(
        'Parser not initialized. Call useParser() first or install mailparser.'
      );
    }

    // Get raw message as stream for memory efficiency
    const stream = (await this.get(index, { asStream: true })) as Readable;

    // Parse it
    return this.parser.parse(stream, options);
  }

  /**
   * Batch parse multiple messages
   *
   * @param indices - Array of message indices to parse
   * @param options - Parser options
   * @returns Array of parsed emails
   * @throws Error if parser not initialized
   *
   * @example
   * const mbox = await Mbox.create('mail.mbox');
   * mbox.useParser();
   * const emails = await mbox.getParsedBatch([0, 1, 2]);
   * emails.forEach(email => console.log(email.subject));
   */
  async getParsedBatch(
    indices: number[],
    options: ParserOptions = {}
  ): Promise<ParsedEmail[]> {
    const results: ParsedEmail[] = [];

    for (const index of indices) {
      results.push(await this.getParsed(index, options));
    }

    return results;
  }

  /**
   * Iterate through all messages with parsing
   * Memory efficient - processes one message at a time
   *
   * @param options - Parser options
   * @yields Object containing message index and parsed email
   * @throws Error if parser not initialized
   *
   * @example
   * const mbox = await Mbox.create('mail.mbox');
   * mbox.useParser();
   * for await (const { index, email } of mbox.iterateParsed()) {
   *   console.log(`Message ${index}: ${email.subject}`);
   * }
   */
  async *iterateParsed(
    options: ParserOptions = {}
  ): AsyncGenerator<{ index: number; email: ParsedEmail }> {
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      if (msg && !msg.deleted) {
        const email = await this.getParsed(i, options);
        yield { index: i, email };
      }
    }
  }

  /**
   * Extract all attachments from the mbox file
   *
   * @param options - Extraction options
   * @returns Extraction result with statistics
   * @throws Error if parser not initialized
   *
   * @example
   * const mbox = await Mbox.create('mail.mbox');
   * mbox.useParser();
   * const result = await mbox.extractAttachments({
   *   outputDir: './attachments',
   *   deduplicate: true,
   *   filter: (att) => att.contentType.includes('pdf'),
   * });
   * console.log(`Extracted ${result.extracted} files`);
   */
  async extractAttachments(
    options: Omit<ExtractionOptions, 'filter'> & {
      /**
       * Only extract from specific message indices
       */
      messageIndices?: number[];

      /**
       * Filter attachments
       */
      filter?: (attachment: EmailAttachment, messageIndex: number) => boolean;
    }
  ): Promise<ExtractionResult> {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call useParser() first.');
    }

    const extractor = new AttachmentExtractor();
    const allAttachments: EmailAttachment[] = [];

    const indices =
      options.messageIndices ||
      this.messages.map((msg, i) => (msg.deleted ? -1 : i)).filter((i) => i >= 0);

    // Collect all attachments
    for (const index of indices) {
      const email = await this.getParsed(index, {
        checksumAttachments: options.deduplicate ?? undefined,
        skipTextBody: true,
        skipHtmlBody: true,
      });

      for (const attachment of email.attachments) {
        if (!options.filter || options.filter(attachment, index)) {
          allAttachments.push(attachment);
        }
      }
    }

    // Extract them
    return extractor.extractFromEmails(allAttachments, {
      outputDir: options.outputDir,
      deduplicate: options.deduplicate ?? undefined,
      sanitizeFilenames: options.sanitizeFilenames ?? undefined,
      onConflict: options.onConflict ?? undefined,
    });
  }
}
