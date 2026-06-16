/**
 * P6-10Y: RoutePanel — SSR-compatible ApiServer route list view.
 *
 * Visualises HTTP routes registered with ApiServer (P6-10W).
 * Accepts a plain RouteDisplayInfo[] — no handler functions — so the
 * component is safe to render server-side and in tests.
 *
 * No hooks, no browser APIs, never throws.
 */

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RouteDisplayInfo {
  /** HTTP method for this route. */
  method?: RouteMethod | string | null;
  /** URL path including leading slash (e.g. "/health"). */
  path?: string | null;
  /** Optional human-readable description of the route. */
  description?: string | null;
}

export interface RoutePanelProps {
  routes?: RouteDisplayInfo[] | null;
  title?: string | null;
}

export function RoutePanel({ routes, title }: RoutePanelProps = {}) {
  const safeRoutes = Array.isArray(routes) ? routes : [];
  const safeTitle  = typeof title === 'string' ? title : 'API Routes';

  return (
    <div className="route-panel">
      <h2>{safeTitle}</h2>
      {safeRoutes.length === 0
        ? <p className="empty-state">No routes registered.</p>
        : (
          <ul>
            {safeRoutes.map((r, i) => {
              const entry       = (r !== null && typeof r === 'object') ? r : {} as RouteDisplayInfo;
              const method      = typeof entry.method      === 'string' ? entry.method      : 'GET';
              const path        = typeof entry.path        === 'string' ? entry.path        : `/${i}`;
              const description = typeof entry.description === 'string' ? entry.description : '';
              const key         = `${method}:${path}`;
              return (
                <li key={key} className="route-item">
                  <span className={`route-method method-${method.toLowerCase()}`}>{method}</span>
                  <span className="route-path">{path}</span>
                  {description !== '' && (
                    <span className="route-description">{description}</span>
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
