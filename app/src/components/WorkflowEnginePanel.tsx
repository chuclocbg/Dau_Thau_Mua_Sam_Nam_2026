/**
 * P6-10X: WorkflowEnginePanel — SSR-compatible WorkflowEngine definition view.
 * Shows registered workflow definitions from WorkflowEngine.
 * No hooks, no browser APIs, never throws.
 */

export interface WorkflowInfo {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  stepCount?: number | null;
}

export interface WorkflowEnginePanelProps {
  workflows?: WorkflowInfo[] | null;
  title?: string | null;
}

export function WorkflowEnginePanel({ workflows, title }: WorkflowEnginePanelProps = {}) {
  const safeWorkflows = Array.isArray(workflows) ? workflows : [];
  const safeTitle = typeof title === 'string' ? title : 'Workflows';

  return (
    <div className="workflow-engine-panel">
      <h2>{safeTitle}</h2>
      {safeWorkflows.length === 0
        ? <p className="empty-state">No workflows registered.</p>
        : (
          <ul>
            {safeWorkflows.map((wf, i) => {
              const entry = (wf !== null && typeof wf === 'object') ? wf : {} as WorkflowInfo;
              const id        = typeof entry.id        === 'string' ? entry.id        : `wf-${i}`;
              const name      = typeof entry.name      === 'string' ? entry.name      : '(unnamed)';
              const status    = typeof entry.status    === 'string' ? entry.status    : 'pending';
              const stepCount = typeof entry.stepCount === 'number' ? entry.stepCount : null;
              return (
                <li key={id} className="workflow-item">
                  <span className="workflow-name">{name}</span>
                  <span className={`workflow-status status-${status}`}>{status}</span>
                  {stepCount !== null && (
                    <span className="workflow-steps">{`${stepCount} steps`}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )
      }
    </div>
  );
}
