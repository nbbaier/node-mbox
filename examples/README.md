# Examples

This directory contains examples demonstrating how to use node-mbox v0.2.x.

## Directory Structure

- **modern/** - Modern async/await examples (recommended for new projects)
- **legacy/** - Event-based examples for backwards compatibility
- **advanced/** - Advanced use cases and optimization techniques

## Quick Start

### Modern API (Recommended)

```javascript
const { Mbox } = require('mbox');

async function main() {
  const mbox = await Mbox.create('mailbox.mbox');
  console.log(`Found ${mbox.count()} messages`);

  const message = await mbox.get(0);
  console.log(message);
}

main().catch(console.error);
```

### Legacy Event-based API

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

## Examples List

### Modern Examples

1. **basic-usage.js** - Reading and displaying messages
2. **delete-and-write.js** - Deleting messages and writing changes
3. **error-handling.js** - Proper error handling with async/await
4. **typescript-example.ts** - TypeScript usage with full type safety

### Legacy Examples

1. **event-based-usage.js** - Using the event-based API
2. **v0.1.x-demo.js** - Original demo from v0.1.x (requires v0.1.x)

### Advanced Examples

1. **streaming.js** - Using streams for large messages
2. **index-caching.js** - Caching the index for faster startup
3. **batch-processing.js** - Processing large mailboxes efficiently
4. **filtering.js** - Filtering and searching messages
5. **email-parsing.js** - Integrating with email parsing libraries

## Running the Examples

Make sure you have a test mbox file available. You can create one or use the sample:

```bash
# Run any example
node examples/modern/basic-usage.js path/to/mailbox.mbox

# Or with TypeScript
npx ts-node examples/modern/typescript-example.ts path/to/mailbox.mbox
```

## Migration Guide

For detailed migration instructions from v0.1.x to v0.2.x, see [MIGRATION.md](../MIGRATION.md).
