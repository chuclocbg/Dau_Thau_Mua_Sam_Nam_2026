/**
 * P6-10X: Dashboard — SSR-compatible top-level composition panel.
 * Composes all sub-panels. No hooks, no browser APIs, never throws.
 */

import { ProviderPanel } from './ProviderPanel';
import { SessionPanel }  from './SessionPanel';
import { MemoryPanel }   from './MemoryPanel';
import { WorkflowEnginePanel } from './WorkflowEnginePanel';
import { AgentPanel }          from './AgentPanel';
import { ToolPanel }     from './ToolPanel';
import { ChatPanel }     from './ChatPanel';

import type { ProviderInfo }       from './ProviderPanel';
import type { SessionDisplayInfo } from './SessionPanel';
import type { MemorySnapshotInfo } from './MemoryPanel';
import type { WorkflowInfo }       from './WorkflowEnginePanel';
import type { AgentInfo }          from './AgentPanel';
import type { ToolInfo }           from './ToolPanel';
import type { ChatMessage }        from './ChatPanel';

export type { ProviderInfo, SessionDisplayInfo, MemorySnapshotInfo, WorkflowInfo, AgentInfo, ToolInfo, ChatMessage };

export interface DashboardProps {
  title?: string | null;
  providers?: ProviderInfo[] | null;
  sessions?: SessionDisplayInfo[] | null;
  snapshots?: MemorySnapshotInfo[] | null;
  workflows?: WorkflowInfo[] | null;
  agents?: AgentInfo[] | null;
  tools?: ToolInfo[] | null;
  messages?: ChatMessage[] | null;
}

export function Dashboard({
  title,
  providers,
  sessions,
  snapshots,
  workflows,
  agents,
  tools,
  messages,
}: DashboardProps = {}) {
  const safeTitle = typeof title === 'string' ? title : 'AI Dashboard';

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">{safeTitle}</h1>
      <div className="dashboard-panels">
        <ProviderPanel providers={providers} />
        <SessionPanel  sessions={sessions} />
        <MemoryPanel   snapshots={snapshots} />
        <WorkflowEnginePanel workflows={workflows} />
        <AgentPanel    agents={agents} />
        <ToolPanel     tools={tools} />
        <ChatPanel     messages={messages} />
      </div>
    </div>
  );
}
