#!/usr/bin/env node

/**
 * Batch Processing Example
 *
 * This example demonstrates:
 * - Efficiently processing large mailboxes
 * - Parallel processing with controlled concurrency
 * - Progress tracking and statistics
 */

const { Mbox } = require('mbox');

/**
 * Process messages in batches with controlled concurrency
 */
async function processBatch(mbox, batchSize = 10, concurrency = 3) {
  const count = mbox.count();
  const results = {
    total: count,
    processed: 0,
    errors: 0,
    totalBytes: 0,
  };

  console.log(`Processing ${count} messages in batches of ${batchSize} with concurrency ${concurrency}`);

  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const batchEnd = Math.min(i + batchSize, count);

    // Create batch of promises with controlled concurrency
    for (let j = i; j < batchEnd; j += concurrency) {
      const chunk = [];
      const chunkEnd = Math.min(j + concurrency, batchEnd);

      for (let k = j; k < chunkEnd; k++) {
        chunk.push(
          mbox.get(k)
            .then(message => {
              results.processed++;
              results.totalBytes += message.length;
              return { index: k, size: message.length, success: true };
            })
            .catch(error => {
              results.errors++;
              return { index: k, error: error.message, success: false };
            })
        );
      }

      const chunkResults = await Promise.all(chunk);
      batch.push(...chunkResults);
    }

    // Progress update
    const progress = ((batchEnd / count) * 100).toFixed(1);
    console.log(`Progress: ${progress}% (${batchEnd}/${count})`);
  }

  return results;
}

/**
 * Example: Filter messages by criteria
 */
async function filterMessages(mbox, predicate) {
  const count = mbox.count();
  const matches = [];

  for (let i = 0; i < count; i++) {
    try {
      const message = await mbox.get(i);
      if (predicate(message, i)) {
        matches.push(i);
      }
    } catch (error) {
      console.error(`Error processing message ${i}:`, error.message);
    }
  }

  return matches;
}

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

    // Example 1: Batch processing with statistics
    console.log('=== Example 1: Batch Processing ===\n');
    const startTime = Date.now();
    const results = await processBatch(mbox, 10, 3);
    const duration = Date.now() - startTime;

    console.log('\n=== Processing Results ===');
    console.log(`Total messages: ${results.total}`);
    console.log(`Processed: ${results.processed}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Total bytes: ${results.totalBytes.toLocaleString()}`);
    console.log(`Average size: ${Math.round(results.totalBytes / results.processed).toLocaleString()} bytes`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Throughput: ${(results.processed / (duration / 1000)).toFixed(2)} messages/sec`);

    // Example 2: Filter messages
    console.log('\n\n=== Example 2: Filtering Messages ===\n');

    // Find messages larger than 1KB
    console.log('Finding messages larger than 1KB...');
    const largeMessages = await filterMessages(
      mbox,
      (message) => message.length > 1024
    );
    console.log(`Found ${largeMessages.length} large messages: ${largeMessages.slice(0, 5).join(', ')}${largeMessages.length > 5 ? '...' : ''}`);

    // Find messages containing specific text
    console.log('\nFinding messages containing "From:"...');
    const fromMessages = await filterMessages(
      mbox,
      (message) => message.includes('From:')
    );
    console.log(`Found ${fromMessages.length} messages with "From:" header`);

    // Example 3: Analyze message sizes
    console.log('\n\n=== Example 3: Message Size Analysis ===\n');

    const sizes = [];
    const maxSamples = Math.min(count, 100);

    for (let i = 0; i < maxSamples; i++) {
      try {
        const message = await mbox.get(i);
        sizes.push(message.length);
      } catch (error) {
        console.error(`Error reading message ${i}`);
      }
    }

    if (sizes.length > 0) {
      sizes.sort((a, b) => a - b);

      const min = sizes[0];
      const max = sizes[sizes.length - 1];
      const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const median = sizes[Math.floor(sizes.length / 2)];

      console.log(`Analyzed ${sizes.length} messages:`);
      console.log(`  Min size: ${min.toLocaleString()} bytes`);
      console.log(`  Max size: ${max.toLocaleString()} bytes`);
      console.log(`  Average: ${Math.round(avg).toLocaleString()} bytes`);
      console.log(`  Median: ${median.toLocaleString()} bytes`);

      // Size distribution
      const ranges = [
        { label: '< 1KB', count: 0 },
        { label: '1KB - 10KB', count: 0 },
        { label: '10KB - 100KB', count: 0 },
        { label: '100KB - 1MB', count: 0 },
        { label: '> 1MB', count: 0 },
      ];

      sizes.forEach(size => {
        if (size < 1024) ranges[0].count++;
        else if (size < 10240) ranges[1].count++;
        else if (size < 102400) ranges[2].count++;
        else if (size < 1048576) ranges[3].count++;
        else ranges[4].count++;
      });

      console.log('\nSize distribution:');
      ranges.forEach(range => {
        const percentage = ((range.count / sizes.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(range.count / sizes.length * 50));
        console.log(`  ${range.label.padEnd(15)} ${bar} ${percentage}% (${range.count})`);
      });
    }

    console.log('\nBatch processing examples completed!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
