/**
 * Example: Attachment Extraction
 *
 * This example demonstrates how to extract attachments from
 * mbox files with various filtering and deduplication options.
 *
 * Requirements:
 * - npm install mbox mailparser
 */

import { Mbox } from '../../src/index';

async function extractAllAttachments() {
  // Initialize mbox with parser
  const mbox = await Mbox.create('mailbox.mbox');
  mbox.useParser();

  console.log(`Processing ${mbox.count()} messages...\n`);

  // Example 1: Extract all attachments with deduplication
  console.log('=== Example 1: Extract all with deduplication ===');
  const result1 = await mbox.extractAttachments({
    outputDir: './extracted-attachments',
    deduplicate: true,
    sanitizeFilenames: true,
    onConflict: 'rename',
  });

  console.log(`Total attachments found: ${result1.totalAttachments}`);
  console.log(`Extracted: ${result1.extracted}`);
  console.log(`Skipped: ${result1.skipped}`);
  console.log(`Deduplicated: ${result1.deduplicated}`);
  console.log();

  // Example 2: Extract only PDFs
  console.log('=== Example 2: Extract only PDFs ===');
  const result2 = await mbox.extractAttachments({
    outputDir: './pdfs-only',
    filter: (att) => att.contentType.toLowerCase().includes('pdf'),
    onConflict: 'skip',
  });

  console.log(`PDF attachments extracted: ${result2.extracted}`);
  console.log(`Files: ${result2.files.join(', ')}`);
  console.log();

  // Example 3: Extract images from specific messages
  console.log('=== Example 3: Extract images from first 10 messages ===');
  const result3 = await mbox.extractAttachments({
    outputDir: './images',
    messageIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    filter: (att) => att.contentType.toLowerCase().startsWith('image/'),
    deduplicate: true,
  });

  console.log(`Image attachments extracted: ${result3.extracted}`);
  console.log();

  // Example 4: Filter by size and content type
  console.log('=== Example 4: Extract large documents ===');
  const result4 = await mbox.extractAttachments({
    outputDir: './large-documents',
    filter: (att) => {
      // Only extract attachments larger than 100KB
      const isLarge = att.size > 100 * 1024;
      // Only documents (PDF, Word, Excel, etc.)
      const isDocument =
        att.contentType.includes('pdf') ||
        att.contentType.includes('word') ||
        att.contentType.includes('excel') ||
        att.contentType.includes('spreadsheet') ||
        att.contentType.includes('document');

      return isLarge && isDocument;
    },
    deduplicate: true,
    onConflict: 'overwrite',
  });

  console.log(`Large documents extracted: ${result4.extracted}`);
  console.log();

  // Example 5: Extract with message context
  console.log('=== Example 5: Extract with message-specific filtering ===');
  const result5 = await mbox.extractAttachments({
    outputDir: './filtered-by-message',
    filter: (att, messageIndex) => {
      // Only extract from even-numbered messages
      return messageIndex % 2 === 0;
    },
  });

  console.log(`Attachments from even messages: ${result5.extracted}`);
}

// Run the example
extractAllAttachments().catch((error) => {
  console.error('Error:', error.message);
  if (error.message.includes('mailparser')) {
    console.log('\nTo use attachment extraction, install mailparser:');
    console.log('  npm install mailparser');
  }
  process.exit(1);
});
