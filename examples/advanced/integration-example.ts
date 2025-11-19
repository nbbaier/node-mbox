/**
 * Example: Complete Integration - Search, Parse, Extract
 *
 * This example demonstrates a real-world workflow combining
 * all features: searching messages, parsing emails, and
 * extracting attachments based on criteria.
 *
 * Requirements:
 * - npm install mbox mailparser
 */

import { Mbox } from '../../src/index';

async function processMailbox() {
  // Initialize mbox
  const mbox = await Mbox.create('mailbox.mbox');
  mbox.useParser();

  console.log(`Processing mailbox with ${mbox.count()} messages\n`);

  // Step 1: Find all messages from a specific sender
  console.log('=== Step 1: Finding messages from specific sender ===');
  const targetSender = 'example@example.com';
  const matchingIndices: number[] = [];

  for await (const { index, email } of mbox.iterateParsed()) {
    if (email.from?.includes(targetSender)) {
      console.log(`Found message ${index}: "${email.subject}"`);
      matchingIndices.push(index);
    }
  }

  console.log(`\nFound ${matchingIndices.length} messages from ${targetSender}\n`);

  // Step 2: Extract attachments only from those messages
  if (matchingIndices.length > 0) {
    console.log('=== Step 2: Extracting attachments from matched messages ===');
    const result = await mbox.extractAttachments({
      outputDir: `./attachments-from-${targetSender.replace('@', '-at-')}`,
      messageIndices: matchingIndices,
      deduplicate: true,
      filter: (att) => {
        // Skip inline images (CID attachments)
        if (att.cid) return false;
        // Only extract actual file attachments
        return att.contentDisposition !== 'inline';
      },
    });

    console.log(`Extracted ${result.extracted} attachments`);
    console.log(`Deduplicated: ${result.deduplicated}`);
    console.log();
  }

  // Step 3: Generate a report
  console.log('=== Step 3: Generating statistics ===');
  let totalAttachments = 0;
  const senderCounts = new Map<string, number>();
  const subjectKeywords = new Map<string, number>();

  for await (const { email } of mbox.iterateParsed({ skipTextBody: true })) {
    // Count attachments
    totalAttachments += email.attachments.length;

    // Count messages per sender
    const sender = email.from || 'unknown';
    senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);

    // Extract keywords from subject
    const subject = email.subject?.toLowerCase() || '';
    const keywords = ['invoice', 'report', 'urgent', 'meeting', 'follow-up'];
    for (const keyword of keywords) {
      if (subject.includes(keyword)) {
        subjectKeywords.set(keyword, (subjectKeywords.get(keyword) || 0) + 1);
      }
    }
  }

  console.log(`Total attachments: ${totalAttachments}`);
  console.log('\nTop 5 senders:');
  const topSenders = Array.from(senderCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  topSenders.forEach(([sender, count]) => {
    console.log(`  ${sender}: ${count} messages`);
  });

  console.log('\nSubject keyword frequency:');
  Array.from(subjectKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([keyword, count]) => {
      console.log(`  ${keyword}: ${count} occurrences`);
    });

  // Step 4: Create a cleaned mailbox (remove messages without attachments)
  console.log('\n=== Step 4: Creating filtered mailbox ===');
  let deleteCount = 0;
  for (let i = 0; i < mbox.totalCount(); i++) {
    try {
      const email = await mbox.getParsed(i, { skipTextBody: true, skipHtmlBody: true });
      if (email.attachments.length === 0) {
        await mbox.delete(i);
        deleteCount++;
      }
    } catch (error) {
      // Message might be already deleted or invalid
      continue;
    }
  }

  console.log(`Marked ${deleteCount} messages without attachments for deletion`);
  console.log(`Remaining messages: ${mbox.count()}`);

  // Write the cleaned mailbox
  await mbox.write('mailbox-with-attachments-only.mbox');
  console.log('Created: mailbox-with-attachments-only.mbox');

  // Export index for future use
  const index = mbox.exportIndex();
  console.log(`\nExported index with ${index.length} entries for caching`);
}

// Run the example
processMailbox().catch((error) => {
  console.error('Error:', error.message);
  if (error.message.includes('mailparser')) {
    console.log('\nTo use this example, install mailparser:');
    console.log('  npm install mailparser');
  }
  process.exit(1);
});
