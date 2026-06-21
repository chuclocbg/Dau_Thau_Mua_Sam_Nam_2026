/**
 * Document registry — static mapping from template id to ordered document ids.
 *
 * Each template maps to the concrete procurement document(s) it governs.
 * Currently 1-to-1; the array structure supports multiple documents per
 * template in future phases without interface changes.
 *
 * Template ids must match the keys in templateRegistry.ts.
 * Document ids are the canonical procurement document identifiers used
 * throughout the Legal pipeline from v8.0 onward.
 */

export const DOCUMENT_REGISTRY: Readonly<Record<string, readonly string[]>> = {
  TO_TRINH:           ['TO_TRINH_MUA_SAM'],
  QUYET_DINH:         ['QUYET_DINH_PHE_DUYET'],
  BIEN_BAN:           ['BIEN_BAN_THAM_DINH'],
  KHLCNT:             ['KE_HOACH_LCNT'],
  HSYC:               ['HO_SO_YEU_CAU'],
  HSMT:               ['HO_SO_MOI_THAU'],
  BAO_CAO_DANH_GIA:   ['BAO_CAO_DANH_GIA_HSDT'],
  DU_TOAN:            ['DU_TOAN_MUA_SAM'],
  THAM_DINH_GIA:      ['CHUNG_THU_THAM_DINH_GIA'],
  PHAN_CONG_NHIEM_VU: ['QUYET_DINH_PHAN_CONG'],
};
