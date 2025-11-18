# Migration Guide: v0.1.x to v0.2.x

This guide will help you migrate from node-mbox v0.1.x to v0.2.x.

## Overview of Changes

Version 0.2.x is a complete rewrite in TypeScript with a stream-based architecture. While we've maintained backwards compatibility through events, the recommended approach is to use the modern Promise-based API.

### Key Changes

1. **File Descriptors → Filenames**: No longer requires manual `fs.openSync()`, just pass the filename
2. **Event-based → Promise-based**: Modern async/await API (events still supported)
3. **No External Dependencies**: Removed `unixlib` dependency
4. **TypeScript Support**: Full TypeScript definitions
5. **Better Performance**: Stream-based architecture with lower memory usage
6. **New Features**: Stream support for large messages, index caching

## Breaking Changes

### 1. Constructor Signature

**Before (v0.1.x):**
```javascript
const fs = require('fs');
const mbox = require('mbox').mbox;

const fd = fs.openSync('mailbox.mbox', 'r+');
const box = new mbox(fd, {
  bufsize: 4096,
  tmppath: '/tmp'
});
```

**After (v0.2.x):**
```javascript
const { Mbox } = require('mbox');

// Option 1: Modern async/await
const mbox = await Mbox.create('mailbox.mbox', {
  bufferSize: 65536  // Note: renamed from 'bufsize'
});

// Option 2: Constructor with ready()
const mbox = new Mbox('mailbox.mbox', {
  bufferSize: 65536
});
await mbox.ready();
```

**Migration Notes:**
- You no longer need to manually open file descriptors
- `bufsize` option renamed to `bufferSize`
- `tmppath` option removed (temp files handled internally)
- Constructor now takes filename instead of file descriptor

### 2. Exports

**Before (v0.1.x):**
```javascript
const mbox = require('mbox').mbox;
```

**After (v0.2.x):**
```javascript
// CommonJS
const { Mbox } = require('mbox');

// ES Modules
import { Mbox } from 'mbox';
```

### 3. Method Signatures

#### get()

**Before (v0.1.x):**
```javascript
box.get(0);  // Returns via event

box.on('get', (success, index, data) => {
  console.log(data);
});
```

**After (v0.2.x):**
```javascript
// Modern Promise-based
const data = await mbox.get(0);
console.log(data);

// Legacy event-based (still works)
mbox.get(0);
mbox.on('get', (success, index, data) => {
  console.log(data);
});
```

#### delete()

**Before (v0.1.x):**
```javascript
box.delete(0);

box.on('delete', (success, index) => {
  if (success) {
    console.log('Deleted');
  }
});
```

**After (v0.2.x):**
```javascript
// Modern Promise-based
await mbox.delete(0);
console.log('Deleted');

// Legacy event-based (still works)
mbox.delete(0);
mbox.on('delete', (success, index) => {
  console.log('Deleted');
});
```

#### write()

**Before (v0.1.x):**
```javascript
box.write('output.mbox');  // Also closes the file descriptor

box.on('write', (success) => {
  console.log('Written');
});
```

**After (v0.2.x):**
```javascript
// Modern Promise-based
await mbox.write('output.mbox');
console.log('Written');

// Legacy event-based (still works)
mbox.write('output.mbox');
mbox.on('write', (success, filename) => {
  console.log('Written');
});
```

**Important:** v0.2.x does NOT close the original file after write(). You can continue using the mbox instance.

## Non-Breaking Changes (New Features)

### 1. Stream Support for Large Messages

```javascript
// Get message as a stream instead of loading into memory
const stream = await mbox.get(0, { asStream: true });
stream.pipe(process.stdout);
```

### 2. Index Caching

```javascript
// Export index for caching
const index = mbox.exportIndex();
fs.writeFileSync('cache.json', JSON.stringify(index));

// Later, restore from cache (skips file scan)
const cached = JSON.parse(fs.readFileSync('cache.json'));
const mbox = await Mbox.create('mailbox.mbox', {
  savedIndex: cached
});
```

### 3. Additional Methods

