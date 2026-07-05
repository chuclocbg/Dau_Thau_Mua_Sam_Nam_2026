# Infrastructure Architecture Design

Created: 2026-07-03 (Infrastructure Foundation Planning session)

Architecture design only. No production code yet.

---

## Phase J — Authentication & Authorization

### Core Types

```typescript
// Auth context — passed to all new module service functions as first param
interface AuthContext {
  userId:      string
  username:    string
  email:       string
  roles:       Role[]
  permissions: Permission[]
  department:  string          // DepartmentId
  delegation?: DelegationGrant[]
  sessionId:   string
  issuedAt:    string          // ISO
  expiresAt:   string          // ISO
}

interface Role {
  id:          string
  name:        RoleCode        // string union
  permissions: Permission[]
  department?: string          // scoped = department-level role only
}

// resource: 'package' | 'contract' | 'payment' | 'supplier' | etc.
// action:   'create' | 'read' | 'update' | 'submit' | 'approve' | 'reject' | 'delete'
// scope:    'own' | 'department' | 'all'
interface Permission {
  resource: string
  action:   string
  scope:    'own' | 'department' | 'all'
}

interface DelegationGrant {
  delegationId: string
  fromUserId:   string
  permissions:  Permission[]
  validFrom:    string
  validUntil:   string
  reason:       string
  legalBasis:   LegalBasis     // from shared/financial
  revokedAt?:   string
}

interface ApprovalHierarchy {
  hierarchyId:     string
  level:           ApprovalAuthorityLevel   // from procurement/domain
  userId:          string
  department:      string
  valueThreshold:  bigint                   // Money.amount — authority up to this amount
  packageTypes:    string[]                 // which package kinds this authority covers
  effectiveFrom:   string
  effectiveUntil?: string
}
```

### Token Architecture

```
Access Token  — JWT, 15 min TTL, signed RS256, payload = AuthContext (no sensitive fields)
Refresh Token — opaque, 7 days TTL, stored in DB (TokenRecord), rotated on use
Session Record — DB row, created on login, closed on logout, linked to all tokens issued

TokenRecord {
  tokenId:    string  (UUID, stored as hash, never plaintext)
  userId:     string
  sessionId:  string
  issuedAt:   string
  expiresAt:  string
  revokedAt?: string
  ipAddress:  string
  userAgent:  string
}
```

### IAuthProvider Interface (future SSO / AD)

```typescript
interface IAuthProvider {
  authenticate(credentials: Credentials): Promise<AuthUser>
  refreshSession(refreshToken: string):   Promise<TokenPair>
  revokeSession(sessionId: string):       Promise<void>
  getUserById(userId: string):            Promise<AuthUser | null>
}
// Implementations:
//   LocalAuthProvider     — username/password + bcrypt
//   OidcAuthProvider      — OpenID Connect (SSO hook)
//   LdapAuthProvider      — Active Directory hook
```

### Auth Enforcement Strategy

FROZEN MODULES (Phases A–I): service signatures unchanged.
Auth enforced at the API/adapter layer BEFORE calling service functions.
Pattern: `guard(ctx, 'contract', 'approve') → then call contractService.approve()`

NEW MODULES (Phase N+): accept `AuthContext` as first parameter.
Pattern: `supplierService.register(auth, params, repos)`
Services use `auth.permissions` to scope queries, not raw SQL.

---

## Phase K — Storage & Attachment Service

### Core Types

```typescript
interface Attachment {
  id:              string
  entityType:      string      // 'supplier' | 'tender' | 'contract' | etc.
  entityId:        string
  filename:        string
  originalName:    string
  mimeType:        string
  size:            bigint      // bytes
  hash:            string      // SHA-256 hex
  storageKey:      string      // internal storage path (never exposed externally)
  currentVersion:  number
  scanStatus:      ScanStatus
  scanAt?:         string
  retentionMonths: number
  retentionBasis:  LegalBasis
  uploadedBy:      string      // userId
  uploadedAt:      string
  deletedAt?:      string      // soft delete
}

interface AttachmentVersion {
  versionId:   string
  attachmentId: string
  version:     number
  hash:        string
  storageKey:  string
  size:        bigint
  uploadedBy:  string
  uploadedAt:  string
}

type ScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED' | 'SCAN_ERROR' | 'SKIPPED'

interface RetentionPolicy {
  months:       number
  autoDelete:   boolean
  legalBasis:   LegalBasis
}
```

### Storage Adapter Interface

```typescript
interface IStorageAdapter {
  store(key: string, content: Buffer, meta: StorageMeta): Promise<void>
  retrieve(key: string): Promise<Buffer>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  generateKey(entityType: string, filename: string): string
}
// Implementations:
//   LocalFileStorageAdapter  — fs.writeFile, for dev/test
//   S3StorageAdapter         — AWS S3 / MinIO
//   AzureBlobAdapter         — Azure Blob Storage
```

### Virus Scan Adapter

```typescript
interface IVirusScanAdapter {
  scan(content: Buffer): Promise<ScanResult>
}
interface ScanResult { clean: boolean; threat?: string; engine: string }
// Implementations:
//   PassthroughScanAdapter  — always CLEAN (dev/test)
//   ClamAvScanAdapter       — ClamAV socket/REST
//   CloudScanAdapter        — cloud AV API stub
```

