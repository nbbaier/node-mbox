/**
 * Example: Email Parsing with mailparser integration
 *
 * This example demonstrates how to parse structured email data
 * from mbox files using the optional mailparser integration.
 *
 * Requirements:
 * - npm install mbox mailparser
 */

import { Mbox } from '../../src/index';

async function parseEmails() {
  // Initialize mbox with parser
  const mbox = await Mbox.create('mailbox.mbox');
  mbox.useParser();

  console.log(`Total messages: ${mbox.count()}`);

  // Parse specific messages
  console.log('\n=== Parsing first 3 messages ===\n');
  const emails = await mbox.getParsedBatch([0, 1, 2]);

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    console.log(`Message ${i}:`);
    console.log(`  From: ${email.from}`);
    console.log(`  To: ${email.to?.join(', ')}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  Date: ${email.date}`);
    console.log(`  Attachments: ${email.attachments.length}`);
    console.log();
  }

  // Iterate through all messages with parsing
  console.log('\n=== Finding messages with attachments ===\n');
  for await (const { index, email } of mbox.iterateParsed()) {
    if (email.attachments.length > 0) {
      console.log(
        `Message ${index}: "${email.subject}" has ${email.attachments.length} attachment(s)`
      );
      email.attachments.forEach((att, i) => {
        console.log(`  ${i + 1}. ${att.filename || 'unnamed'} (${att.contentType})`);
      });
    }
  }

  // Parse with options (skip text body for performance)
  console.log('\n=== Parsing headers only ===\n');
  const headersOnly = await mbox.getParsed(0, {
    skipTextBody: true,
    skipHtmlBody: true,
  });
  console.log('Subject:', headersOnly.subject);
  console.log('From:', headersOnly.from);
  console.log('Headers:', Array.from(headersOnly.headers.entries()).slice(0, 5));
}

// Run the example
parseEmails().catch((error) => {
  console.error('Error:', error.message);
  if (error.message.includes('mailparser')) {
    console.log('\nTo use email parsing, install mailparser:');
    console.log('  npm install mailparser');
  }
  process.exit(1);
});
