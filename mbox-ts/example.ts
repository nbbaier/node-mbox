import { simpleParser } from "mailparser";
import { MboxParser } from "./src/index";

async function main() {
	const parser = new MboxParser({ strict: false });

	try {
		// Parse the mbox file
		const messages = await parser.parseFile("./test-label.mbox");

		console.log(`Found ${messages.length} messages:`);

		for (let i = 0; i < messages.length; i++) {
			const rawMessage = messages[i];
			if (!rawMessage) continue;

			console.log(`\n--- Processing Message ${i + 1} ---`);

			try {
				// Parse the raw email with mailparser
				const parsed = await simpleParser(rawMessage);

				console.log(parsed.attachments);
				// console.log("Subject:", parsed.subject);
				// console.log(
				// 	"From:",
				// 	Array.isArray(parsed.from) ? parsed.from[0]?.text : parsed.from?.text,
				// );
				// console.log(
				// 	"To:",
				// 	Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to?.text,
				// );
				// console.log("Date:", parsed.date);
				// console.log("Text body:", `${parsed.text?.substring(0, 100)}...`);

				// if (parsed.attachments && parsed.attachments.length > 0) {
				// 	console.log(
				// 		"Attachments:",
				// 		parsed.attachments.map((a) => a.filename).join(", "),
				// 	);
				// }
			} catch (error) {
				console.error(`Error parsing message ${i + 1}:`, error);
			}
		}
	} catch (error) {
		console.error("Error parsing mbox file:", error);
	}
}

main();
