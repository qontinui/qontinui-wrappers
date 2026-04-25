/**
 * Handler registration for `@qontinui/wrapper-gmail`.
 *
 * All five actions target the api transport. Registering against
 * `WrapperTransport.register` (rather than `handlerRegistry.register`
 * directly) matches the widened interface introduced with the runtime.
 */

import type { WrapperTransport } from '@qontinui/ui-bridge-wrapper';
import { archive, type ArchiveParams, type ArchiveResult } from './actions/archive.js';
import { getThread, type GetThreadParams, type GetThreadResult } from './actions/get-thread.js';
import {
  listUnread,
  type ListUnreadParams,
  type ListUnreadResult,
} from './actions/list-unread.js';
import { search, type SearchParams, type SearchResult } from './actions/search.js';
import { sendReply, type SendReplyParams, type SendReplyResult } from './actions/send-reply.js';

export function registerHandlers(transport: WrapperTransport): void {
  transport.register<ListUnreadParams, ListUnreadResult>('list-unread', (params) =>
    listUnread(params)
  );
  transport.register<SearchParams, SearchResult>('search', (params) => search(params));
  transport.register<GetThreadParams, GetThreadResult>('get-thread', (params) =>
    getThread(params)
  );
  transport.register<SendReplyParams, SendReplyResult>('send-reply', (params) =>
    sendReply(params)
  );
  transport.register<ArchiveParams, ArchiveResult>('archive', (params) => archive(params));
}

/** Action ids registered by `registerHandlers`, useful for tests. */
export const GMAIL_ACTION_IDS = [
  'list-unread',
  'search',
  'get-thread',
  'send-reply',
  'archive',
] as const;

export type GmailActionId = (typeof GMAIL_ACTION_IDS)[number];