```javascript
// Get total count including deleted messages
mbox.totalCount();

// Get current state
mbox.getState();  // 'INIT' | 'INDEXING' | 'READY' | 'ERROR'

// Wait for initialization
await mbox.ready();
```

### 4. Custom Encoding

```javascript
// Specify encoding per message
const msg = await mbox.get(0, { encoding: 'binary' });

// Or set default encoding
const mbox = await Mbox.create('mailbox.mbox', {
  encoding: 'utf8'
});
```

## Migration Examples

### Example 1: Basic Usage

**Before (v0.1.x):**
```javascript
const fs = require('fs');
const mbox = require('mbox').mbox;

const fd = fs.openSync('mailbox.mbox', 'r+');
const box = new mbox(fd);

box.on('init', (status) => {
  if (status) {
    console.log(`Found ${box.count()} messages`);
    box.get(0);
  }
});

box.on('get', (success, index, data) => {
  if (success) {
    console.log(data);
  }
});
```

**After (v0.2.x) - Modern:**
```javascript
const { Mbox } = require('mbox');

async function main() {
  const mbox = await Mbox.create('mailbox.mbox');
  console.log(`Found ${mbox.count()} messages`);

  const data = await mbox.get(0);
  console.log(data);
}

main().catch(console.error);
```

**After (v0.2.x) - Legacy Compatible:**
```javascript
const { Mbox } = require('mbox');

const mbox = new Mbox('mailbox.mbox');

mbox.on('init', (success) => {
  if (success) {
    console.log(`Found ${mbox.count()} messages`);
    mbox.get(0);
  }
});

mbox.on('get', (success, index, data) => {
  if (success) {
    console.log(data);
  }
});
```

### Example 2: Delete and Write

**Before (v0.1.x):**
```javascript
const fs = require('fs');
const mbox = require('mbox').mbox;

const fd = fs.openSync('mailbox.mbox', 'r+');
const box = new mbox(fd);

box.on('init', () => {
  box.delete(0);
});

box.on('delete', (success) => {
  if (success) {
    box.write('updated.mbox');
  }
});

box.on('write', () => {
  console.log('Done!');
});
```

**After (v0.2.x):**
```javascript
const { Mbox } = require('mbox');

async function main() {
  const mbox = await Mbox.create('mailbox.mbox');
  await mbox.delete(0);
  await mbox.write('updated.mbox');
  console.log('Done!');
}

main().catch(console.error);
```

### Example 3: Error Handling

**Before (v0.1.x):**
```javascript
box.on('init', (status, error) => {
  if (!status) {
    console.error('Init failed:', error);
  }
});

box.on('error', (err) => {
  console.error('Error:', err);
});
```

**After (v0.2.x) - Modern:**
```javascript
try {
  const mbox = await Mbox.create('mailbox.mbox');
  const msg = await mbox.get(0);
} catch (error) {
  if (error instanceof MboxNotReadyError) {
    console.error('Not ready yet');
  } else if (error instanceof MessageNotFoundError) {
    console.error('Message not found');
  } else {
    console.error('Error:', error);
  }
}
```

**After (v0.2.x) - Legacy:**
```javascript
const mbox = new Mbox('mailbox.mbox');

mbox.on('init', (success, error) => {
  if (!success) {
    console.error('Init failed:', error);
  }
});

mbox.on('error', (err) => {
  console.error('Error:', err);
});
```

## TypeScript Support

v0.2.x includes full TypeScript definitions:

```typescript
import {
  Mbox,
  MboxOptions,
  MboxState,
  MessageNotFoundError
} from 'mbox';

const options: MboxOptions = {
  debug: true,
  bufferSize: 65536,
  encoding: 'utf8'
};

const mbox: Mbox = await Mbox.create('mailbox.mbox', options);
const count: number = mbox.count();
const message: string = await mbox.get(0);
```

## Performance Considerations

### Memory Usage

v0.2.x uses significantly less memory for large files:

- **v0.1.x**: Stores all offsets and sizes in separate arrays, O(n) memory
- **v0.2.x**: Stream-based with indexed lookups, O(1) memory during reads

### Initialization Speed

- First-time scan is similar speed to v0.1.x
- Use `exportIndex()` to cache and skip rescanning on subsequent runs

