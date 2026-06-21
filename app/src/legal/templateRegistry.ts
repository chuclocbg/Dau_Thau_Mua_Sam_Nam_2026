/**
 * Template registry — static mapping from domain id to ordered template ids.
 *
 * Domain ids must match the values produced by RegulationClassifier:
 *   GENERAL    (from GOV_PORTAL)
 *   HR         (from MOISA / PERSONNEL category)
 *   BIDDING    (from MPI   / PROCUREMENT category)
 *   FINANCIAL  (from MOF   / FINANCE category)
 *
 * Order within each domain is canonical and defines the node order in
 * TemplateDependencyResolver.  Do not sort or reorder.
 */

export const TEMPLATE_REGISTRY: Readonly<Record<string, readonly string[]>> = {
  GENERAL:   ['TO_TRINH', 'QUYET_DINH', 'BIEN_BAN'],
  HR:        ['PHAN_CONG_NHIEM_VU'],
  BIDDING:   ['KHLCNT', 'HSYC', 'HSMT', 'BAO_CAO_DANH_GIA'],
  FINANCIAL: ['DU_TOAN', 'THAM_DINH_GIA'],
};
