/**
 * `@qontinui/wrapper-v0` — React entry point.
 *
 * Defaults to the `api` transport because it's the fastest round trip and
 * covers the documented v0 surface. Browser transport users should drive
 * `createTransport` themselves in a host app and hand the result to a
 * custom entry; this default shell is for the common read-mostly case.
 */

import React from 'react';
import { createTransport } from '@qontinui/ui-bridge-wrapper';
import {
  WrapperAppShell,
  useWrapperStatus,
} from '@qontinui/ui-bridge-wrapper/react';
import { useUIComponent } from '@qontinui/ui-bridge';
import { registerHandlers, V0_ACTIONS } from './handlers.js';

const transport = createTransport({
  kind: 'api',
  appId: 'wrapper-v0',
  appName: 'v0',
});
const registration = registerHandlers(transport);

export function V0Wrapper(): React.ReactElement {
  const status = useWrapperStatus(transport);

  useUIComponent({
    id: 'wrapper-v0',
    name: 'v0',
    description:
      "UI Bridge wrapper for Vercel v0. API-primary — browser-only actions are omitted on the 'api' transport.",
    state: () => ({ status, registered: registration.registered }),
    actions: V0_ACTIONS.filter((a) => registration.registered.includes(a.id)).map(
      (action) => ({
        id: action.id,
        label: action.id,
        paramSchema: action.paramSchema,
        handler: (params) => transport.dispatch(action.id, params),
      })
    ),
  });

  return <WrapperAppShell transport={transport} title="v0" />;
}

export default V0Wrapper;
export { transport, registration };
