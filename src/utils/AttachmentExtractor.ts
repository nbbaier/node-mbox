import * as fs from 'fs';
import * as path from 'path';
import type { EmailAttachment } from '../parsers/EmailParser';

export interface ExtractionOptions {
  /**
   * Output directory for attachments
   */
  outputDir: string;

  /**
   * Deduplicate by checksum (requires checksumAttachments: true)
   */
  deduplicate?: boolean | undefined;

  /**
   * Sanitize filenames for filesystem safety
   */
  sanitizeFilenames?: boolean | undefined;

  /**
   * Handle filename conflicts
   */
  onConflict?: 'skip' | 'overwrite' | 'rename' | undefined;

  /**
   * Filter function to select which attachments to extract
   */
  filter?: ((attachment: EmailAttachment) => boolean) | undefined;
}

export interface ExtractionResult {
  totalAttachments: number;
  extracted: number;
  skipped: number;
  deduplicated: number;
  files: string[];
}

export class AttachmentExtractor {
  private seenChecksums = new Set<string>();

  /**
   * Extract attachments from parsed emails
   */
  async extractFromEmails(
    attachments: EmailAttachment[],
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    await fs.promises.mkdir(options.outputDir, { recursive: true });

    const result: ExtractionResult = {
      totalAttachments: attachments.length,
      extracted: 0,
      skipped: 0,
      deduplicated: 0,
      files: [],
    };

    for (const attachment of attachments) {
      // Apply filter
      if (options.filter && !options.filter(attachment)) {
        result.skipped++;
        continue;
      }

      // Check for duplicates
      if (options.deduplicate && attachment.checksum) {
        if (this.seenChecksums.has(attachment.checksum)) {
          result.deduplicated++;
          continue;
        }
        this.seenChecksums.add(attachment.checksum);
      }

      // Determine filename
      let filename = attachment.filename || this.inferFilename(attachment);
      if (options.sanitizeFilenames !== false) {
        filename = this.sanitizeFilename(filename);
      }

      // Handle conflicts
      const filepath = await this.resolveFilePath(
        options.outputDir,
        filename,
        options.onConflict || 'rename'
      );

      if (filepath) {
        await fs.promises.writeFile(filepath, attachment.content);
        result.files.push(filepath);
        result.extracted++;
      } else {
        result.skipped++;
      }
    }

    return result;
  }

  /**
   * Reset deduplication state
   */
  reset(): void {
    this.seenChecksums.clear();
  }

  private sanitizeFilename(name: string): string {
    // Remove dangerous characters
    return name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').trim() || 'attachment.bin';
  }

  private inferFilename(attachment: EmailAttachment): string {
    const ext = this.getExtensionFromContentType(attachment.contentType);
    return `attachment${ext}`;
  }

  private getExtensionFromContentType(contentType: string): string {
    const subtype = contentType.split(';')[0]?.split('/')[1];
    return subtype ? `.${subtype}` : '.bin';
  }

  private async resolveFilePath(
    dir: string,
    filename: string,
    onConflict: 'skip' | 'overwrite' | 'rename'
  ): Promise<string | null> {
    const basePath = path.join(dir, filename);

    try {
      await fs.promises.access(basePath);
      // File exists

      switch (onConflict) {
        case 'skip':
          return null;
        case 'overwrite':
          return basePath;
        case 'rename':
          return await this.findUniquePath(dir, filename);
      }
    } catch {
      // File doesn't exist - safe to use
      return basePath;
    }
  }

  private async findUniquePath(dir: string, filename: string): Promise<string> {
    const ext = path.extname(filename);
    const stem = path.basename(filename, ext);
    const MAX_ATTEMPTS = 10000;

    let counter = 1;
    while (counter <= MAX_ATTEMPTS) {
      const candidate = path.join(dir, `${stem} (${counter})${ext}`);
      try {
        await fs.promises.access(candidate);
        counter++;
      } catch {
        return candidate;
      }
    }

    throw new Error(
      `Unable to find unique path for "${filename}" after ${MAX_ATTEMPTS} attempts. ` +
        'Check filesystem permissions or available disk space.'
    );
  }
}
