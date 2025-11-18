#!/usr/bin/env node

/**
 * Basic Usage Example - Modern async/await API
 *
 * This example demonstrates the basic operations:
 * - Creating an mbox instance
 * - Getting message count
 * - Retrieving messages
 */

const { Mbox } = require('mbox');

async function main() {
  const filename = process.argv[2] || 'mailbox.mbox';

  try {
    // Create and initialize mbox instance
    console.log(`Opening ${filename}...`);
    const mbox = await Mbox.create(filename);

    // Get message counts
    const count = mbox.count();
    const total = mbox.totalCount();
    console.log(`Found ${count} messages (${total} total including deleted)`);

    if (count === 0) {
      console.log('No messages to display');
      return;
    }

    // Retrieve and display first message
    console.log('\n--- Message 0 ---');
    const message = await mbox.get(0);
    console.log(message.substring(0, 500)); // Show first 500 chars

    if (message.length > 500) {
      console.log(`\n... (${message.length - 500} more characters)`);
    }

    // Display info about other messages
    if (count > 1) {
      console.log(`\n${count - 1} more message(s) available`);
      console.log('Use mbox.get(index) to retrieve them');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
