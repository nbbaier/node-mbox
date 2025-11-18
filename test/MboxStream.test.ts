/**
 * Comprehensive tests for MboxParserStream
 * Tests edge cases and various mbox file formats
 */

import { Readable } from 'stream';
import { MboxParserStream } from '../src/MboxStream';
import { MessageBoundary } from '../src/types';

/**
 * Helper function to create a readable stream from a string or buffer
 */
function createReadableStream(content: string | Buffer): Readable {
  const readable = new Readable();
  readable.push(content);
  readable.push(null); // End of stream
  return readable;
}

/**
 * Helper function to create a chunked readable stream
 * This simulates reading a file in chunks
 */
function createChunkedStream(content: string | Buffer, chunkSize: number): Readable {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  let offset = 0;

  return new Readable({
    read() {
      if (offset >= buffer.length) {
        this.push(null);
        return;
      }

      const chunk = buffer.slice(offset, offset + chunkSize);
      offset += chunkSize;
      this.push(chunk);
    }
  });
}

/**
 * Helper to collect all boundaries from the parser
 */
async function parseBoundaries(content: string | Buffer, chunkSize?: number): Promise<MessageBoundary[]> {
  const boundaries: MessageBoundary[] = [];
  const parser = new MboxParserStream();

  return new Promise((resolve, reject) => {
    const stream = chunkSize
      ? createChunkedStream(content, chunkSize)
      : createReadableStream(content);

    stream.pipe(parser);

    parser.on('data', (boundary: MessageBoundary) => {
      boundaries.push(boundary);
    });

    parser.on('end', () => {
      resolve(boundaries);
    });

    parser.on('error', (err) => {
      reject(err);
    });
  });
}

