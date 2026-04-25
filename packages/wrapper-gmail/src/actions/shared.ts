/**
 * Shared types and helpers for Gmail action handlers.
 *
 * Every action returns a narrow, JSON-safe projection of the raw Gmail
 * response rather than passing through `gmail_v1.Schema$Message` wholesale —
 * the runner surfaces action results over the UI Bridge and we don't want
 * large attachment payloads or MIME trees crossing that boundary by default.
 */

import type { gmail_v1 } from 'googleapis';

export interface MessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
}

export interface ThreadMessage extends MessageSummary {
  to: string;
  bodyText: string;
}

export interface ThreadDetail {
  id: string;
  messages: ThreadMessage[];
}

/** Read a named header out of a parsed message, case-insensitive. */
export function readHeader(
  message: gmail_v1.Schema$Message | undefined,
  name: string
): string {
  const headers = message?.payload?.headers ?? [];
  for (const h of headers) {
    if (h.name && h.name.toLowerCase() === name.toLowerCase()) {
      return h.value ?? '';
    }
  }
  return '';
}

/** Build a `MessageSummary` from a fully-hydrated `Schema$Message`. */
export function toMessageSummary(
  message: gmail_v1.Schema$Message | undefined
): MessageSummary {
  return {
    id: message?.id ?? '',
    threadId: message?.threadId ?? '',
    snippet: message?.snippet ?? '',
    from: readHeader(message, 'From'),
    subject: readHeader(message, 'Subject'),
    date: readHeader(message, 'Date'),
  };
}

/** Extract the best-effort plain text body from a Gmail message payload. */
export function extractBodyText(message: gmail_v1.Schema$Message | undefined): string {
  const payload = message?.payload;
  if (!payload) return '';
  const fromData = (data: string | null | undefined): string => {
    if (!data) return '';
    try {
      return Buffer.from(data, 'base64url').toString('utf8');
    } catch {
      return '';
    }
  };
  if (payload.body?.data) return fromData(payload.body.data);
  const parts = payload.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return fromData(part.body.data);
    }
  }
  // Fallback: first text/* part.
  for (const part of parts) {
    if ((part.mimeType ?? '').startsWith('text/') && part.body?.data) {
      return fromData(part.body.data);
    }
  }
  return '';
}

/** Build a `ThreadMessage` from a fully-hydrated `Schema$Message`. */
export function toThreadMessage(
  message: gmail_v1.Schema$Message | undefined
): ThreadMessage {
  return {
    ...toMessageSummary(message),
    to: readHeader(message, 'To'),
    bodyText: extractBodyText(message),
  };
}

/**
 * Encode a reply as a base64url RFC 2822 string suitable for
 * `gmail.users.messages.send`.
 */
export function encodeReplyMime(args: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines: string[] = [];
  lines.push(`To: ${args.to}`);
  const subject = args.subject.startsWith('Re:') ? args.subject : `Re: ${args.subject}`;
  lines.push(`Subject: ${subject}`);
  if (args.inReplyTo) lines.push(`In-Reply-To: ${args.inReplyTo}`);
  if (args.references) lines.push(`References: ${args.references}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('MIME-Version: 1.0');
  lines.push('');
  lines.push(args.body);
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}
