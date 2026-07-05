/**
 * Workflow context — shared types and initial context factory.
 * Imported by every other workflow module; keep it lean.
 */

export const WORKFLOW_STATE_IDS = [
  'DRAFT', 'PROCUREMENT_REQUEST', 'FUND_CONFIRMED', 'METHOD_SELECTED',
  'PLAN_APPROVED', 'DOCUMENT_PREPARATION', 'DOCUMENT_APPROVED', 'INVITATION',
  'BID_RECEIPT', 'BID_OPENING', 'EVALUATION', 'APPROVAL', 'CONTRACT_SIGNED',
  'IMPLEMENTATION', 'ACCEPTANCE', 'PAYMENT', 'COMPLETED',
] as const;

export type WorkflowStateId = (typeof WORKFLOW_STATE_IDS)[number];
export type WorkflowStatus  = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'SUSPENDED';

export interface WorkflowLegalRef {
  readonly document: string;
  readonly article:  string;
  readonly clause?:  string;
}

export interface WorkflowDocument {
  readonly id:       string;
  readonly name:     string;
  readonly required: boolean;
  readonly uploaded: boolean;
}

export interface WorkflowContext {
  readonly id:                 string;
  readonly packageId:          string;
  readonly packageType:        string;
  readonly estimatedValue:     number;
  readonly procurementMethod:  string;
  readonly approvalAuthority:  string;
  readonly currentState:       WorkflowStateId;
  readonly status:             WorkflowStatus;
  readonly documents:          readonly WorkflowDocument[];
  readonly createdAt:          string;
  readonly updatedAt:          string;
}

export function createInitialContext(params: {
  packageId:         string;
  packageType:       string;
  estimatedValue:    number;
  procurementMethod: string;
  approvalAuthority: string;
}): WorkflowContext {
  const now = new Date().toISOString();
  return {
    id:                crypto.randomUUID(),
    packageId:         params.packageId,
    packageType:       params.packageType,
    estimatedValue:    params.estimatedValue,
    procurementMethod: params.procurementMethod,
    approvalAuthority: params.approvalAuthority,
    currentState:      'DRAFT',
    status:            'ACTIVE',
    documents:         [],
    createdAt:         now,
    updatedAt:         now,
  };
}

export function uploadDocument(
  ctx:     WorkflowContext,
  docId:   string,
  docName: string,
): WorkflowContext {
  const existing = ctx.documents.find(d => d.id === docId);
  const updatedDocs: readonly WorkflowDocument[] = existing
    ? ctx.documents.map(d => d.id === docId ? { ...d, uploaded: true } : d)
    : [...ctx.documents, { id: docId, name: docName, required: true, uploaded: true }];
  return { ...ctx, documents: updatedDocs, updatedAt: new Date().toISOString() };
}

export function isWorkflowStateId(value: unknown): value is WorkflowStateId {
  return WORKFLOW_STATE_IDS.includes(value as WorkflowStateId);
}
