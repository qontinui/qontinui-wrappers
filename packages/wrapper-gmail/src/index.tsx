/**
 * `@qontinui/wrapper-gmail` — React entry point.
 *
 * Mounts a single `api` transport, registers all Gmail action handlers, and
 * exposes them on UI Bridge via `useUIComponent`. Intended to be rendered
 * inside a host that already provides the UI Bridge context (runner tab,
 * dev shell, etc.).
 */

import React from 'react';
import { createTransport } from '@qontinui/ui-bridge-wrapper';
import {
  WrapperAppShell,
  useWrapperStatus,
} from '@qontinui/ui-bridge-wrapper/react';
import { useUIComponent } from '@qontinui/ui-bridge';
import { registerHandlers } from './handlers.js';
import { listUnreadParamSchema } from './actions/list-unread.js';
import { searchParamSchema } from './actions/search.js';
import { getThreadParamSchema } from './actions/get-thread.js';
import { sendReplyParamSchema } from './actions/send-reply.js';
import { archiveParamSchema } from './actions/archive.js';

const transport = createTransport({
  kind: 'api',
  appId: 'wrapper-gmail',
  appName: 'Gmail',
});
registerHandlers(transport);

export function GmailWrapper(): React.ReactElement {
  const status = useWrapperStatus(transport);

  useUIComponent({
    id: 'wrapper-gmail',
    name: 'Gmail',
    description: 'UI Bridge wrapper around the Gmail REST API.',
    state: () => ({ status }),
    actions: [
      {
        id: 'list-unread',
        label: 'List unread',
        paramSchema: listUnreadParamSchema,
        handler: (params) => transport.dispatch('list-unread', params),
      },
      {
        id: 'search',
        label: 'Search',
        paramSchema: searchParamSchema,
        handler: (params) => transport.dispatch('search', params),
      },
      {
        id: 'get-thread',
        label: 'Get thread',
        paramSchema: getThreadParamSchema,
        handler: (params) => transport.dispatch('get-thread', params),
      },
      {
        id: 'send-reply',
        label: 'Send reply',
        paramSchema: sendReplyParamSchema,
        handler: (params) => transport.dispatch('send-reply', params),
      },
      {
        id: 'archive',
        label: 'Archive',
        paramSchema: archiveParamSchema,
        handler: (params) => transport.dispatch('archive', params),
      },
    ],
  });

  return <WrapperAppShell transport={transport} title="Gmail" />;
}

export default GmailWrapper;
export { transport };
