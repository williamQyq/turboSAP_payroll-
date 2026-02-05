import { useMemo } from 'react';

import { AdminLayout } from '../components/layout/AdminLayout';

const isProductionEnv =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_ENV === 'production') ||
  (typeof process !== 'undefined' && process.env?.APP_ENV === 'production');
console.log(`isProductionEnv= ${isProductionEnv}`)
const DEFAULT_AGENT_CONSOLE_URL = 'http://localhost:4096/agent-ui/';

const resolvedProductionAgentUrl = (() => {
  const apiBaseUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_URL);

  if (!apiBaseUrl) {
    console.log("No api base url.")
    return null;
  }

  try {
    return new URL('/agent-ui/', apiBaseUrl).toString();
  } catch (error) {
    console.warn('Unable to construct agent console URL from VITE_API_URL', error);
    return null;
  }
})();

const AGENT_CONSOLE_URL =
  (isProductionEnv && resolvedProductionAgentUrl) || DEFAULT_AGENT_CONSOLE_URL;

function buildAgentUrl(): string {
  try {
    const url = new URL(AGENT_CONSOLE_URL, window.location.origin);
    return url.toString();
  } catch (error) {
    console.warn('Unable to parse agent console URL', error);
    return AGENT_CONSOLE_URL;
  }

export function DataTerminalPage() {
  const iframeSrc = useMemo(buildAgentUrl, []);

  return (
    <AdminLayout title="Agent Console" description="Embedded agent output">
      <iframe
        src={iframeSrc}
        title="TurboSAP Agent Output"
        className="w-full h-[calc(100vh-100px)] border-0"
      />
    </AdminLayout>
  );
}
