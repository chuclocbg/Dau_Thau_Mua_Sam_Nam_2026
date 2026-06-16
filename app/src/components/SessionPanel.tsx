/**
 * P6-10X: SessionPanel — SSR-compatible session lifecycle view.
 * No hooks, no browser APIs, never throws.
 */

export type SessionState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

export interface SessionDisplayInfo {
  id?: string | null;
  state?: SessionState | string | null;
  label?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export interface SessionPanelProps {
  sessions?: SessionDisplayInfo[] | null;
  title?: string | null;
}

export function SessionPanel({ sessions, title }: SessionPanelProps = {}) {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeTitle = typeof title === 'string' ? title : 'Sessions';

  return (
    <div className="session-panel">
      <h2>{safeTitle}</h2>
      {safeSessions.length === 0
        ? <p className="empty-state">No active sessions.</p>
        : (
          <ul>
            {safeSessions.map((s, i) => {
              const entry = (s !== null && typeof s === 'object') ? s : {} as SessionDisplayInfo;
              const id    = typeof entry.id    === 'string' ? entry.id    : `s-${i}`;
              const state = typeof entry.state === 'string' ? entry.state : 'IDLE';
              const label = typeof entry.label === 'string' ? entry.label : id;
              return (
                <li key={id} className="session-item">
                  <span className="session-label">{label}</span>
                  <span className={`session-state state-${state.toLowerCase()}`}>{state}</span>
                </li>
              );
            })}
          </ul>
        )
      }
    </div>
  );
}
