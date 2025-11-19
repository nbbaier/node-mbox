import { type Attachment, simpleParser } from "mailparser";
import type { Email } from "./types";

async function extractFromFileObject(original: File): Promise<{
	original: File; // the original .eml file;
	parsed: Email;
	attachments: File[];
}> {
	const emlText = await original.text();
	const mail = await simpleParser(emlText);

	const attachments: File[] = [];
	const mailAttachments = mail.attachments as Attachment[];

	for (const att of mailAttachments) {
		const bytes = att.content;
		if (!bytes || !bytes.length) continue;

		const name = safeName(att.filename || inferName(att.contentType));
		const blob = new Blob([bytes], {
			type: att.contentType || "application/octet-stream",
		});
		const file = new File([blob], name, {
			type: att.contentType || "application/octet-stream",
		});
		attachments.push(file);
	}

	const parsedEmail: Email = {
		from: mail.from?.text || "",
		to: Array.isArray(mail.to)
			? mail.to.map((addr) => addr.text || "")
			: mail.to
				? [mail.to.text || ""]
				: [],
		cc: Array.isArray(mail.cc)
			? mail.cc.map((addr) => addr.text || "")
			: mail.cc
				? mail.cc.text
				: undefined,
		bcc: Array.isArray(mail.bcc)
			? mail.bcc.map((addr) => addr.text || "")
			: mail.bcc
				? mail.bcc.text
				: undefined,
		subject: mail.subject || undefined,
		text: mail.text || undefined,
		html: mail.html || undefined,
		attachments: attachments,
	};

	return { original, parsed: parsedEmail, attachments };
}

function safeName(name: string): string {
	return name.replace(/[\\/:*?"<>|\x00-\x1F]/g, "").trim() || "attachment.bin";
}

function inferName(contentType?: string): string {
	const subtype = contentType?.split(";")[0]?.split("/")?.[1] || "bin";
	return `attachment.${subtype}`;
}

export { extractFromFileObject };
