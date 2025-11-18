# Modernizing node-mbox with a Stream-Based Architecture

This document outlines a plan to refactor the legacy node-mbox library to modern TypeScript using a stream-based architecture.

## 1. Why a Stream-Based Architecture?

The original library (main.js) reads file chunks into memory, manually tracks buffer offsets, and parses message boundaries. This approach has two major drawbacks:

-  **High Memory Usage**: Parsing large mbox files requires holding significant metadata (offsets, sizes) and intermediate buffers in RAM.
-  **Complex Logic**: The manual buffer concatenation and matching logic to find `\nFrom` separators, especially across chunk boundaries, is complex and error-prone.

This plan replaces the manual I/O with Node.js Native Streams. This will allow the library to parse, read, and write mbox files of any size with constant (and low) memory usage.

## 2. New Architecture Overview

We will separate the library into three components:

-  **MboxStream (The Parser)**: A Transform stream that consumes raw bytes and emits an event or object whenever it detects a new message boundary (`\nFrom` line).
-  **MboxIndexer (The State Manager)**: Consumes the MboxStream once during initialization to build a lightweight map of file offsets (start/end bytes) for each message without loading the content.
-  **Mbox (The Facade)**: The main class (the new index.ts) that provides the public API. Methods like `get()`, `delete()`, and `write()` will use the indexer and new streams.

## 3. Detailed Implementation Steps

### Step 1: Define Interfaces (src/types.ts)

Strict typing is essential for managing the offset logic.

```typescript
// src/types.ts

/**
 * Represents the metadata for a single message within the mbox file.
 */
export interface MboxMessage {
   index: number;
   offset: number; // Start byte in file
   size: number; // Length in bytes
   deleted: boolean;
}

/**
 * Configuration options for the Mbox constructor.
 */
export interface MboxOptions {
   /**
    * If true, 'get()' returns a Stream instead of a string.
    * @default false
    */
   stream?: boolean;
   debug?: boolean;
}
```

### Step 2: The Stream Parser (src/MboxStream.ts)

This Transform stream is the core of the new architecture. It must handle the "Split Keyword" problem—where the `\nFrom` delimiter is split across two data chunks.

**Strategy:**

-  Extend Transform.
-  Maintain a tail buffer (last 6-7 bytes of the previous chunk).
-  Concatenate tail + newChunk to search for `\nFrom`.
-  Emit the absolute file offset whenever a match is found.

```typescript
// src/MboxStream.ts
import { Transform, TransformCallback } from "stream";

/**
 * A Transform stream that parses a raw mbox file byte stream
 * and emits events for each message boundary it finds.
 */
export class MboxParserStream extends Transform {
   private absoluteOffset: number = 0;
   private tail: Buffer = Buffer.alloc(0);
   private static DELIMITER = Buffer.from("\nFrom ");

   constructor() {
      // We will emit offset objects, not just bytes
      super({ objectMode: true });
   }

   _transform(
      chunk: Buffer,
      encoding: string,
      callback: TransformCallback
   ): void {
      // 1. Combine tail from previous chunk with current chunk
      const searchBuffer = Buffer.concat([this.tail, chunk]);

      let searchIndex = 0;
      while (true) {
         // 2. Search for the delimiter
         const matchIndex = searchBuffer.indexOf(
            MboxParserStream.DELIMITER,
            searchIndex
         );

         // No more matches in this buffer
         if (matchIndex === -1) break;

         // Found a message boundary!
         // Calculate the exact file offset of the boundary
         const offsetInChunk = matchIndex - this.tail.length;
         const filePosition = this.absoluteOffset + offsetInChunk + 1; // +1 to skip \n

         // 3. Emit the boundary position
         this.push({ offset: filePosition });
         searchIndex = matchIndex + 1;
      }

      // 4. Prepare tail for next chunk (to catch split delimiters)
      const tailLen = MboxParserStream.DELIMITER.length;
      this.tail = chunk.slice(chunk.length - tailLen);
      this.absoluteOffset += chunk.length;

      callback();
   }
}
```

### Step 3: The Main Class (src/Mbox.ts)

This class replaces main.js. It uses `fs.createReadStream` and our MboxParserStream to build an index on initialization.

