/** biome-ignore-all lint/suspicious/noControlCharactersInRegex: idc */
import { promises as fs } from "node:fs";
import path from "node:path";
import { type Attachment, simpleParser } from "./mailparser-types";

async function extractFromEml(emlPath: string, outDir: string, dedupe = false) {
	const raw = await fs.readFile(emlPath);
	const mail = await simpleParser(raw);

	await fs.mkdir(outDir, { recursive: true });

	const seen = new Set<string>();
	let count = 0;

	const attachments = mail.attachments as Attachment[];
	for (const att of attachments) {
		const bytes = att.content; // Buffer
		if (!bytes || !bytes.length) continue;

		if (dedupe) {
			const hash = await sha256Hex(bytes);
			if (seen.has(hash)) continue;
			seen.add(hash);
		}

		const name = safeName(att.filename || inferName(att.contentType));
		const target = await uniquePath(outDir, name);
		await fs.writeFile(target, bytes);
		count++;
	}

	return count;
}

function safeName(name: string): string {
	return name.replace(/[\\/:*?"<>|\x00-\x1F]/g, "").trim() || "attachment.bin";
}

function inferName(contentType?: string): string {
	const subtype = contentType?.split(";")[0]?.split("/")?.[1] || "bin";
	return `attachment.${subtype}`;
}

async function uniquePath(dir: string, filename: string): Promise<string> {
	const base = path.join(dir, filename);
	try {
		await fs.access(base);
	} catch {
		return base;
	}
	const ext = path.extname(filename);
	const stem = path.basename(filename, ext);
	let i = 1;
	while (true) {
		const candidate = path.join(dir, `${stem} (${i})${ext}`);
		try {
			await fs.access(candidate);
			i++;
		} catch {
			return candidate;
		}
	}
}

async function sha256Hex(data: Buffer): Promise<string> {
	const { createHash } = await import("node:crypto");
	return createHash("sha256").update(data).digest("hex");
}

// CLI runner (ts-node or compiled)
if (require.main === module) {
	(async () => {
		const [, , src, out, flag] = process.argv;
		if (!src || !out) {
			console.error(
				"Usage: ts-node extract_eml.ts <input.eml|dir> <outDir> [--dedupe]",
			);
			process.exit(1);
		}
		const dedupe = flag === "--dedupe";
		const stat = await fs.stat(src);
		let total = 0;

		if (stat.isFile() && path.extname(src).toLowerCase() === ".eml") {
			total += await extractFromEml(src, out);
		} else {
			const files = await walk(src, ".eml");
			for (const f of files) {
				total += await extractFromEml(f, out, dedupe);
			}
		}
		console.log(`Extracted ${total} attachment(s).`);
	})().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

async function walk(root: string, ext: string): Promise<string[]> {
	const result: string[] = [];
	async function recur(dir: string) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			const full = path.join(dir, e.name);
			if (e.isDirectory()) await recur(full);
			else if (e.isFile() && path.extname(e.name).toLowerCase() === ext)
				result.push(full);
		}
	}
	await recur(root);
	return result;
}
