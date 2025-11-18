#!/usr/bin/env ts-node

/**
 * TypeScript Example
 *
 * This example demonstrates:
 * - Using node-mbox with TypeScript
 * - Type-safe operations
 * - Proper typing for options and return values
 */

import {
  Mbox,
  MboxOptions,
  MboxState,
  MessageNotFoundError,
  MboxNotReadyError,
  GetMessageOptions,
} from 'mbox';
import { Readable } from 'stream';

async function main(): Promise<void> {
  const filename: string = process.argv[2] || 'mailbox.mbox';

  // Example 1: Creating with options (fully typed)
  console.log('Example 1: Creating mbox with typed options');
  const options: MboxOptions = {
    debug: false,
    bufferSize: 65536,
    encoding: 'utf8',
  };

  const mbox: Mbox = await Mbox.create(filename, options);

  // Example 2: Type-safe state checking
  console.log('\nExample 2: State checking');
  const state: MboxState = mbox.getState();
  console.log(`Current state: ${state}`);

  if (state !== MboxState.READY) {
    console.log('Mbox is not ready yet');
    return;
  }

  // Example 3: Type-safe message operations
  console.log('\nExample 3: Message operations');
  const count: number = mbox.count();
  const total: number = mbox.totalCount();
  console.log(`Messages: ${count} (${total} total)`);

  if (count === 0) {
    console.log('No messages available');
    return;
  }

  // Example 4: Getting message as string (type-safe)
  console.log('\nExample 4: Getting message as string');
  const message: string = await mbox.get(0) as string;
  console.log(`First message length: ${message.length} bytes`);

  // Example 5: Getting message as stream (type-safe)
  console.log('\nExample 5: Getting message as stream');
  const streamOptions: GetMessageOptions = {
    asStream: true,
  };

  const stream: Readable = await mbox.get(0, streamOptions) as Readable;
  console.log(`Received stream: ${stream instanceof Readable}`);

  // Example 6: Error handling with specific types
  console.log('\nExample 6: Type-safe error handling');
  try {
    await mbox.get(9999);
  } catch (error) {
    if (error instanceof MessageNotFoundError) {
      console.log(`Caught MessageNotFoundError: ${error.message}`);
    } else if (error instanceof MboxNotReadyError) {
      console.log(`Caught MboxNotReadyError: ${error.message}`);
    } else {
      console.log(`Caught unknown error: ${error}`);
    }
  }

  // Example 7: Index export with proper typing
  console.log('\nExample 7: Exporting and typing index');
  const index = mbox.exportIndex();
  console.log(`Exported ${index.length} message entries`);

  // Type inference works
  if (index.length > 0) {
    const firstEntry = index[0];
    console.log(`First entry: index=${firstEntry.index}, offset=${firstEntry.offset}, size=${firstEntry.size}`);
  }

  // Example 8: Async iteration pattern
  console.log('\nExample 8: Processing all messages with proper types');
  const messageCount = Math.min(count, 3);

  for (let i = 0; i < messageCount; i++) {
    try {
      const msg: string = await mbox.get(i) as string;
      const preview: string = msg.substring(0, 50).replace(/\n/g, ' ');
      console.log(`Message ${i}: ${preview}...`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error reading message ${i}: ${error.message}`);
      }
    }
  }

  console.log('\nTypeScript example completed successfully!');
}

// Type-safe error handling for main
main().catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