### Example: Index Caching

```javascript
const indexPath = 'mailbox.idx';

let mbox;
if (fs.existsSync(indexPath)) {
  // Use cached index
  const savedIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  mbox = await Mbox.create('mailbox.mbox', { savedIndex });
} else {
  // Scan file and save index
  mbox = await Mbox.create('mailbox.mbox');
  fs.writeFileSync(indexPath, JSON.stringify(mbox.exportIndex()));
}
```

## Troubleshooting

### Issue: "File descriptor is not a number"

This error occurs when passing a filename to v0.1.x or a file descriptor to v0.2.x.

**Solution:** Update your code to pass filenames instead of file descriptors.

### Issue: "Cannot read property 'mbox' of undefined"

The export structure changed.

**Solution:** Update from `require('mbox').mbox` to `require('mbox').Mbox`

### Issue: "bufsize is not a valid option"

Option name changed.

**Solution:** Rename `bufsize` to `bufferSize`

### Issue: Promises not working

Make sure you're using async/await or .then() properly.

**Solution:**
```javascript
// Wrong
const mbox = Mbox.create('file.mbox');
mbox.count();  // Error: mbox is a Promise

// Right
const mbox = await Mbox.create('file.mbox');
mbox.count();  // Works
```

## Gradual Migration Strategy

You can migrate gradually:

1. **Update package.json** to v0.2.x
2. **Keep event-based code** working as-is
3. **Gradually refactor** to async/await
4. **Add TypeScript** types where beneficial

## Questions?

If you encounter issues not covered in this guide, please:

1. Check the [README.md](./README.md) for full API documentation
2. Review the [examples](./examples) directory
3. Open an issue on GitHub

## Quick Reference: v0.1.x vs v0.2.x

| Operation | v0.1.x | v0.2.x |
|-----------|--------|--------|
| **Import** | `require('mbox').mbox` | `require('mbox').Mbox` |
| **Open file** | `fs.openSync(file, 'r+')` | Just pass filename |
| **Create instance** | `new mbox(fd, options)` | `await Mbox.create(filename, options)` |
| **Wait for ready** | Listen for `'init'` event | `await mbox.ready()` or `await Mbox.create()` |
| **Get message** | `box.get(0)` + listen for `'get'` | `await mbox.get(0)` |
| **Delete message** | `box.delete(0)` + listen for `'delete'` | `await mbox.delete(0)` |
| **Write changes** | `box.write(file)` + listen for `'write'` | `await mbox.write(file)` |
| **Buffer size option** | `bufsize: 4096` | `bufferSize: 65536` |
| **Temp path option** | `tmppath: '/tmp'` | Not needed (handled internally) |
| **After write()** | File descriptor closed | Mbox still usable |
| **Error handling** | Check event `success` param | `try/catch` with Promises |
| **TypeScript** | No types | Full TypeScript support |
| **Dependencies** | Requires `unixlib` | Zero dependencies |
| **Encoding** | Fixed | Configurable per message |
| **Streaming** | Not supported | `asStream: true` option |
| **Index caching** | Not supported | `exportIndex()` / `savedIndex` |

## Real-World Migration Scenarios

### Scenario 1: Email Archive Tool

**v0.1.x Implementation:**
```javascript
const fs = require('fs');
const mbox = require('mbox').mbox;

function archiveEmails(inputFile, outputFile, filterFn) {
  const fd = fs.openSync(inputFile, 'r+');
  const box = new mbox(fd);
  let currentIndex = 0;

  box.on('init', (status) => {
    if (status && box.count() > 0) {
      box.get(currentIndex);
    }
  });

  box.on('get', (success, index, data) => {
    if (success) {
      if (!filterFn(data)) {
        box.delete(index);
      }
      currentIndex++;
      if (currentIndex < box.count()) {
        box.get(currentIndex);
      } else {
        box.write(outputFile);
      }
    }
  });

  box.on('write', () => {
    console.log('Archive complete');
  });
}
```

