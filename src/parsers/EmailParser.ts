/**
 * Optional email parsing integration
 * Requires mailparser as a peer dependency
 */

import { Readable } from 'stream';

export interface ParsedEmail {
  from: string | undefined;
  to: string[] | undefined;
  cc: string[] | undefined;
  bcc: string[] | undefined;
  subject: string | undefined;
  date: Date | undefined;
  messageId: string | undefined;
  text: string | undefined;
  html: string | false | undefined;
  attachments: EmailAttachment[];
  headers: Map<string, string | string[] | any>;
}

export interface EmailAttachment {
  filename: string | undefined;
  contentType: string;
  content: Buffer;
  size: number;
  checksum: string | undefined;
  cid: string | undefined;
  contentDisposition: string | undefined;
}

export interface ParserOptions {
  /**
   * Skip text body parsing (for attachment-only extraction)
   */
  skipTextBody?: boolean | undefined;

  /**
   * Skip HTML body parsing
   */
  skipHtmlBody?: boolean | undefined;

  /**
   * Compute SHA-256 checksums for attachments
   */
  checksumAttachments?: boolean | undefined;
}

export class EmailParser {
  private simpleParser?: any;

  constructor() {
    try {
      // Dynamic import - only loads if user installs mailparser
      const mailparser = require('mailparser');
      this.simpleParser = mailparser.simpleParser;
    } catch (e) {
      throw new Error(
        'EmailParser requires "mailparser" as a peer dependency. ' +
          'Install it with: npm install mailparser'
      );
    }
  }

  /**
   * Parse raw email string/buffer into structured object
   */
  async parse(
    source: string | Buffer | Readable,
    options: ParserOptions = {}
  ): Promise<ParsedEmail> {
    if (!this.simpleParser) {
      throw new Error('mailparser not available');
    }

    const parsed = await this.simpleParser(source, {
      skipTextBody: options.skipTextBody,
      skipHtmlToText: options.skipHtmlBody,
    });

    const attachments: EmailAttachment[] = [];

    for (const att of parsed.attachments || []) {
      const attachment: EmailAttachment = {
        filename: att.filename,
        contentType: att.contentType,
        content: att.content,
        size: att.size,
        checksum: undefined,
        cid: att.cid,
        contentDisposition: att.contentDisposition,
      };

      if (options.checksumAttachments && att.content) {
        attachment.checksum = await this.computeChecksum(att.content);
      }

      attachments.push(attachment);
    }

    return {
      from: parsed.from?.text,
      to: this.addressesToArray(parsed.to),
      cc: this.addressesToArray(parsed.cc),
      bcc: this.addressesToArray(parsed.bcc),
      subject: parsed.subject,
      date: parsed.date,
      messageId: parsed.messageId,
      text: parsed.text,
      html: parsed.html,
      attachments,
      headers: new Map(Object.entries(parsed.headers || {})),
    };
  }

  private addressesToArray(addresses: any): string[] | undefined {
    if (!addresses) return undefined;
    if (Array.isArray(addresses)) {
      return addresses.map((addr) => addr.text || addr.address);
    }
    return [addresses.text || addresses.address];
  }

  private async computeChecksum(buffer: Buffer): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
