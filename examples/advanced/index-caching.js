#!/usr/bin/env node

/**
 * Index Caching Example
 *
 * This example demonstrates:
 * - Exporting the message index for caching
 * - Restoring from a cached index
 * - Performance comparison: first scan vs cached load
 */

const { Mbox } = require('mbox');
const fs = require('fs');

async function main() {
  const filename = process.argv[2] || 'mailbox.mbox';
  const indexFile = filename + '.index.json';

  console.log('=== Index Caching Performance Demo ===\n');

  try {
    // Scenario 1: First load (no cache)
    console.log('Scenario 1: Loading without cache...');
    const start1 = Date.now();

    const mbox1 = await Mbox.create(filename);
    const time1 = Date.now() - start1;

    console.log(`✓ Loaded ${mbox1.count()} messages in ${time1}ms`);

    // Export the index for caching
    console.log('\nExporting index for caching...');
    const index = mbox1.exportIndex();
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
    console.log(`✓ Saved index to ${indexFile} (${index.length} entries)`);

    // Show index structure
    if (index.length > 0) {
      console.log('\nSample index entry:');
      console.log(JSON.stringify(index[0], null, 2));
    }

    // Scenario 2: Load with cache
    console.log('\n\nScenario 2: Loading with cached index...');
    const start2 = Date.now();

    const savedIndex = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    const mbox2 = await Mbox.create(filename, { savedIndex });
    const time2 = Date.now() - start2;

    console.log(`✓ Loaded ${mbox2.count()} messages in ${time2}ms`);

    // Compare performance
    console.log('\n=== Performance Comparison ===');
    console.log(`Without cache: ${time1}ms`);
    console.log(`With cache:    ${time2}ms`);
    console.log(`Speedup:       ${time2 > 0 ? (time1 / time2).toFixed(2) : 'N/A'}x faster`);
    console.log(`Time saved:    ${time1 - time2}ms`);

    // Verify cache is valid
    console.log('\n=== Validating Cache ===');
    const msg1 = await mbox2.get(0);
    console.log(`✓ Successfully retrieved message from cached mbox`);
    console.log(`Message length: ${msg1.length} bytes`);

    // Example: Real-world caching strategy
    console.log('\n=== Recommended Caching Strategy ===');
    console.log(`
// Check if cache exists and is newer than mbox file
const mboxStat = fs.statSync('mailbox.mbox');
const cachePath = 'mailbox.mbox.index.json';

let mbox;
if (fs.existsSync(cachePath)) {
  const cacheStat = fs.statSync(cachePath);

  // Use cache if it's newer than the mbox file
  if (cacheStat.mtime > mboxStat.mtime) {
    const savedIndex = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    mbox = await Mbox.create('mailbox.mbox', { savedIndex });
    console.log('Loaded from cache');
  } else {
    // Cache is stale, rebuild it
    mbox = await Mbox.create('mailbox.mbox');
    fs.writeFileSync(cachePath, JSON.stringify(mbox.exportIndex()));
    console.log('Cache was stale, rebuilt index');
  }
} else {
  // No cache exists, create it
  mbox = await Mbox.create('mailbox.mbox');
  fs.writeFileSync(cachePath, JSON.stringify(mbox.exportIndex()));
  console.log('Created new index cache');
}
    `);

    console.log('\nIndex caching demo completed!');
    console.log(`Cache file saved to: ${indexFile}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