**v0.2.x Implementation:**
```javascript
const { Mbox } = require('mbox');

async function archiveEmails(inputFile, outputFile, filterFn) {
  const mbox = await Mbox.create(inputFile);
  const count = mbox.count();

  for (let i = 0; i < count; i++) {
    const message = await mbox.get(i);
    if (!filterFn(message)) {
      await mbox.delete(i);
    }
  }

  await mbox.write(outputFile);
  console.log('Archive complete');
}

// Usage
archiveEmails('inbox.mbox', 'archive.mbox', (msg) => {
  return msg.includes('important');
}).catch(console.error);
```

**Benefits:**
- 80% less code
- Easier to read and maintain
- Built-in error handling with try/catch
- No callback hell

### Scenario 2: Batch Message Processor

**v0.1.x Implementation:**
```javascript
const fs = require('fs');
const mbox = require('mbox').mbox;

const fd = fs.openSync('mailbox.mbox', 'r+');
const box = new mbox(fd);
const results = [];

box.on('init', (status) => {
  if (status) {
    processNextMessage(0);
  }
});

function processNextMessage(index) {
  if (index >= box.count()) {
    console.log('Processing complete', results);
    return;
  }
  box.get(index);
}

box.on('get', (success, index, data) => {
  if (success) {
    // Process message
    results.push({ index, size: data.length });
    processNextMessage(index + 1);
  }
});
```

**v0.2.x Implementation:**
```javascript
const { Mbox } = require('mbox');

async function processMessages() {
  const mbox = await Mbox.create('mailbox.mbox');
  const results = [];

  for (let i = 0; i < mbox.count(); i++) {
    const message = await mbox.get(i);
    results.push({ index: i, size: message.length });
  }

  console.log('Processing complete', results);
}

processMessages().catch(console.error);
```

**Benefits:**
- Sequential logic instead of callbacks
- Easier to add error handling
- Can use modern JS features (async/await, for-of)

### Scenario 3: Large Mailbox Handler

**New in v0.2.x - Not possible in v0.1.x:**
```javascript
const { Mbox } = require('mbox');
const fs = require('fs');

async function handleLargeMailbox() {
  // Use cached index for instant startup
  const indexPath = 'mailbox.mbox.index.json';
  let mbox;

  if (fs.existsSync(indexPath)) {
    const savedIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    mbox = await Mbox.create('mailbox.mbox', { savedIndex });
    console.log('Loaded from cache');
  } else {
    mbox = await Mbox.create('mailbox.mbox');
    fs.writeFileSync(indexPath, JSON.stringify(mbox.exportIndex()));
    console.log('Created new index');
  }

  // Stream large messages to avoid memory issues
  for (let i = 0; i < mbox.count(); i++) {
    const stream = await mbox.get(i, { asStream: true });
    const outputFile = `message-${i}.eml`;

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputFile);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
}

handleLargeMailbox().catch(console.error);
```

**Benefits:**
- Index caching for instant startup (10-100x faster)
- Stream support for large messages
- Memory efficient processing

### Scenario 4: Integration with Web API

**v0.2.x makes this much easier:**
```javascript
const { Mbox } = require('mbox');
const express = require('express');

const app = express();
let mbox;

// Initialize mbox once at startup
async function init() {
  mbox = await Mbox.create('mailbox.mbox');
  console.log(`Loaded ${mbox.count()} messages`);
}

// REST API endpoints
app.get('/api/messages', (req, res) => {
  res.json({
    count: mbox.count(),
    total: mbox.totalCount(),
  });
});

app.get('/api/messages/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const message = await mbox.get(id);
    res.send(message);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await mbox.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

init().then(() => {
  app.listen(3000, () => console.log('Server running on port 3000'));
});
```

**Benefits:**
- Natural async/await integration with Express
- Easy error handling
- Mbox instance stays open and reusable

## Summary Checklist

- [ ] Update `require('mbox').mbox` to `require('mbox').Mbox`
- [ ] Change from file descriptors to filenames
- [ ] Rename `bufsize` to `bufferSize` if used
- [ ] Remove `tmppath` option if used
- [ ] Consider migrating to async/await for better error handling
- [ ] Add TypeScript types if using TypeScript
- [ ] Test thoroughly with your actual mbox files
- [ ] Review the [examples](./examples) directory for practical code samples
