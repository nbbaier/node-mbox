#!/usr/bin/env node

/**
 * Streaming Example
 *
 * This example demonstrates:
 * - Getting messages as streams (for large messages)
 * - Processing streams efficiently
 * - Memory-efficient handling of large mailboxes
 */

const { Mbox } = require('mbox');
const fs = require('fs');

async function main() {
  const filename = process.argv[2] || 'mailbox.mbox';

  try {
    console.log(`Opening ${filename}...`);
    const mbox = await Mbox.create(filename);

    const count = mbox.count();
    console.log(`Found ${count} messages\n`);

    if (count === 0) {
      console.log('No messages to process');
      return;
    }

    // Example 1: Stream to stdout
    console.log('Example 1: Streaming message to stdout');
    console.log('--- Message 0 (streamed) ---');

    const stream = await mbox.get(0, { asStream: true });
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
      stream.pipe(process.stdout);
    });

    console.log('\n--- End of message ---\n');

    // Example 2: Stream to file
    if (count > 0) {
      console.log('Example 2: Streaming message to file');
      const outputFile = 'message-0.eml';

      const messageStream = await mbox.get(0, { asStream: true });
      const writeStream = fs.createWriteStream(outputFile);

      await new Promise((resolve, reject) => {
        messageStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        messageStream.pipe(writeStream);
      });

      console.log(`✓ Saved message 0 to ${outputFile}\n`);
    }

    // Example 3: Process stream with custom logic
    if (count > 0) {
      console.log('Example 3: Processing stream data');

      const stream = await mbox.get(0, { asStream: true });
      let bytesRead = 0;
      let lineCount = 0;

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          bytesRead += chunk.length;
          lineCount += chunk.toString().split('\n').length - 1;
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      console.log(`✓ Processed ${bytesRead} bytes, ${lineCount} lines\n`);
    }

    // Example 4: Stream multiple messages
    console.log('Example 4: Streaming multiple messages to separate files');
    const messagesToExport = Math.min(count, 3);

    for (let i = 0; i < messagesToExport; i++) {
      const outputFile = `message-${i}.eml`;
      const stream = await mbox.get(i, { asStream: true });
      const writeStream = fs.createWriteStream(outputFile);

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        stream.pipe(writeStream);
      });

      console.log(`✓ Exported message ${i} to ${outputFile}`);
    }

    console.log('\nStreaming examples completed!');
    console.log('Note: Streaming is useful for very large messages that might not fit in memory.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
