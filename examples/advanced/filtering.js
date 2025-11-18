#!/usr/bin/env node

/**
 * Filtering and Searching Example
 *
 * This example demonstrates:
 * - Searching for messages by content
 * - Filtering by message headers
 * - Creating filtered mbox files
 */

const { Mbox } = require('mbox');

/**
 * Parse email headers from a message
 */
function parseHeaders(message) {
  const headers = {};
  const lines = message.split('\n');

  let currentHeader = null;
  for (const line of lines) {
    // Empty line indicates end of headers
    if (line.trim() === '') break;

    // Continuation of previous header (starts with whitespace)
    if (line.match(/^\s/) && currentHeader) {
      headers[currentHeader] += ' ' + line.trim();
    } else {
      // New header
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [, name, value] = match;
        currentHeader = name.toLowerCase();
        headers[currentHeader] = value;
      }
    }
  }

  return headers;
}

/**
 * Search messages by criteria
 */
async function searchMessages(mbox, criteria) {
  const results = [];
  const count = mbox.count();

  console.log(`Searching ${count} messages...`);

  for (let i = 0; i < count; i++) {
    try {
      const message = await mbox.get(i);
      const headers = parseHeaders(message);

      if (criteria(message, headers, i)) {
        results.push({
          index: i,
          from: headers.from || 'Unknown',
          subject: headers.subject || 'No subject',
          date: headers.date || 'Unknown',
        });
      }
    } catch (error) {
      console.error(`Error processing message ${i}:`, error.message);
    }
  }

  return results;
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

    // Example 1: Search by sender
    console.log('=== Example 1: Search by Sender ===\n');
    const fromResults = await searchMessages(
      mbox,
      (message, headers) => {
        return headers.from && headers.from.toLowerCase().includes('example.com');
      }
    );

    console.log(`Found ${fromResults.length} messages from *example.com:`);
    fromResults.slice(0, 5).forEach(result => {
      console.log(`  [${result.index}] From: ${result.from}`);
      console.log(`      Subject: ${result.subject}`);
    });

    if (fromResults.length > 5) {
      console.log(`  ... and ${fromResults.length - 5} more`);
    }

    // Example 2: Search by subject
    console.log('\n\n=== Example 2: Search by Subject ===\n');
    const subjectResults = await searchMessages(
      mbox,
      (message, headers) => {
        return headers.subject && headers.subject.toLowerCase().includes('important');
      }
    );

    console.log(`Found ${subjectResults.length} messages with "important" in subject:`);
    subjectResults.slice(0, 5).forEach(result => {
      console.log(`  [${result.index}] Subject: ${result.subject}`);
      console.log(`      From: ${result.from}`);
    });

    // Example 3: Search by date range
    console.log('\n\n=== Example 3: Search by Date ===\n');
    const dateResults = await searchMessages(
      mbox,
      (message, headers) => {
        // Simple date check (you'd want to parse dates properly in production)
        return headers.date && headers.date.includes('2024');
      }
    );

    console.log(`Found ${dateResults.length} messages from 2024:`);
    dateResults.slice(0, 5).forEach(result => {
      console.log(`  [${result.index}] Date: ${result.date}`);
      console.log(`      Subject: ${result.subject}`);
    });

    // Example 4: Search by content
    console.log('\n\n=== Example 4: Search by Content ===\n');
    const searchTerm = process.argv[3] || 'password';
    const contentResults = await searchMessages(
      mbox,
      (message) => {
        return message.toLowerCase().includes(searchTerm.toLowerCase());
      }
    );

    console.log(`Found ${contentResults.length} messages containing "${searchTerm}":`);
    contentResults.slice(0, 5).forEach(result => {
      console.log(`  [${result.index}] Subject: ${result.subject}`);
    });

    // Example 5: Create filtered mbox
    console.log('\n\n=== Example 5: Create Filtered Mbox ===\n');

    // Create a new mbox with only messages matching criteria
    const filterCriteria = await searchMessages(
      mbox,
      (message, headers) => {
        // Keep messages with attachments (Content-Type: multipart)
        const contentType = headers['content-type'] || '';
        return contentType.includes('multipart');
      }
    );

    console.log(`Found ${filterCriteria.length} messages with attachments`);

    // Delete all messages except the ones we want to keep
    console.log('Creating filtered copy...');
    for (let i = 0; i < count; i++) {
      if (!filterCriteria.find(r => r.index === i)) {
        await mbox.delete(i);
      }
    }

    // Write filtered mbox
    const outputFile = 'filtered-mailbox.mbox';
    await mbox.write(outputFile);
    console.log(`✓ Created filtered mbox: ${outputFile} (${filterCriteria.length} messages)`);

    // Reset to restore deleted messages
    mbox.reset();
    console.log('✓ Original mbox restored (deletions undone)');

    // Example 6: Complex filtering
    console.log('\n\n=== Example 6: Complex Filtering ===\n');

    const complexResults = await searchMessages(
      mbox,
      (message, headers) => {
        // Multiple criteria: from specific domain AND large message
        const fromMatch = headers.from && headers.from.includes('@');
        const sizeMatch = message.length > 1024;
        return fromMatch && sizeMatch;
      }
    );

    console.log(`Found ${complexResults.length} messages matching complex criteria:`);
    console.log('  Criteria: Has email sender AND size > 1KB');
    complexResults.slice(0, 3).forEach(result => {
      console.log(`  [${result.index}] From: ${result.from.substring(0, 50)}`);
      console.log(`      Subject: ${result.subject.substring(0, 50)}`);
    });

    console.log('\n=== Filtering Tips ===');
    console.log(`
- Use simple string matching for basic searches
- Parse headers for structured filtering
- Combine multiple criteria for complex searches
- Use mbox.delete() and mbox.write() to create filtered copies
- Remember to call mbox.reset() to undo deletions if needed
    `);

    console.log('\nFiltering examples completed!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
