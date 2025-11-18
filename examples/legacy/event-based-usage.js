#!/usr/bin/env node

/**
 * Event-Based Usage Example - Legacy API
 *
 * This example demonstrates the event-based API for backwards compatibility with v0.1.x
 *
 * This is functionally equivalent to the modern async/await API,
 * but uses events instead of Promises.
 */

const { Mbox } = require('mbox');

const filename = process.argv[2] || 'mailbox.mbox';

console.log(`Opening ${filename}...`);
const mbox = new Mbox(filename);

// Handle initialization
mbox.on('init', (success, error) => {
  if (success) {
    const count = mbox.count();
    console.log(`Successfully initialized mbox with ${count} messages`);

    if (count > 0) {
      console.log('\nRetrieving first message...');
      mbox.get(0);
    } else {
      console.log('No messages to display');
    }
  } else {
    console.error('Failed to initialize mbox:', error.message);
    process.exit(1);
  }
});

// Handle message retrieval
mbox.on('get', (success, index, data) => {
  if (success) {
    console.log(`\n--- Message ${index} ---`);
    console.log(data.substring(0, 500)); // Show first 500 chars

    if (data.length > 500) {
      console.log(`\n... (${data.length - 500} more characters)`);
    }

    const count = mbox.count();
    if (index + 1 < count) {
      console.log(`\n${count - index - 1} more message(s) available`);
    }

    // Example: Delete the message
    if (process.argv.includes('--delete')) {
      console.log(`\nDeleting message ${index}...`);
      mbox.delete(index);
    }
  } else {
    console.error(`Failed to retrieve message ${index}`);
  }
});

// Handle message deletion
mbox.on('delete', (success, index) => {
  if (success) {
    console.log(`Successfully deleted message ${index}`);
    console.log(`Remaining messages: ${mbox.count()}`);

    // Example: Write changes
    if (process.argv.includes('--write')) {
      console.log('\nWriting changes to output.mbox...');
      mbox.write('output.mbox');
    }
  } else {
    console.error(`Failed to delete message ${index}`);
  }
});

// Handle write operation
mbox.on('write', (success, filename) => {
  if (success) {
    console.log(`Successfully wrote to ${filename}`);
    console.log('Note: Unlike v0.1.x, the mbox instance is still usable!');
    console.log(`Current message count: ${mbox.count()}`);
  } else {
    console.error('Failed to write mbox');
  }
});

// Handle reset operation
mbox.on('reset', (success) => {
  if (success) {
    console.log('Successfully reset deletions');
    console.log(`Messages after reset: ${mbox.count()}`);
  } else {
    console.error('Failed to reset');
  }
});

// Handle errors
mbox.on('error', (error) => {
  console.error('Error occurred:', error.message);
});

// Usage information
if (process.argv.includes('--help')) {
  console.log(`
Usage: node event-based-usage.js [filename] [options]

Options:
  --delete    Delete the first message
  --write     Write changes to output.mbox
  --help      Show this help message

Example:
  node event-based-usage.js mailbox.mbox --delete --write
  `);
  process.exit(0);
}