describe('MboxParserStream', () => {
  describe('Basic functionality', () => {
    it('should detect a single message starting with From', async () => {
      const mbox = 'From sender@example.com Mon Jan 1 00:00:00 2024\nSubject: Test\n\nBody';
      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(0);
    });

    it('should detect multiple messages', async () => {
      const mbox =
        'From sender1@example.com Mon Jan 1 00:00:00 2024\nSubject: Test 1\n\nBody 1\n' +
        'From sender2@example.com Mon Jan 2 00:00:00 2024\nSubject: Test 2\n\nBody 2\n' +
        'From sender3@example.com Mon Jan 3 00:00:00 2024\nSubject: Test 3\n\nBody 3';

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(3);
      expect(boundaries[0]?.offset).toBe(0);
      // Second message starts after first message + newline
      expect(boundaries[1]?.offset).toBeGreaterThan(boundaries[0]!.offset);
      expect(boundaries[2]?.offset).toBeGreaterThan(boundaries[1]!.offset);
    });

    it('should handle empty input', async () => {
      const boundaries = await parseBoundaries('');
      expect(boundaries).toHaveLength(0);
    });

    it('should handle file with no messages', async () => {
      const mbox = 'This is not a valid mbox file\nNo From lines here';
      const boundaries = await parseBoundaries(mbox);
      expect(boundaries).toHaveLength(0);
    });
  });

  describe('Edge case: File starting with From', () => {
    it('should detect message at file start', async () => {
      const mbox = 'From sender@example.com Mon Jan 1 00:00:00 2024\nSubject: Test\n';
      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(0);
    });

    it('should detect message at file start with multiple messages', async () => {
      const mbox =
        'From sender1@example.com Mon Jan 1 00:00:00 2024\nSubject: Test 1\n\n' +
        'From sender2@example.com Mon Jan 2 00:00:00 2024\nSubject: Test 2\n';

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(2);
      expect(boundaries[0]?.offset).toBe(0);
    });
  });

  describe('Edge case: Split delimiters', () => {
    it('should detect delimiter split across chunks (split at newline)', async () => {
      // "...\n" | "From ..."
      const mbox = 'Some content\nFrom sender@example.com\n';
      const boundaries = await parseBoundaries(mbox, 13); // Split exactly at \n

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(13);
    });

    it('should detect delimiter split across chunks (split in From)', async () => {
      // "...\nFr" | "om ..."
      const mbox = 'Some content\nFrom sender@example.com\n';
      const boundaries = await parseBoundaries(mbox, 15); // Split in "From"

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(13);
    });

    it('should detect delimiter split across chunks (split after From)', async () => {
      // "...\nFrom" | " ..."
      const mbox = 'Some content\nFrom sender@example.com\n';
      const boundaries = await parseBoundaries(mbox, 17); // Split after "From"

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(13);
    });

    it('should detect multiple messages with small chunk size', async () => {
      const mbox =
        'From sender1@example.com Mon Jan 1 00:00:00 2024\nBody 1\n' +
        'From sender2@example.com Mon Jan 2 00:00:00 2024\nBody 2\n' +
        'From sender3@example.com Mon Jan 3 00:00:00 2024\nBody 3';

      const boundaries = await parseBoundaries(mbox, 10); // Very small chunks

      expect(boundaries).toHaveLength(3);
      expect(boundaries[0]?.offset).toBe(0);
    });
  });

  describe('Edge case: From in message body', () => {
    it('should not detect From in the middle of a line', async () => {
      const mbox =
        'From sender@example.com Mon Jan 1 00:00:00 2024\n' +
        'Subject: Test\n\n' +
        'This is a message From someone\n';

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(0);
    });

    it('should detect escaped From lines (>From)', async () => {
      // Note: The parser detects '\nFrom ', not '\n>From '
      // Escaped lines should NOT be detected as boundaries
      const mbox =
        'From sender@example.com Mon Jan 1 00:00:00 2024\n' +
        'Subject: Test\n\n' +
        '>From someone else\n';

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]?.offset).toBe(0);
    });

    it('should correctly identify boundaries with From in body', async () => {
      const mbox =
        'From sender1@example.com Mon Jan 1 00:00:00 2024\n' +
        'Subject: Test 1\n\n' +
        'This message is From John\n' +
        'From sender2@example.com Mon Jan 2 00:00:00 2024\n' +
        'Subject: Test 2\n';

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(2);
      expect(boundaries[0]?.offset).toBe(0);
    });
  });

  describe('Real-world mbox format', () => {
    it('should parse a realistic mbox file', async () => {
      const mbox =
        'From alice@example.com Mon Jan  1 12:34:56 2024\n' +
        'From: alice@example.com\n' +
        'To: bob@example.com\n' +
        'Subject: Hello\n' +
        'Date: Mon, 1 Jan 2024 12:34:56 +0000\n' +
        '\n' +
        'Hi Bob,\n' +
        '\n' +
        'How are you?\n' +
        '\n' +
        'From carol@example.com Tue Jan  2 08:15:30 2024\n' +
        'From: carol@example.com\n' +
        'To: alice@example.com\n' +
        'Subject: Re: Hello\n' +
        '\n' +
        'I got your message!\n';

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(2);
      expect(boundaries[0]?.offset).toBe(0);
      expect(boundaries[1]?.offset).toBeGreaterThan(0);
    });

    it('should handle messages with attachments (binary data)', async () => {
      const mbox = Buffer.concat([
        Buffer.from('From sender@example.com Mon Jan 1 00:00:00 2024\n'),
        Buffer.from('Subject: Binary\n\n'),
        Buffer.from([0x00, 0xFF, 0xAA, 0x55]), // Binary data
        Buffer.from('\nFrom sender2@example.com Mon Jan 2 00:00:00 2024\n'),
      ]);

      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(2);
    });
  });

  describe('Offset calculation', () => {
    it('should calculate correct offsets', async () => {
      const msg1 = 'From msg1@example.com\nBody 1\n';
      const msg2 = 'From msg2@example.com\nBody 2\n';
      const msg3 = 'From msg3@example.com\nBody 3';

      const mbox = msg1 + msg2 + msg3;
      const boundaries = await parseBoundaries(mbox);

      expect(boundaries).toHaveLength(3);
      expect(boundaries[0]?.offset).toBe(0);
      expect(boundaries[1]?.offset).toBe(msg1.length);
      expect(boundaries[2]?.offset).toBe(msg1.length + msg2.length);
    });

    it('should calculate correct offsets with varying chunk sizes', async () => {
      const msg1 = 'From msg1@example.com\nBody 1\n';
      const msg2 = 'From msg2@example.com\nBody 2\n';

      const mbox = msg1 + msg2;

      // Test with different chunk sizes
      for (const chunkSize of [1, 5, 10, 20, 100]) {
        const boundaries = await parseBoundaries(mbox, chunkSize);

        expect(boundaries).toHaveLength(2);
        expect(boundaries[0]?.offset).toBe(0);
        expect(boundaries[1]?.offset).toBe(msg1.length);
      }
    });
  });

  describe('Performance and stress tests', () => {
    it('should handle large files efficiently', async () => {
      // Create a large mbox file with 100 messages
      let mbox = '';
      for (let i = 0; i < 100; i++) {
        mbox += `From sender${i}@example.com Mon Jan 1 00:00:00 2024\n`;
        mbox += `Subject: Message ${i}\n\n`;
        mbox += `This is message body ${i}\n`;
      }

      const boundaries = await parseBoundaries(mbox);
      expect(boundaries).toHaveLength(100);
    });

    it('should handle very long lines', async () => {
      const longLine = 'A'.repeat(1000000); // 1MB line
      const mbox =
        'From sender1@example.com Mon Jan 1 00:00:00 2024\n' +
        longLine + '\n' +
        'From sender2@example.com Mon Jan 2 00:00:00 2024\n';

      const boundaries = await parseBoundaries(mbox);
      expect(boundaries).toHaveLength(2);
    });
  });
});
