/**
 * P6-10X: AgentPanel — SSR-compatible agent definition view.
 * No hooks, no browser APIs, never throws.
 */

export interface AgentInfo {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  taskCount?: number | null;
}

export interface AgentPanelProps {
  agents?: AgentInfo[] | null;
  title?: string | null;
}

export function AgentPanel({ agents, title }: AgentPanelProps = {}) {
  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeTitle = typeof title === 'string' ? title : 'Agents';

  return (
    <div className="agent-panel">
      <h2>{safeTitle}</h2>
      {safeAgents.length === 0
        ? <p className="empty-state">No agents registered.</p>
        : (
          <ul>
            {safeAgents.map((a, i) => {
              const entry = (a !== null && typeof a === 'object') ? a : {} as AgentInfo;
              const id          = typeof entry.id          === 'string' ? entry.id          : `agent-${i}`;
              const name        = typeof entry.name        === 'string' ? entry.name        : '(unnamed)';
              const description = typeof entry.description === 'string' ? entry.description : '';
              const taskCount   = typeof entry.taskCount   === 'number' ? entry.taskCount   : null;
              return (
                <li key={id} className="agent-item">
                  <span className="agent-name">{name}</span>
                  {description !== '' && <span className="agent-description">{description}</span>}
                  {taskCount !== null && <span className="agent-tasks">{`${taskCount} tasks`}</span>}
                </li>
              );
            })}
          </ul>
        )
      }
    </div>
  );
}
