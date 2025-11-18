#!/usr/bin/env node

/**
 * Email Parsing Example
 *
 * This example demonstrates:
 * - Integrating with email parsing libraries
 * - Extracting structured data from messages
 * - Working with attachments and multipart messages
 *
 * Note: This example shows integration patterns. For full email parsing,
 * install a library like 'mailparser' or 'postal-mime':
 *
 *   npm install mailparser
 *   or
 *   npm install postal-mime
 */

const { Mbox } = require('mbox');

/**
 * Simple email header parser (for demonstration)
 * For production use, consider using a proper email parsing library
 */
function parseEmail(message) {
  const lines = message.split('\n');
  const headers = {};
  let body = '';
  let inHeaders = true;
  let currentHeader = null;

  for (const line of lines) {
    if (inHeaders) {
      // Empty line marks end of headers
      if (line.trim() === '') {
        inHeaders = false;
        continue;
      }

      // Header continuation (starts with whitespace)
      if (line.match(/^\s/) && currentHeader) {
        headers[currentHeader] += ' ' + line.trim();
      } else {
        // New header
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const [, name, value] = match;
          currentHeader = name.toLowerCase();
          headers[currentHeader] = (headers[currentHeader] || '') + value;
        }
      }
    } else {
      // Rest is body
      body += line + '\n';
    }
  }

  return { headers, body: body.trim() };
}

/**
 * Extract email addresses from a header field
 */
function extractEmails(headerValue) {
  if (!headerValue) return [];

  const emailRegex = /<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/g;
  const matches = [];
  let match;

  while ((match = emailRegex.exec(headerValue)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Check if message has attachments
 */
function hasAttachments(headers) {
  const contentType = headers['content-type'] || '';
  return contentType.includes('multipart/mixed') || contentType.includes('multipart/related');
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

    // Example 1: Parse message headers and body
    console.log('=== Example 1: Basic Email Parsing ===\n');

    const message0 = await mbox.get(0);
    const parsed = parseEmail(message0);

    console.log('Headers:');
    const importantHeaders = ['from', 'to', 'subject', 'date', 'content-type'];
    importantHeaders.forEach(header => {
      if (parsed.headers[header]) {
        const value = parsed.headers[header].substring(0, 80);
        console.log(`  ${header}: ${value}`);
      }
    });

    console.log(`\nBody preview (first 200 chars):`);
    console.log(parsed.body.substring(0, 200).trim());
    if (parsed.body.length > 200) {
      console.log('...');
    }

    // Example 2: Extract email addresses
    console.log('\n\n=== Example 2: Extract Email Addresses ===\n');

    const emailStats = {
      senders: new Set(),
      recipients: new Set(),
      domains: new Set(),
    };

    const maxToProcess = Math.min(count, 10);
    for (let i = 0; i < maxToProcess; i++) {
      const message = await mbox.get(i);
      const { headers } = parseEmail(message);

      // Extract sender emails
      const fromEmails = extractEmails(headers.from || '');
      fromEmails.forEach(email => {
        emailStats.senders.add(email);
        const domain = email.split('@')[1];
        if (domain) emailStats.domains.add(domain);
      });

      // Extract recipient emails
      const toEmails = extractEmails(headers.to || '');
      toEmails.forEach(email => {
        emailStats.recipients.add(email);
      });

      const ccEmails = extractEmails(headers.cc || '');
      ccEmails.forEach(email => {
        emailStats.recipients.add(email);
      });
    }

    console.log(`Analyzed ${maxToProcess} messages:`);
    console.log(`  Unique senders: ${emailStats.senders.size}`);
    console.log(`  Unique recipients: ${emailStats.recipients.size}`);
    console.log(`  Unique domains: ${emailStats.domains.size}`);

    console.log('\nTop senders:');
    Array.from(emailStats.senders).slice(0, 5).forEach(email => {
      console.log(`  - ${email}`);
    });

    console.log('\nTop domains:');
    Array.from(emailStats.domains).slice(0, 5).forEach(domain => {
      console.log(`  - ${domain}`);
    });

    // Example 3: Analyze message types
    console.log('\n\n=== Example 3: Analyze Message Types ===\n');

    const messageTypes = {
      plain: 0,
      html: 0,
      multipart: 0,
      withAttachments: 0,
    };

    for (let i = 0; i < maxToProcess; i++) {
      const message = await mbox.get(i);
      const { headers } = parseEmail(message);

      const contentType = (headers['content-type'] || '').toLowerCase();

      if (contentType.includes('text/plain')) {
        messageTypes.plain++;
      }
      if (contentType.includes('text/html')) {
        messageTypes.html++;
      }
      if (contentType.includes('multipart')) {
        messageTypes.multipart++;
      }
      if (hasAttachments(headers)) {
        messageTypes.withAttachments++;
      }
    }

    console.log('Message type distribution:');
    console.log(`  Plain text: ${messageTypes.plain}`);
    console.log(`  HTML: ${messageTypes.html}`);
    console.log(`  Multipart: ${messageTypes.multipart}`);
    console.log(`  With attachments: ${messageTypes.withAttachments}`);

    // Example 4: Integration with mailparser (pseudocode)
    console.log('\n\n=== Example 4: Integration with mailparser ===\n');

    console.log(`
To use a full-featured email parser, install mailparser:

  npm install mailparser

Then use it like this:

  const { simpleParser } = require('mailparser');
  const { Mbox } = require('mbox');

  const mbox = await Mbox.create('mailbox.mbox');
  const message = await mbox.get(0);

  // Parse with mailparser
  const parsed = await simpleParser(message);

  console.log('Subject:', parsed.subject);
  console.log('From:', parsed.from.text);
  console.log('To:', parsed.to.text);
  console.log('Date:', parsed.date);
  console.log('Text body:', parsed.text);
  console.log('HTML body:', parsed.html);
  console.log('Attachments:', parsed.attachments.length);

  // Access attachments
  parsed.attachments.forEach(attachment => {
    console.log('Attachment:', attachment.filename);
    console.log('Type:', attachment.contentType);
    console.log('Size:', attachment.size);
    // attachment.content contains the Buffer
  });
    `);

    // Example 5: Export as JSON
    console.log('\n=== Example 5: Export Messages as JSON ===\n');

    const exportData = [];
    const exportCount = Math.min(count, 5);

    for (let i = 0; i < exportCount; i++) {
      const message = await mbox.get(i);
      const { headers, body } = parseEmail(message);

      exportData.push({
        index: i,
        from: headers.from || 'Unknown',
        to: headers.to || 'Unknown',
        subject: headers.subject || 'No subject',
        date: headers.date || 'Unknown',
        bodyPreview: body.substring(0, 200),
        size: message.length,
      });
    }

    console.log('Exported data sample (first 2 messages):');
    console.log(JSON.stringify(exportData.slice(0, 2), null, 2));

    console.log('\n=== Integration Tips ===');
    console.log(`
1. For simple header parsing, the basic parseEmail() function works
2. For full email parsing with MIME support, use 'mailparser' or 'postal-mime'
3. For working with attachments, use a proper MIME parser
4. You can stream large messages to the parser:

   const stream = await mbox.get(i, { asStream: true });
   const parsed = await simpleParser(stream);

5. Consider caching parsed results if processing multiple times
    `);

    console.log('\nEmail parsing examples completed!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
