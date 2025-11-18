/**
 * Integration tests for the Mbox class
 * Tests the full functionality including file I/O
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Mbox } from '../src/Mbox';
import {
  MboxState,
  MboxNotReadyError,
  MessageNotFoundError,
} from '../src/types';
import { Readable } from 'stream';

// Helper to create a temporary test file
function createTempMbox(content: string): string {
  const tempDir = os.tmpdir();
  const filename = path.join(tempDir, `test-mbox-${Date.now()}-${Math.random()}.mbox`);
  fs.writeFileSync(filename, content, 'utf8');
  return filename;
}

// Helper to clean up temp files
function cleanupFile(filename: string): void {
  try {
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

// Sample mbox files for testing
const SINGLE_MESSAGE_MBOX =
  'From alice@example.com Mon Jan  1 12:34:56 2024\n' +
  'From: alice@example.com\n' +
  'To: bob@example.com\n' +
  'Subject: Hello\n' +
  '\n' +
  'This is a test message.\n';

const MULTI_MESSAGE_MBOX =
  'From alice@example.com Mon Jan  1 12:34:56 2024\n' +
  'From: alice@example.com\n' +
  'Subject: First message\n' +
  '\n' +
  'Body of first message.\n' +
  'From bob@example.com Mon Jan  2 08:15:30 2024\n' +
  'From: bob@example.com\n' +
  'Subject: Second message\n' +
  '\n' +
  'Body of second message.\n' +
  'From carol@example.com Mon Jan  3 14:22:10 2024\n' +
  'From: carol@example.com\n' +
  'Subject: Third message\n' +
  '\n' +
  'Body of third message.\n';

describe('Mbox', () => {
  describe('Initialization', () => {
    it('should create an Mbox instance using static create()', async () => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);
        expect(mbox).toBeInstanceOf(Mbox);
        expect(mbox.getState()).toBe(MboxState.READY);
        expect(mbox.count()).toBe(1);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should create an Mbox instance using constructor and ready()', async () => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      try {
        const mbox = new Mbox(filename);
        expect(mbox.getState()).not.toBe(MboxState.READY); // Not ready yet
        await mbox.ready();
        expect(mbox.getState()).toBe(MboxState.READY);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should emit init event on successful initialization', (done) => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      const mbox = new Mbox(filename);

      mbox.on('init', (success, error) => {
        expect(success).toBe(true);
        expect(error).toBeUndefined();
        cleanupFile(filename);
        done();
      });
    });

    it('should handle non-existent files gracefully', async () => {
      const filename = '/nonexistent/path/to/mbox.mbox';

      await expect(Mbox.create(filename)).rejects.toThrow();
    });

    it('should emit error event on initialization failure', async () => {
      const filename = '/nonexistent/path/to/mbox.mbox';

      const initPromise = new Promise<void>((resolve) => {
        const mbox = new Mbox(filename);

        // Add error listener immediately to prevent unhandled error
        mbox.on('error', () => {
          // Expected error, do nothing
        });

        mbox.on('init', (success, error) => {
          expect(success).toBe(false);
          expect(error).toBeInstanceOf(Error);
          resolve();
        });
      });

      await initPromise;
    });

    it('should handle empty mbox files', async () => {
      const filename = createTempMbox('');
      try {
        const mbox = await Mbox.create(filename);
        expect(mbox.count()).toBe(0);
        expect(mbox.totalCount()).toBe(0);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should restore from saved index', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        // First, create and export index
        const mbox1 = await Mbox.create(filename);
        const savedIndex = mbox1.exportIndex();
        expect(savedIndex).toHaveLength(3);

        // Create new instance with saved index
        const mbox2 = await Mbox.create(filename, { savedIndex });
        expect(mbox2.count()).toBe(3);
        expect(mbox2.totalCount()).toBe(3);
      } finally {
        cleanupFile(filename);
      }
    });
  });

  describe('Message counting', () => {
    it('should count messages correctly', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);
        expect(mbox.count()).toBe(3);
        expect(mbox.totalCount()).toBe(3);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should exclude deleted messages from count()', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);
        await mbox.delete(1);

        expect(mbox.count()).toBe(2);
        expect(mbox.totalCount()).toBe(3);
      } finally {
        cleanupFile(filename);
      }
    });
  });

  describe('get() - Retrieving messages', () => {
    it('should retrieve a message as a string (Promise API)', async () => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);
        const message = await mbox.get(0);

        expect(typeof message).toBe('string');
        expect(message).toContain('alice@example.com');
        expect(message).toContain('This is a test message.');
      } finally {
        cleanupFile(filename);
      }
    });

    it('should retrieve a message as a stream', async () => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);
        const stream = await mbox.get(0, { asStream: true });

        expect(stream).toBeInstanceOf(Readable);

        // Collect stream content
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks).toString('utf8');
        expect(content).toContain('alice@example.com');
      } finally {
        cleanupFile(filename);
      }
    });

    it('should emit get event on success (legacy API)', (done) => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      const mbox = new Mbox(filename);

      mbox.on('init', async (success) => {
        if (success) {
          mbox.get(0);
        }
      });

      mbox.on('get', (success, index, data) => {
        expect(success).toBe(true);
        expect(index).toBe(0);
        expect(data).toContain('alice@example.com');
        cleanupFile(filename);
        done();
      });
    });

    it('should retrieve multiple messages correctly', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);

        const msg0 = await mbox.get(0);
        const msg1 = await mbox.get(1);
        const msg2 = await mbox.get(2);

        expect(msg0).toContain('alice@example.com');
        expect(msg0).toContain('First message');

        expect(msg1).toContain('bob@example.com');
        expect(msg1).toContain('Second message');

        expect(msg2).toContain('carol@example.com');
        expect(msg2).toContain('Third message');
      } finally {
        cleanupFile(filename);
      }
    });

    it('should throw error for out-of-bounds index', async () => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);

        await expect(mbox.get(99)).rejects.toThrow(MessageNotFoundError);
        await expect(mbox.get(-1)).rejects.toThrow(MessageNotFoundError);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should throw error when retrieving deleted message', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);
        await mbox.delete(1);

        await expect(mbox.get(1)).rejects.toThrow(MessageNotFoundError);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should throw error when not ready', async () => {
      const filename = createTempMbox(SINGLE_MESSAGE_MBOX);
      try {
        const mbox = new Mbox(filename);
        // Don't wait for ready

        await expect(mbox.get(0)).rejects.toThrow(MboxNotReadyError);
      } finally {
        cleanupFile(filename);
      }
    });
  });

  describe('delete() - Deleting messages', () => {
    it('should mark a message as deleted', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);

        expect(mbox.count()).toBe(3);
        await mbox.delete(1);
        expect(mbox.count()).toBe(2);

        await expect(mbox.get(1)).rejects.toThrow(MessageNotFoundError);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should emit delete event on success', (done) => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      const mbox = new Mbox(filename);

      mbox.on('init', async () => {
        mbox.delete(1);
      });

      mbox.on('delete', (success, index) => {
        expect(success).toBe(true);
        expect(index).toBe(1);
        cleanupFile(filename);
        done();
      });
    });

    it('should throw error for invalid index', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);

        await expect(mbox.delete(99)).rejects.toThrow(MessageNotFoundError);
        await expect(mbox.delete(-1)).rejects.toThrow(MessageNotFoundError);
      } finally {
        cleanupFile(filename);
      }
    });

    it('should throw error when deleting already deleted message', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);

        await mbox.delete(1);
        await expect(mbox.delete(1)).rejects.toThrow(MessageNotFoundError);
      } finally {
        cleanupFile(filename);
      }
    });
  });

  describe('reset() - Restoring deleted messages', () => {
    it('should restore deleted messages', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox = await Mbox.create(filename);

        // Delete some messages
        await mbox.delete(0);
        await mbox.delete(2);
        expect(mbox.count()).toBe(1);

        // Reset
        mbox.reset();
        expect(mbox.count()).toBe(3);

        // Should be able to retrieve previously deleted messages
        const msg0 = await mbox.get(0);
        expect(msg0).toContain('alice@example.com');
      } finally {
        cleanupFile(filename);
      }
    });

    it('should emit reset event', (done) => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      const mbox = new Mbox(filename);

      mbox.on('init', async () => {
        await mbox.delete(1);
        mbox.reset();
      });

      mbox.on('reset', (success) => {
        expect(success).toBe(true);
        cleanupFile(filename);
        done();
      });
    });
  });

  describe('write() - Writing to disk', () => {
    it('should write non-deleted messages to new file', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      const outputFilename = createTempMbox(''); // Create empty temp file
      cleanupFile(outputFilename); // Delete it so write() can create it

      try {
        const mbox = await Mbox.create(filename);

        // Delete middle message
        await mbox.delete(1);

        // Write to new file
        await mbox.write(outputFilename);

        // Read the new file
        const newMbox = await Mbox.create(outputFilename);
        expect(newMbox.count()).toBe(2);

        const msg0 = await newMbox.get(0);
        const msg1 = await newMbox.get(1);

        expect(msg0).toContain('alice@example.com');
        expect(msg1).toContain('carol@example.com');
        expect(msg1).not.toContain('bob@example.com');
      } finally {
        cleanupFile(filename);
        cleanupFile(outputFilename);
      }
    });

    it('should emit write event on success', (done) => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      const outputFilename = path.join(os.tmpdir(), `test-output-${Date.now()}.mbox`);

      const mbox = new Mbox(filename);

      mbox.on('init', async () => {
        await mbox.delete(1);
        mbox.write(outputFilename);
      });

      mbox.on('write', (success, dest) => {
        expect(success).toBe(true);
        expect(dest).toBe(outputFilename);
        cleanupFile(filename);
        cleanupFile(outputFilename);
        done();
      });
    });

    it('should write all messages when none are deleted', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      const outputFilename = createTempMbox('');
      cleanupFile(outputFilename);

      try {
        const mbox = await Mbox.create(filename);
        await mbox.write(outputFilename);

        const newMbox = await Mbox.create(outputFilename);
        expect(newMbox.count()).toBe(3);
      } finally {
        cleanupFile(filename);
        cleanupFile(outputFilename);
      }
    });
  });

  describe('Index export/import', () => {
    it('should export and import index correctly', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox1 = await Mbox.create(filename);
        const index = mbox1.exportIndex();

        expect(index).toHaveLength(3);
        expect(index[0]?.index).toBe(0);
        expect(index[0]?.offset).toBe(0);
        expect(index[0]?.deleted).toBe(false);

        // Create new instance with saved index
        const mbox2 = await Mbox.create(filename, { savedIndex: index });
        expect(mbox2.count()).toBe(3);

        const msg = await mbox2.get(0);
        expect(msg).toContain('alice@example.com');
      } finally {
        cleanupFile(filename);
      }
    });

    it('should preserve deleted state in exported index', async () => {
      const filename = createTempMbox(MULTI_MESSAGE_MBOX);
      try {
        const mbox1 = await Mbox.create(filename);
        await mbox1.delete(1);

        const index = mbox1.exportIndex();
        expect(index[1]?.deleted).toBe(true);

        const mbox2 = await Mbox.create(filename, { savedIndex: index });
        expect(mbox2.count()).toBe(2);
        await expect(mbox2.get(1)).rejects.toThrow(MessageNotFoundError);
      } finally {
        cleanupFile(filename);
      }
    });
  });

  describe('Edge cases and stress tests', () => {
    it('should handle large mbox files', async () => {
      // Create a file with many messages
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `From sender${i}@example.com Mon Jan 1 00:00:00 2024\n`;
        content += `Subject: Message ${i}\n\n`;
        content += `Body of message ${i}\n`;
      }

      const filename = createTempMbox(content);
      try {
        const mbox = await Mbox.create(filename);
        expect(mbox.count()).toBe(100);

        const msg50 = await mbox.get(50);
        expect(msg50).toContain('Message 50');
      } finally {
        cleanupFile(filename);
      }
    });

    it('should handle messages with binary data', async () => {
      const content = Buffer.concat([
        Buffer.from('From sender@example.com Mon Jan 1 00:00:00 2024\n'),
        Buffer.from('Subject: Binary\n\n'),
        Buffer.from([0x00, 0xFF, 0xAA, 0x55]),
        Buffer.from('\nEnd of message\n'),
      ]);

      const filename = createTempMbox(content.toString('binary'));
      try {
        const mbox = await Mbox.create(filename, { encoding: 'binary' });
        expect(mbox.count()).toBe(1);

        const msg = await mbox.get(0, { encoding: 'binary' });
        expect(msg).toBeTruthy();
      } finally {
        cleanupFile(filename);
      }
    });
  });
});
