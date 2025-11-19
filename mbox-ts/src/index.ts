import { existsSync, readFileSync } from "node:fs";
import type { Readable } from "node:stream";

export interface MboxOptions {
	strict?: boolean; // If true, throw error for invalid mbox files
}

export class MboxParser {
	private _options: MboxOptions;

	constructor(options: MboxOptions = {}) {
		this._options = {
			strict: false,
			...options,
		};
	}

	/**
	 * Parse an mbox file and return an array of raw email strings
	 * Each string can be directly fed to mailparser's simpleParser()
	 */
	async parseFile(filePath: string): Promise<string[]> {
		if (!existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const content = readFileSync(filePath);
		return this.parseContent(content);
	}

	/**
	 * Parse mbox content from a Buffer or string
	 */
	parseContent(content: string | Buffer): string[] {
		const text = typeof content === "string" ? content : content.toString();
		const lines = text.split("\n");

		const messages: string[] = [];
		let currentMessage: string[] = [];
		let isFirstLine = true;
		let isValidMbox = false;

		for (let i = 0; i < lines.length; i++) {
			const line = i < lines.length - 1 ? `${lines[i]}\n` : lines[i];
			if (!line) continue;
			const isFromLine = line.startsWith("From ");

			if (isFirstLine) {
				isFirstLine = false;
				if (isFromLine) {
					isValidMbox = true;
				} else {
					if (this._options.strict) {
						throw new Error(
							"NOT_AN_MBOX_FILE: File does not start with 'From ' line",
						);
					} else {
						isValidMbox = false;
						continue;
					}
				}
			}

			if (!isValidMbox) {
				continue;
			}

			if (isFromLine && currentMessage.length > 0) {
				// Finish current message
				messages.push(currentMessage.join(""));
				currentMessage = [];
			}

			currentMessage.push(line);
		}

		// Add the last message if it exists
		if (currentMessage.length > 0) {
			messages.push(currentMessage.join(""));
		}

		return messages;
	}

	/**
	 * Parse mbox content from a stream
	 */
	async parseStream(stream: Readable): Promise<string[]> {
		return new Promise((resolve, reject) => {
			let buffer = "";
			const messages: string[] = [];
			let currentMessage: string[] = [];
			let isFirstLine = true;
			let isValidMbox = false;

			stream.on("data", (chunk: Buffer) => {
				buffer += chunk.toString();
				const lines = buffer.split("\n");

				// Keep the last incomplete line in buffer
				buffer = lines.pop() || "";

				for (const line of lines) {
					const fullLine = `${line}\n`;
					const isFromLine = fullLine.startsWith("From ");

					if (isFirstLine) {
						isFirstLine = false;
						if (isFromLine) {
							isValidMbox = true;
						} else {
							if (this._options.strict) {
								reject(
									new Error(
										"NOT_AN_MBOX_FILE: Stream does not start with 'From ' line",
									),
								);
								return;
							} else {
								isValidMbox = false;
								continue;
							}
						}
					}

					if (!isValidMbox) {
						continue;
					}

					if (isFromLine && currentMessage.length > 0) {
						// Finish current message
						messages.push(currentMessage.join(""));
						currentMessage = [];
					}

					currentMessage.push(fullLine);
				}
			});

			stream.on("end", () => {
				// Process any remaining buffer
				if (buffer) {
					const isFromLine = buffer.startsWith("From ");

					if (isFromLine && currentMessage.length > 0) {
						// Finish current message
						messages.push(currentMessage.join(""));
						currentMessage = [];
					}

					currentMessage.push(buffer);
				}

				// Add the last message if it exists
				if (currentMessage.length > 0) {
					messages.push(currentMessage.join(""));
				}

				resolve(messages);
			});

			stream.on("error", reject);
		});
	}

	/**
	 * Get the number of messages in an mbox file without parsing them
	 */
	async getMessageCount(filePath: string): Promise<number> {
		const messages = await this.parseFile(filePath);
		return messages.length;
	}
}

export default MboxParser;
