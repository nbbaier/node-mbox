/**
 * Type definitions for node-mbox
 * Provides strict typing for mbox file parsing and manipulation
 */

import { Readable } from 'stream';

/**
 * Represents the metadata for a single message within the mbox file.
 * Immutable after creation, except for the deleted flag.
 */
export class MboxMessage {
  public readonly index: number;
  public readonly offset: number;
  public readonly size: number;
  private _deleted: boolean;

  constructor(index: number, offset: number, size: number, deleted = false) {
    if (index < 0) {
      throw new Error(`Invalid message index: ${index}`);
    }
    if (offset < 0) {
      throw new Error(`Invalid message offset: ${offset}`);
    }
    if (size < 0) {
      throw new Error(`Invalid message size: ${size}`);
    }

    this.index = index;
    this.offset = offset;
    this.size = size;
    this._deleted = deleted;
  }

  get deleted(): boolean {
    return this._deleted;
  }

  /**
   * Marks this message as deleted
   */
  markDeleted(): void {
    this._deleted = true;
  }

  /**
   * Creates a copy of this message with the specified size
   */
  withSize(size: number): MboxMessage {
    return new MboxMessage(this.index, this.offset, size, this._deleted);
  }

  /**
   * Creates a plain object representation for serialization
   */
  toJSON(): MboxMessageJSON {
    return {
      index: this.index,
      offset: this.offset,
      size: this.size,
      deleted: this._deleted,
    };
  }

  /**
   * Restores a MboxMessage from JSON
   */
  static fromJSON(json: MboxMessageJSON): MboxMessage {
    return new MboxMessage(json.index, json.offset, json.size, json.deleted);
  }
}

/**
 * Plain object representation of MboxMessage for serialization
 */
export interface MboxMessageJSON {
  index: number;
  offset: number;
  size: number;
  deleted: boolean;
}

/**
 * Configuration options for the Mbox constructor.
 */
export interface MboxOptions {
  /**
   * If true, enables debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Buffer size for reading file chunks during indexing
   * @default 65536 (64KB)
   */
  bufferSize?: number;

  /**
   * Default encoding for message content
   * @default 'utf8'
   */
  encoding?: BufferEncoding;

  /**
   * If provided, restore the mbox from a saved index
   * This skips the initial file scan
   */
  savedIndex?: MboxMessageJSON[];

  /**
   * If true, throw error if file doesn't start with 'From '
   * @default false
   */
  strict?: boolean;
}

/**
 * Options for retrieving a message
 */
export interface GetMessageOptions {
  /**
   * If true, returns a Readable stream instead of a string
   * @default false
   */
  asStream?: boolean;

  /**
   * Encoding to use when returning string content
   * Overrides the default encoding from MboxOptions
   */
  encoding?: BufferEncoding;
}

/**
 * Return type for get() method - either string or stream
 */
export type MessageContent = string | Readable;

/**
 * Represents a message boundary detected by the parser
 */
export interface MessageBoundary {
  /**
   * Absolute file offset where the boundary starts
   * (points to 'F' in 'From ')
   */
  offset: number;
}

/**
 * State of the Mbox instance
 */
export enum MboxState {
  /** Initial state, before indexing starts */
  INIT = 'INIT',
  /** Currently indexing the file */
  INDEXING = 'INDEXING',
  /** Ready for operations */
  READY = 'READY',
  /** Error occurred during initialization or operation */
  ERROR = 'ERROR',
}

/**
 * Events emitted by the Mbox class
 */
export interface MboxEvents {
  /**
   * Emitted when initialization completes
   * @param success - true if successful, false otherwise
   * @param error - error object if success is false
   */
  init: (success: boolean, error?: Error) => void;

  /**
   * Emitted when a message is retrieved
   * @param success - true if successful, false otherwise
   * @param index - message index
   * @param data - message content (only if success is true)
   */
  get: (success: boolean, index: number, data?: string) => void;

  /**
   * Emitted when a message is deleted
   * @param success - true if successful, false otherwise
   * @param index - message index
   */
  delete: (success: boolean, index: number) => void;

  /**
   * Emitted when the mbox is written to disk
   * @param success - true if successful, false otherwise
   * @param filename - destination filename
   */
  write: (success: boolean, filename?: string) => void;

  /**
   * Emitted when deleted messages are restored
   * @param success - true if successful, false otherwise
   */
  reset: (success: boolean) => void;

  /**
   * Emitted on errors
   * @param error - the error that occurred
   */
  error: (error: Error) => void;
}

/**
 * Error thrown when attempting operations before the mbox is ready
 */
export class MboxNotReadyError extends Error {
  constructor(currentState: MboxState) {
    super(
      `Mbox not ready for operations (current state: ${currentState}). Wait for 'init' event or await ready().`
    );
    this.name = 'MboxNotReadyError';
    Object.setPrototypeOf(this, MboxNotReadyError.prototype);
  }
}

/**
 * Error thrown when attempting to access an invalid message index
 */
export class MessageNotFoundError extends Error {
  constructor(index: number, reason: 'out-of-bounds' | 'deleted') {
    const message =
      reason === 'out-of-bounds'
        ? `Message index ${index} is out of bounds`
        : `Message ${index} has been deleted`;
    super(message);
    this.name = 'MessageNotFoundError';
    Object.setPrototypeOf(this, MessageNotFoundError.prototype);
  }
}
