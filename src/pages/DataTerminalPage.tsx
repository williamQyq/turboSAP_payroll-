import { useMemo } from 'react';

import { AdminLayout } from '../components/layout/AdminLayout';

const AGENT_CONSOLE_URL = import.meta.env.VITE_AGENT_CONSOLE_URL || 'http://localhost:4096';

function buildAgentUrl(): string {
  try {
    const url = new URL(AGENT_CONSOLE_URL, window.location.origin);
    url.searchParams.set('_ts', Date.now().toString());
    return url.toString();
  } catch (error) {
    console.warn('Unable to parse agent console URL', error);
    return AGENT_CONSOLE_URL;
  }
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