```typescript
// src/Mbox.ts
import * as fs from "fs";
import { EventEmitter } from "events";
import { MboxParserStream } from "./MboxStream";
import { MboxMessage, MboxOptions } from "./types";

export class Mbox extends EventEmitter {
   private filename: string;
   private messages: MboxMessage[] = [];
   private state: "INIT" | "READY" | "ERROR" = "INIT";

   constructor(filename: string, options: MboxOptions = {}) {
      super();
      this.filename = filename;
      this.indexFile();
   }

   /**
    * Initializes the mbox file by streaming it through the parser
    * to build an index of message offsets and sizes.
    */
   private indexFile() {
      const readStream = fs.createReadStream(this.filename);
      const parser = new MboxParserStream();
      let msgIndex = 0;

      readStream.pipe(parser);

      parser.on("data", (data: { offset: number }) => {
         // A boundary was found. This closes the *previous* message.
         if (this.messages.length > 0) {
            const prev = this.messages[this.messages.length - 1];
            prev.size = data.offset - prev.offset;
         }

         // Start a new message metadata object
         this.messages.push({
            index: msgIndex++,
            offset: data.offset,
            size: 0, // Will be calculated when next msg boundary is found (or on 'end')
            deleted: false,
         });
      });

      parser.on("end", () => {
         // Reached End-of-File. We must set the size for the very last message.
         const stat = fs.statSync(this.filename);
         if (this.messages.length > 0) {
            const last = this.messages[this.messages.length - 1];
            last.size = stat.size - last.offset;
         }

         this.state = "READY";
         this.emit("init", true);
      });

      readStream.on("error", (err) => {
         this.state = "ERROR";
         this.emit("error", err);
      });
   }

   // ... API implementations ...
}
```

### Step 4: Implementing Random Access get()

Instead of reading from a file descriptor, we use `fs.createReadStream` with `start` and `end` options to fetch only the bytes for that specific message. This is incredibly efficient.

```typescript
// Inside Mbox class

/**
 * Retrieves a single message by its index.
 * @returns A Promise that resolves to the message content as a string.
 */
public async get(index: number): Promise<string> {
  if (this.state !== 'READY') throw new Error("Mbox not initialized.");
  if (index < 0 || index >= this.messages.length) throw new Error("Index out of bounds");

  const msg = this.messages[index];
  if (msg.deleted) throw new Error("Message deleted");

  // Create a stream for just this byte range
  const stream = fs.createReadStream(this.filename, {
    start: msg.offset,
    end: msg.offset + msg.size - 1, // 'end' is inclusive
    encoding: 'utf8' // Automatically handles buffer conversion
  });

  // Consume the stream into a string
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk as string));
    stream.on('end', () => resolve(chunks.join('')));
    stream.on('error', reject);
  });
}
```

### Step 5: Implementing write() (Sync to Disk)

The original implementation used a complex recursive function (syncToTmp). With a stream-based architecture, we can write a new file by iterating our message index and streaming only the valid (non-deleted) byte ranges.

```typescript
// Inside Mbox class

/**
 * Writes all non-deleted messages to a new mbox file.
 * This is the replacement for the old 'syncToTmp' logic.
 */
public async write(destination: string): Promise<void> {
  if (this.state !== 'READY') throw new Error("Mbox not initialized.");

  const writeStream = fs.createWriteStream(destination);

  for (const msg of this.messages) {
    if (msg.deleted) continue;

    // Create a new read stream for each message's byte range
    // and pipe it to the destination, waiting for it to finish.
    await new Promise<void>((resolve, reject) => {
      const readRange = fs.createReadStream(this.filename, {
        start: msg.offset,
        end: msg.offset + msg.size - 1
      });

      // Pipe to writeStream but *don't* end the writeStream yet
      readRange.pipe(writeStream, { end: false });

      readRange.on('end', resolve);
      readRange.on('error', reject);
    });
  }

  // All ranges have been piped; now we can close the write stream.
  writeStream.end();
}
```

## 4. Migration Path Summary

| Feature        | Old Implementation (main.js)           | Plan C Implementation (TypeScript)        |
| -------------- | -------------------------------------- | ----------------------------------------- |
| File Reading   | `fs.read` in loop, manual offset math. | `fs.createReadStream` piped to Transform. |
| Parsing        | Buffer matching inside read loop.      | Transform stream detecting delimiters.    |
| State Storage  | Separate arrays: offsets, sizes.       | Single array: `MboxMessage[]`.            |
| Get Message    | `fs.read(fd, buffer, ...)`             | `fs.createReadStream({start, end})`.      |
| Delete Message | `delete messages.offsets[msgnumber]`.  | `this.messages[index].deleted = true`.    |
| Write File     | Complex syncToTmp recursion.           | writeByRanges using stream piping.        |
| Dependencies   | unixlib (for mkstemp).                 | None (Native fs only).                    |

## 5. Next Steps

1. **Initialize Project**: Set up package.json (add typescript, @types/node) and tsconfig.json.
2. **Create src/types.ts**: Add the interfaces.
3. **Create src/MboxStream.ts**: Implement the Transform stream.
4. **Create src/index.ts**: Implement the Mbox class.
5. **Test**: Create a test file that generates a dummy mbox file and verifies that `get(i)` retrieves the correct content.
