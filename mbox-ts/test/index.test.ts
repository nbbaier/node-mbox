import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { Mbox } from "../src/index.ts";

const FILES = [
	["Empty file", "test-0-message.mbox", 0],
	["Containing 1 message", "test-1-message.mbox", 1],
	["Containing 2 messages", "test-2-message.mbox", 2],
	["Containing 3 messages", "test-3-message.mbox", 3],
	["Containing 4 messages", "test-4-message.mbox", 4],
	["Invalid, with mbox attached", "test-attached.mbox", 0],
];

describe.for(FILES)("(parser)", (testCase) => {
	const [name, file, expected] = testCase;
	const filePath = `${import.meta.dirname}/data/${file}`;

	test(`filename - ${file}`, () => {
		const messageCount = new Mbox(filePath).messageCount;
		expect(messageCount).toBe(expected);
	});

	test(`string - ${file}`, () => {
		const mailbox = fs.readFileSync(filePath);
		const messageCount = new Mbox(mailbox).messageCount;
		expect(messageCount).toBe(expected);
	});

	test(`stream - ${file}`, async () => {
		const stream = fs.createReadStream(filePath);
		const mbox = new Mbox(stream);
		
		await new Promise((resolve) => {
			mbox.on('end', resolve);
		});
		
		expect(mbox.messageCount).toBe(expected);
	});

	// test(`piped - ${file}`, () => {
	// 	const stream = fs.createReadStream(fileName);
	// 	const parser = new Mbox();
	// 	// stream.pipe(parser);
	// 	const messageCount = expected; // parser.messageCount
	// 	expect(messageCount).toBe(expected);
	// });
});
