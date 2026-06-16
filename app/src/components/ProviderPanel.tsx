/**
 * P6-10X: ProviderPanel — SSR-compatible provider status view.
 * No hooks, no browser APIs, never throws.
 */

export interface ProviderInfo {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  status?: string | null;
  model?: string | null;
}

export interface ProviderPanelProps {
  providers?: ProviderInfo[] | null;
  title?: string | null;
}

export function ProviderPanel({ providers, title }: ProviderPanelProps = {}) {
  const safeProviders = Array.isArray(providers) ? providers : [];
  const safeTitle = typeof title === 'string' ? title : 'Providers';

  return (
    <div className="provider-panel">
      <h2>{safeTitle}</h2>
      {safeProviders.length === 0
        ? <p className="empty-state">No providers registered.</p>
        : (
          <ul>
            {safeProviders.map((p, i) => {
              const entry = (p !== null && typeof p === 'object') ? p : {} as ProviderInfo;
              const id     = typeof entry.id     === 'string' ? entry.id     : `p-${i}`;
              const name   = typeof entry.name   === 'string' ? entry.name   : '(unnamed)';
              const type   = typeof entry.type   === 'string' ? entry.type   : '';
              const status = typeof entry.status === 'string' ? entry.status : 'unknown';
              const model  = typeof entry.model  === 'string' ? entry.model  : '';
              return (
                <li key={id} className="provider-item">
                  <span className="provider-name">{name}</span>
                  {type !== '' && <span className="provider-type">{type}</span>}
                  <span className={`provider-status status-${status}`}>{status}</span>
                  {model !== '' && <span className="provider-model">{model}</span>}
                </li>
              );
            })}
          </ul>
        )
      }
    </div>
  );
}
