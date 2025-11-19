/**
 * MboxParserStream - A Transform stream that parses mbox files
 * Handles edge cases like split delimiters and files starting with 'From '
 */

import { Transform, TransformCallback } from 'stream';
import { MessageBoundary } from './types';
import { MboxValidationError } from './errors';

/**
 * A Transform stream that parses a raw mbox file byte stream
 * and emits MessageBoundary objects for each message boundary it finds.
 *
 * Handles edge cases:
 * - Files that start with 'From ' without a leading newline
 * - Delimiters split across chunk boundaries
 * - Escaped 'From ' lines in message bodies ('>From ')
 */
export class MboxParserStream extends Transform {
  private absoluteOffset: number = 0;
  private tail: Buffer = Buffer.alloc(0);
  private isFirstChunk: boolean = true;
  private strict: boolean;
  private static readonly DELIMITER = Buffer.from('\nFrom ');
  private static readonly DELIMITER_START = Buffer.from('From ');

  constructor(options: { strict?: boolean } = {}) {
    // We emit MessageBoundary objects, not raw bytes
    super({ objectMode: true });
    this.strict = options.strict ?? false;
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    try {
      // Combine tail from previous chunk with current chunk to handle split delimiters
      const searchBuffer = Buffer.concat([this.tail, chunk]);
      const tailLength = this.tail.length;

      // Handle the very first bytes - check if file starts with 'From '
      // We need to wait until we have enough bytes to check, or until we determine it can't match
      if (this.isFirstChunk) {
        if (searchBuffer.length >= MboxParserStream.DELIMITER_START.length) {
          // We have enough bytes to check
          this.isFirstChunk = false;
          if (this.startsWithFromLine(searchBuffer)) {
            // File starts with a message boundary
            this.push({ offset: 0 } as MessageBoundary);
          } else if (this.strict) {
            // In strict mode, file MUST start with 'From '
            callback(
              new MboxValidationError('File does not start with "From " line')
            );
            return;
          }
        } else {
          // Not enough bytes yet - check if what we have could still be the start of "From "
          const canStillMatch = MboxParserStream.DELIMITER_START
            .slice(0, searchBuffer.length)
            .equals(searchBuffer);
          if (!canStillMatch) {
            // Definitely doesn't start with "From ", stop checking
            this.isFirstChunk = false;
            if (this.strict) {
              callback(
                new MboxValidationError('File does not start with "From " line')
              );
              return;
            }
          }
          // else: might still match, keep checking in next chunk
        }
      }

      let searchIndex = 0;
      while (true) {
        // Search for the delimiter '\nFrom '
        const matchIndex = searchBuffer.indexOf(
          MboxParserStream.DELIMITER,
          searchIndex
        );

        // No more matches in this buffer
        if (matchIndex === -1) break;

        // Found a message boundary!
        // Calculate the exact file offset of the boundary
        // The offset should point to the 'F' in 'From ', not the '\n'
        const offsetInChunk = matchIndex - tailLength;
        const filePosition = this.absoluteOffset + offsetInChunk + 1; // +1 to skip '\n'

        // Emit the boundary position
        this.push({ offset: filePosition } as MessageBoundary);

        // Continue searching after this match
        searchIndex = matchIndex + 1;
      }

      // Prepare tail for next chunk to catch split delimiters
      // If we're still checking for first chunk match, keep all accumulated bytes
      if (this.isFirstChunk) {
        // Keep accumulating until we have enough to check or determine it's not a match
        this.tail = searchBuffer.slice(0, MboxParserStream.DELIMITER_START.length);
      } else {
        // Normal operation: keep last few bytes to detect split delimiters
        const tailSize = Math.min(
          MboxParserStream.DELIMITER.length - 1,
          searchBuffer.length
        );
        this.tail = searchBuffer.slice(searchBuffer.length - tailSize);
      }

      // Update absolute offset
      this.absoluteOffset += chunk.length;

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  override _flush(callback: TransformCallback): void {
    // No final processing needed
    callback();
  }

  /**
   * Checks if a buffer starts with 'From ' (case-sensitive)
   */
  private startsWithFromLine(buffer: Buffer): boolean {
    if (buffer.length < MboxParserStream.DELIMITER_START.length) {
      return false;
    }

    return buffer
      .slice(0, MboxParserStream.DELIMITER_START.length)
      .equals(MboxParserStream.DELIMITER_START);
  }

  /**
   * Resets the parser state (useful for reusing the stream)
   */
  reset(): void {
    this.absoluteOffset = 0;
    this.tail = Buffer.alloc(0);
    this.isFirstChunk = true;
  }
}