### Key Behaviors

- Upload flow: receive → validate MIME → compute SHA-256 → store → queue scan → record metadata
- Version: uploading to existing attachmentId creates a new AttachmentVersion; storageKey changes; metadata updated
- Soft delete: `deletedAt` set; physical deletion deferred until retention period expires
- Retention: hard-coded minimum = 5 years (Luật lưu trữ); legal basis stored per attachment

---

## Phase L — Notification Service

### Core Types

```typescript
type NotificationChannel = 'EMAIL' | 'SMS' | 'INTERNAL' | 'PUSH'
type NotificationStatus  = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED'

interface Notification {
  id:           string
  channel:      NotificationChannel
  recipientId:  string           // userId (for INTERNAL/PUSH) or address (EMAIL/SMS)
  templateId:   string
  params:       Record<string, string>
  priority:     'HIGH' | 'NORMAL' | 'LOW'
  status:       NotificationStatus
  attempts:     number
  maxAttempts:  number
  nextRetryAt?: string
  sentAt?:      string
  error?:       string
  createdAt:    string
  scheduledFor?: string          // null = send immediately
}

interface NotificationTemplate {
  templateId:   string
  channel:      NotificationChannel
  subject?:     string           // EMAIL only
  bodyTemplate: string           // Handlebars/mustache format
  requiredParams: string[]
}
```

### Channel Interface

```typescript
interface INotificationChannel {
  channel:     NotificationChannel
  isAvailable(): boolean
  send(notification: Notification, template: NotificationTemplate): Promise<SendResult>
}
interface SendResult { success: boolean; externalId?: string; error?: string }
// Implementations:
//   SmtpEmailChannel    — nodemailer, configurable SMTP
//   SmsChannel          — pluggable (Twilio, Viettel stub)
//   InternalChannel     — writes to DB for in-app display
//   WebPushChannel      — Web Push API / Firebase stub
```

### Retry Queue

```
RetryPolicy: { maxAttempts: 5, initialDelayMs: 30_000, backoffMultiplier: 2 }
→ attempt 1: immediate
→ attempt 2: 30 s
→ attempt 3: 60 s
→ attempt 4: 120 s
→ attempt 5: 240 s (4 min)
→ after 5 failures: status = FAILED, alert ops
```

### Domain Event → Notification Mapping

Notifications for frozen modules are triggered by the integration/orchestration layer:

```
approval request created → notify approver (INTERNAL + EMAIL)
contract signed          → notify contractor (EMAIL)
tender published         → notify registered suppliers (EMAIL + INTERNAL)
bid evaluation complete  → notify all bidders (EMAIL + INTERNAL)
payment approved         → notify treasury (EMAIL)
```

New modules (Phase N+) emit `DomainEvent` objects; `NotificationTrigger` subscribes and dispatches.

---

## Phase M — Production Prisma Layer

### Strategy

All 12 existing business modules have:
- Repository interfaces (`I*Repository`) — the contract
- Memory implementations (`memory*.ts`) — used in tests
- Prisma stubs (`prisma*.ts`) — throw until DB is wired

Phase M fills in all 24 Prisma stub implementations. No new entity types. No service logic changes. Pure infrastructure wiring.

### Schema Scope

`prisma/schema.prisma` must grow from current (Legal only) to cover:

| Module | Models to add |
|--------|--------------|
| MasterData | ApprovalAuthority, PackageType, ProcurementMethod, Department, ... |
| Workflow | WorkflowInstance, WorkflowHistory |
| Package | ProcurementPackage |
| Planning | ProcurementPlan, ProcurementRequest |
| Approval | ApprovalRequest, ApprovalDecision, ApprovalHistory |
| Contract | Contract, ContractHistory |
| Acceptance | AcceptanceRequest, AcceptanceSession, AcceptanceHistory |
| SharedFinancial | BudgetAllocation, FundingCommitment, PaymentSchedule |
| Payment | PaymentRequest, PaymentHistory, TreasurySubmission |
| Auth (new) | User, Role, Permission, DelegationGrant, Session, Token |
| Storage (new) | Attachment, AttachmentVersion |
| Notification (new) | Notification, NotificationTemplate |

### Critical Fixes in Phase M

- TD-05: All monetary fields `Float` → `Decimal` (fixes bigint precision for Money)
- Add compound indexes: `(status, department)`, `(contractId, status)`, `(createdAt DESC)` per module
- Connection pool: `DATABASE_POOL_SIZE` env var, default 10
- Migration naming: `YYYYMMDD_NNN_description`
- Backup: pg_dump documented in ops runbook; point-in-time recovery via WAL archiving (documented, not implemented)

---

## Auth Enforcement Model (across all phases)

```
HTTP Request
     │
     ▼
JWT Middleware (validates token, builds AuthContext)
     │
     ▼
Permission Guard (checks resource/action/scope against AuthContext.permissions)
     │
     ▼
[FROZEN MODULE] Service function (no AuthContext param — signature unchanged)
OR
[NEW MODULE Ph N+] Service function (AuthContext first param — scopes queries)
```

No frozen module is modified. Auth is structural at the boundary.
