#!/usr/bin/env node

/**
 * Delete and Write Example - Modern async/await API
 *
 * This example demonstrates:
 * - Deleting messages
 * - Writing changes to a new file
 * - Resetting deletions
 */

const { Mbox } = require('mbox');

async function main() {
  const filename = process.argv[2] || 'mailbox.mbox';
  const outputFile = process.argv[3] || 'updated-mailbox.mbox';

  try {
    console.log(`Opening ${filename}...`);
    const mbox = await Mbox.create(filename);

    const initialCount = mbox.count();
    console.log(`Initial message count: ${initialCount}`);

    if (initialCount === 0) {
      console.log('No messages to process');
      return;
    }

    // Delete the first message
    console.log('\nDeleting message 0...');
    await mbox.delete(0);
    console.log(`Messages after deletion: ${mbox.count()}`);

    // Delete another message if available
    if (initialCount > 1) {
      console.log('Deleting message 1...');
      await mbox.delete(1);
      console.log(`Messages after deletion: ${mbox.count()}`);
    }

    // Write changes to new file
    console.log(`\nWriting changes to ${outputFile}...`);
    await mbox.write(outputFile);
    console.log('Successfully wrote changes!');

    // Note: Unlike v0.1.x, the mbox instance is still usable
    console.log(`\nMbox is still open and usable (current count: ${mbox.count()})`);

    // Example: Reset deletions
    console.log('\nResetting deletions...');
    mbox.reset();
    console.log(`Messages after reset: ${mbox.count()}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
