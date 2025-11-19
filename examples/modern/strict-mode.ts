/**
 * Example: Strict Mode Validation
 *
 * This example demonstrates using strict mode to validate
 * that files are properly formatted mbox files.
 */

import { Mbox } from '../../src/index';

async function validateMboxFile(filename: string) {
  console.log(`Validating: ${filename}\n`);

  try {
    // Try to open with strict mode enabled
    const mbox = await Mbox.create(filename, {
      strict: true,
    });

    console.log('✓ File is a valid mbox file');
    console.log(`  Contains ${mbox.count()} messages`);

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('NOT_AN_MBOX_FILE')) {
        console.log('✗ File is NOT a valid mbox file');
        console.log('  Error:', error.message);
        return false;
      }
      throw error;
    }
  }
}

async function demonstrateStrictMode() {
  // Example 1: Valid mbox file
  console.log('=== Example 1: Valid mbox file ===');
  await validateMboxFile('mailbox.mbox');
  console.log();

  // Example 2: Invalid file (doesn't start with "From ")
  console.log('=== Example 2: Invalid file with strict mode ===');
  await validateMboxFile('not-an-mbox.txt');
  console.log();

  // Example 3: Open without strict mode (lenient)
  console.log('=== Example 3: Same file without strict mode ===');
  try {
    const mbox = await Mbox.create('not-an-mbox.txt', {
      strict: false, // Default behavior
    });
    console.log('✓ File opened successfully (strict mode disabled)');
    console.log(`  Found ${mbox.count()} messages`);
  } catch (error) {
    console.log('✗ Failed to open file');
  }
}

// Run the example
demonstrateStrictMode().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
