export interface Email {
	from: string;
	to: string[];
	cc: string | string[] | undefined;
	bcc: string | string[] | undefined;
	subject: string | undefined;
	text: string | undefined;
	html: string | undefined;
	attachments: File[];
}
