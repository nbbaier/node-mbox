#!/usr/bin/env node

/**
 * Error Handling Example - Modern async/await API
 *
 * This example demonstrates:
 * - Proper error handling with try/catch
 * - Handling specific error types
 * - Graceful error recovery
 */

const { Mbox, MboxNotReadyError, MessageNotFoundError } = require('mbox');

async function main() {
  const filename = process.argv[2] || 'mailbox.mbox';

  // Example 1: Handling initialization errors
  try {
    console.log('Example 1: File not found error');
    const mbox = await Mbox.create('nonexistent.mbox');
  } catch (error) {
    console.log(`✓ Caught error: ${error.message}`);
  }

  // Example 2: Handling invalid message index
  try {
    console.log('\nExample 2: Invalid message index');
    const mbox = await Mbox.create(filename);
    await mbox.get(9999); // Likely out of bounds
  } catch (error) {
    if (error instanceof MessageNotFoundError) {
      console.log(`✓ Caught MessageNotFoundError: ${error.message}`);
    } else {
      console.log(`✓ Caught error: ${error.message}`);
    }
  }

  // Example 3: Accessing deleted message
  try {
    console.log('\nExample 3: Accessing deleted message');
    const mbox = await Mbox.create(filename);

    if (mbox.count() > 0) {
      await mbox.delete(0);
      await mbox.get(0); // Try to access deleted message
    } else {
      console.log('⚠ Skipped: No messages in mbox');
    }
  } catch (error) {
    if (error instanceof MessageNotFoundError) {
      console.log(`✓ Caught MessageNotFoundError: ${error.message}`);
    }
  }

  // Example 4: Using mbox before ready (when using constructor)
  try {
    console.log('\nExample 4: Using mbox before ready');
    const mbox = new Mbox(filename);
    // Don't await ready() - try to use immediately
    mbox.count(); // This will work, but...

    // Try an async operation before ready
    try {
      await mbox.get(0);
    } catch (err) {
      if (err instanceof MboxNotReadyError) {
        console.log(`✓ Caught MboxNotReadyError: ${err.message}`);
        // Now wait for ready and try again
        await mbox.ready();
        console.log('✓ After ready(), operations work fine');
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  // Example 5: Best practice - comprehensive error handling
  console.log('\nExample 5: Best practice error handling');
  try {
    const mbox = await Mbox.create(filename);
    const count = mbox.count();

    if (count === 0) {
      console.log('✓ No messages to process');
      return;
    }

    for (let i = 0; i < Math.min(count, 3); i++) {
      try {
        const message = await mbox.get(i);
        console.log(`✓ Message ${i}: ${message.substring(0, 50)}...`);
      } catch (error) {
        console.log(`⚠ Could not retrieve message ${i}: ${error.message}`);
        // Continue processing other messages
      }
    }

  } catch (error) {
    console.error('✗ Fatal error:', error.message);
    process.exit(1);
  }

  console.log('\nAll error handling examples completed!');
}

main();
