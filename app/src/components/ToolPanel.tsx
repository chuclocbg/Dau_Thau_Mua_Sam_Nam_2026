/**
 * P6-10X: ToolPanel — SSR-compatible registered tool view.
 * No hooks, no browser APIs, never throws.
 */

export interface ToolInfo {
  name?: string | null;
  description?: string | null;
  paramCount?: number | null;
}

export interface ToolPanelProps {
  tools?: ToolInfo[] | null;
  title?: string | null;
}

export function ToolPanel({ tools, title }: ToolPanelProps = {}) {
  const safeTools = Array.isArray(tools) ? tools : [];
  const safeTitle = typeof title === 'string' ? title : 'Tools';

  return (
    <div className="tool-panel">
      <h2>{safeTitle}</h2>
      {safeTools.length === 0
        ? <p className="empty-state">No tools registered.</p>
        : (
          <ul>
            {safeTools.map((t, i) => {
              const entry = (t !== null && typeof t === 'object') ? t : {} as ToolInfo;
              const name        = typeof entry.name        === 'string' ? entry.name        : `tool-${i}`;
              const description = typeof entry.description === 'string' ? entry.description : '';
              const paramCount  = typeof entry.paramCount  === 'number' ? entry.paramCount  : null;
              return (
                <li key={name} className="tool-item">
                  <span className="tool-name">{name}</span>
                  {description !== '' && <span className="tool-description">{description}</span>}
                  {paramCount !== null && <span className="tool-params">{`${paramCount} params`}</span>}
                </li>
              );
            })}
          </ul>
        )
      }
    </div>
  );
}
