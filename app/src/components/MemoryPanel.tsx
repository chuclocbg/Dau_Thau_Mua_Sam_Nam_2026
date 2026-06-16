/**
 * P6-10X: MemoryPanel — SSR-compatible memory snapshot view.
 * No hooks, no browser APIs, never throws.
 */

export interface MemorySnapshotInfo {
  id?: string | null;
  turnCount?: number | null;
  totalTokens?: number | null;
  label?: string | null;
}

export interface MemoryPanelProps {
  snapshots?: MemorySnapshotInfo[] | null;
  title?: string | null;
}

export function MemoryPanel({ snapshots, title }: MemoryPanelProps = {}) {
  const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];
  const safeTitle = typeof title === 'string' ? title : 'Memory';

  return (
    <div className="memory-panel">
      <h2>{safeTitle}</h2>
      {safeSnapshots.length === 0
        ? <p className="empty-state">No memory snapshots.</p>
        : (
          <ul>
            {safeSnapshots.map((snap, i) => {
              const entry = (snap !== null && typeof snap === 'object') ? snap : {} as MemorySnapshotInfo;
              const id         = typeof entry.id    === 'string' ? entry.id    : `mem-${i}`;
              const label      = typeof entry.label === 'string' ? entry.label : id;
              const turnCount  = typeof entry.turnCount  === 'number' ? entry.turnCount  : 0;
              const totalTokens = typeof entry.totalTokens === 'number' ? entry.totalTokens : null;
              return (
                <li key={id} className="memory-item">
                  <span className="memory-label">{label}</span>
                  <span className="memory-turns">{`${turnCount} turns`}</span>
                  {totalTokens !== null && (
                    <span className="memory-tokens">{`${totalTokens} tokens`}</span>
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
