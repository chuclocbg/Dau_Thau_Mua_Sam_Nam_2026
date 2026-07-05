-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('LAW', 'DECREE', 'CIRCULAR', 'DECISION', 'RESOLUTION', 'GUIDELINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUPERSEDED', 'DRAFT', 'REPEALED');

-- CreateEnum
CREATE TYPE "AmendmentType" AS ENUM ('REPLACE', 'MODIFY', 'ADD', 'REPEAL', 'SUSPEND', 'EXTEND', 'IMPLEMENT');

-- CreateEnum
CREATE TYPE "FundSourceType" AS ENUM ('STATE', 'ODA', 'PPP', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CANCELLED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'EVALUATOR', 'APPROVER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "AnnualPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('OPEN', 'CONSOLIDATED', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('PLAN_APPROVAL', 'PACKAGE_APPROVAL', 'BIDDING_DOCUMENT_APPROVAL', 'EVALUATION_RESULT_APPROVAL', 'CONTRACT_APPROVAL', 'PAYMENT_APPROVAL');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ApprovalActionEnum" AS ENUM ('CREATED', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'WITHDRAWN', 'COMMENTED', 'ATTACHMENT_ADDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDocumentType" AS ENUM ('SUPPORTING_DOCUMENT', 'LEGAL_REFERENCE', 'TECHNICAL_SPEC', 'COST_ESTIMATE', 'AUTHORITY_CONFIRMATION');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('PLAN', 'PACKAGE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SIGNED', 'EFFECTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('LUMP_SUM', 'UNIT_PRICE', 'TIME_BASED', 'MIXED');

-- CreateEnum
CREATE TYPE "ContractAmendmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractMilestoneStatus" AS ENUM ('PENDING', 'REACHED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuaranteeType" AS ENUM ('PERFORMANCE', 'ADVANCE_PAYMENT', 'WARRANTY');

-- CreateEnum
CREATE TYPE "GuaranteeStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RETURNED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "ContractActionEnum" AS ENUM ('CREATED', 'SIGNED', 'ACTIVATED', 'SUSPENDED', 'RESUMED', 'COMPLETED', 'TERMINATED', 'AMENDMENT_CREATED', 'AMENDMENT_APPROVED', 'AMENDMENT_REJECTED', 'MILESTONE_REACHED', 'MILESTONE_DELAYED', 'GUARANTEE_ADDED', 'GUARANTEE_RETURNED', 'GUARANTEE_FORFEITED', 'NOTE_ADDED', 'ATTACHMENT_ADDED');

-- CreateEnum
CREATE TYPE "ContractDocumentType" AS ENUM ('CONTRACT_DOCUMENT', 'AMENDMENT_DOCUMENT', 'PERFORMANCE_SECURITY', 'ADVANCE_PAYMENT_GUARANTEE', 'WARRANTY_DOCUMENT', 'PAYMENT_RECORD', 'HANDOVER_RECORD', 'INSPECTION_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('DRAFT', 'COMMITTEE_FORMED', 'IN_PROGRESS', 'PARTIAL_ACCEPTED', 'COMPLETED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AcceptanceType" AS ENUM ('PARTIAL', 'FINAL', 'WARRANTY');

-- CreateEnum
CREATE TYPE "AcceptanceSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcceptanceItemStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AcceptanceMinuteStatus" AS ENUM ('DRAFT', 'SIGNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AcceptanceMemberRole" AS ENUM ('CHAIRMAN', 'SECRETARY', 'MEMBER', 'EXPERT');

-- CreateEnum
CREATE TYPE "AcceptanceAction" AS ENUM ('CREATED', 'WITHDRAWN', 'COMMITTEE_FORMED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'SESSION_CREATED', 'SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_CANCELLED', 'ITEM_RECORDED', 'MINUTE_CREATED', 'MINUTE_SIGNED', 'COMPLETED', 'REJECTED', 'LEGAL_BASIS_ADDED');

-- CreateEnum
CREATE TYPE "AcceptanceDocType" AS ENUM ('CONTRACT_DOCUMENT', 'TECHNICAL_REPORT', 'TEST_RESULT', 'PHOTO_EVIDENCE', 'INSPECTION_CERTIFICATE', 'WARRANTY_DOCUMENT', 'MINUTE_ATTACHMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AuthPermissionScope" AS ENUM ('OWN', 'DEPARTMENT', 'ALL');

-- CreateEnum
CREATE TYPE "AuthPolicyEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "StorageDocumentType" AS ENUM ('DECISION', 'TENDER_DOCUMENTS', 'BID_SUBMISSION', 'EVALUATION_REPORT', 'CONTRACT', 'ACCEPTANCE', 'INVOICE', 'PAYMENT_EVIDENCE', 'AUDIT_EVIDENCE', 'LEGAL_DOCUMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "StorageUploadStatus" AS ENUM ('INITIATED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "NotifChannelType" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotifPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotifDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED', 'CANCELLED', 'RETRIED');

-- CreateEnum
CREATE TYPE "NotifMode" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'DELAYED', 'RECURRING', 'BULK', 'EVENT_DRIVEN');

-- CreateEnum
CREATE TYPE "NotifBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentCurrency" AS ENUM ('VND', 'USD', 'EUR', 'JPY', 'AUD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED_TREASURY', 'TREASURY_APPROVED', 'TREASURY_REJECTED', 'PAID', 'SUSPENDED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'PROGRESS', 'FINAL', 'RETENTION_RELEASE', 'WARRANTY_RELEASE', 'GUARANTEE_RELEASE');

-- CreateEnum
CREATE TYPE "TreasuryStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentAction" AS ENUM ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'TREASURY_SUBMITTED', 'TREASURY_APPROVED', 'TREASURY_REJECTED', 'PAID', 'SUSPENDED', 'RESUMED', 'CANCELLED', 'NOTE_ADDED', 'ATTACHMENT_ADDED');

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DocType" NOT NULL,
    "issuer" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "expiredDate" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersededBy" TEXT,
    "replaces" TEXT[],
    "source" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fullText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionDate" TEXT NOT NULL,
    "changeNote" TEXT NOT NULL,
    "amendedById" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_articles" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chapterRef" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "legal_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_clauses" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "legal_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_points" (
    "id" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "legal_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_appendices" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "legal_appendices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_citations" (
    "id" TEXT NOT NULL,
    "citingDocId" TEXT NOT NULL,
    "citedDocId" TEXT NOT NULL,
    "citingArticle" TEXT,
    "citedArticle" TEXT,
    "citedClause" TEXT,
    "citedPoint" TEXT,
    "formatted" TEXT NOT NULL,
    "isDirect" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "legal_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_keywords" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "sourceArticle" TEXT,
    "synonyms" TEXT[],

    CONSTRAINT "legal_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_domains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "legal_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_domains" (
    "documentId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,

    CONSTRAINT "legal_document_domains_pkey" PRIMARY KEY ("documentId","domainId")
);

-- CreateTable
CREATE TABLE "legal_amendments" (
    "id" TEXT NOT NULL,
    "baseDocumentId" TEXT NOT NULL,
    "amendingDocumentId" TEXT NOT NULL,
    "amendmentType" "AmendmentType" NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "affectedArticles" TEXT[],
    "summary" TEXT NOT NULL,

    CONSTRAINT "legal_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_effective_periods" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "endReason" TEXT,

    CONSTRAINT "legal_effective_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_employees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roles" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_approval_authorities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "maxValue" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_approval_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_vendors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxCode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactEmail" TEXT,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_fund_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FundSourceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_fund_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_budget_years" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "totalBudget" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_budget_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_package_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_package_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_procurement_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "applicablePackageTypeCodes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_procurement_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_procurement_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageTypeCode" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_procurement_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_document_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "applicableStates" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "md_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_packages" (
    "id" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "packageType" TEXT NOT NULL,
    "procurementMethod" TEXT NOT NULL,
    "procurementCategory" TEXT,
    "estimatedValue" DECIMAL(18,2) NOT NULL,
    "approvedValue" DECIMAL(18,2),
    "fundSource" TEXT NOT NULL,
    "budgetYear" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "workflowId" TEXT,
    "status" "PackageStatus" NOT NULL DEFAULT 'DRAFT',
    "schedule" JSONB NOT NULL DEFAULT '{}',
    "funding" JSONB NOT NULL DEFAULT '[]',
    "participants" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "estimatedUnitPrice" DECIMAL(18,2) NOT NULL,
    "estimatedTotal" DECIMAL(18,2) NOT NULL,
    "category" TEXT NOT NULL,
    "technicalSpecification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_budgets" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "budgetSource" TEXT NOT NULL,
    "approvedAmount" DECIMAL(18,2) NOT NULL,
    "committedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "spentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_attachments" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "documentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_history" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "PackageStatus",
    "toStatus" "PackageStatus",
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "needDescription" TEXT NOT NULL,
    "needs" JSONB NOT NULL DEFAULT '[]',
    "estimatedCost" DECIMAL(18,2) NOT NULL,
    "fundingSource" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "expectedTimeline" TEXT NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "legalBasis" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "planId" TEXT,
    "mergedFromIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "splitFromId" TEXT,
    "performedBy" TEXT,
    "approvedBy" TEXT,
    "approvalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_plans" (
    "id" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "responsibleDepartment" TEXT NOT NULL,
    "estimatedTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedTotal" DECIMAL(18,2),
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalHistory" JSONB NOT NULL DEFAULT '[]',
    "requestIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedPackageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_demands" (
    "id" TEXT NOT NULL,
    "demandCode" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "requestIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consolidatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "DemandStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_allocations" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fundSourceCode" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(18,2) NOT NULL,
    "committedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(18,2) NOT NULL,
    "budgetYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funding_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_proposals" (
    "id" TEXT NOT NULL,
    "proposalCode" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "requestIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposedPackageType" TEXT NOT NULL,
    "proposedMethod" TEXT NOT NULL,
    "estimatedValue" DECIMAL(18,2) NOT NULL,
    "fundSource" TEXT NOT NULL,
    "justification" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "convertedPackageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_procurement_plans" (
    "id" TEXT NOT NULL,
    "annualPlanCode" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "totalBudget" DECIMAL(18,2) NOT NULL,
    "approvedBudget" DECIMAL(18,2),
    "planIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AnnualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_procurement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "approvalType" "ApprovalType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department" TEXT NOT NULL,
    "estimatedValue" BIGINT NOT NULL,
    "assignedAuthorityCode" TEXT,
    "assignedAuthorityName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "decisionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legalBasis" TEXT NOT NULL,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revisionRequired" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisionReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" "ApprovalActionEnum" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromStatus" "ApprovalStatus",
    "toStatus" "ApprovalStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_comments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorCode" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "documentType" "ApprovalDocumentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "packageId" TEXT NOT NULL,
    "approvalId" TEXT,
    "workflowId" TEXT,
    "winnerCode" TEXT NOT NULL,
    "winnerName" TEXT NOT NULL,
    "contractValue" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "signedDate" TEXT,
    "effectiveDate" TEXT,
    "expiryDate" TEXT,
    "performanceSecurityAmount" DECIMAL(18,2),
    "performanceSecurityPercent" DECIMAL(5,2),
    "advancePaymentAmount" DECIMAL(18,2),
    "advancePaymentPercent" DECIMAL(5,2),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_amendments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amendmentNumber" INTEGER NOT NULL,
    "amendmentCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedFields" TEXT[],
    "valueChange" DECIMAL(18,2),
    "timeExtensionDays" INTEGER,
    "status" "ContractAmendmentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_milestones" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedDate" TEXT NOT NULL,
    "plannedValue" DECIMAL(18,2) NOT NULL,
    "actualDate" TEXT,
    "actualValue" DECIMAL(18,2),
    "status" "ContractMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_guarantees" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "guaranteeType" "GuaranteeType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "percent" DECIMAL(5,2),
    "issuerCode" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "guaranteeNumber" TEXT NOT NULL,
    "issuedDate" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "returnedDate" TEXT,
    "status" "GuaranteeStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_history" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "action" "ContractActionEnum" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TEXT NOT NULL,
    "fromStatus" "ContractStatus",
    "toStatus" "ContractStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_attachments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "documentType" "ContractDocumentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "acceptanceType" "AcceptanceType" NOT NULL,
    "contractId" TEXT NOT NULL,
    "packageId" TEXT,
    "workflowId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT,
    "legalBasis" TEXT[],
    "status" "AcceptanceStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_committees" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "committeeCode" TEXT NOT NULL,
    "establishedBy" TEXT NOT NULL,
    "establishedAt" TEXT NOT NULL,
    "decisionReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_members" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "memberCode" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "role" "AcceptanceMemberRole" NOT NULL,
    "organization" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_sessions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "sessionType" "AcceptanceType" NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "actualDate" TEXT,
    "location" TEXT,
    "chairmanCode" TEXT,
    "status" "AcceptanceSessionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contractedQuantity" DECIMAL(12,3) NOT NULL,
    "acceptedQuantity" DECIMAL(12,3) NOT NULL,
    "rejectedQuantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT,
    "rejectReason" TEXT,
    "verifiedBy" TEXT,
    "status" "AcceptanceItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_minutes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "minuteCode" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "status" "AcceptanceMinuteStatus" NOT NULL DEFAULT 'DRAFT',
    "signedBy" TEXT,
    "signedAt" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" "AcceptanceAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TEXT NOT NULL,
    "fromStatus" "AcceptanceStatus",
    "toStatus" "AcceptanceStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "documentType" "AcceptanceDocType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "roleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "passwordHash" TEXT,
    "externalId" TEXT,
    "externalProvider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentRoleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" "AuthPermissionScope" NOT NULL,
    "conditions" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_delegation_grants" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "permissionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" "AuthPermissionScope" NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "legalBasis" JSONB NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_delegation_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_permission_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "legalBasis" JSONB,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_approval_hierarchies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "authorityLevel" INTEGER NOT NULL,
    "valueThreshold" BIGINT NOT NULL,
    "packageTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "legalBasis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_approval_hierarchies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "effect" "AuthPolicyEffect" NOT NULL,
    "conditions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legalBasis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_audit_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "sessionId" TEXT,
    "resource" TEXT,
    "action" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "delegationId" TEXT,
    "policyId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_attachment_references" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "documentType" "StorageDocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_attachment_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_upload_sessions" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "expectedSizeBytes" BIGINT,
    "expectedChecksum" TEXT,
    "checksumAlgorithm" TEXT NOT NULL,
    "totalChunks" INTEGER,
    "uploadedChunks" INTEGER NOT NULL DEFAULT 0,
    "status" "StorageUploadStatus" NOT NULL DEFAULT 'INITIATED',
    "documentType" "StorageDocumentType" NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_retention_policies" (
    "id" TEXT NOT NULL,
    "documentType" "StorageDocumentType" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "legalBasis" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_legal_holds" (
    "id" TEXT NOT NULL,
    "objectId" TEXT,
    "moduleType" TEXT,
    "moduleId" TEXT,
    "reason" TEXT NOT NULL,
    "legalBasis" JSONB NOT NULL,
    "placedBy" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_audit_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "objectKey" TEXT,
    "objectId" TEXT,
    "attachmentId" TEXT,
    "uploadSessionId" TEXT,
    "userId" TEXT NOT NULL,
    "moduleType" TEXT,
    "moduleId" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "sizeBytes" BIGINT,
    "checksum" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_notifications" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "NotifPriority" NOT NULL DEFAULT 'NORMAL',
    "mode" "NotifMode" NOT NULL DEFAULT 'IMMEDIATE',
    "channels" "NotifChannelType"[],
    "variables" JSONB NOT NULL DEFAULT '{}',
    "moduleType" TEXT,
    "moduleId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "recurrence" JSONB,
    "batchId" TEXT,
    "ruleId" TEXT,
    "status" "NotifDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "channelType" "NotifChannelType" NOT NULL,
    "status" "NotifDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "channelType" "NotifChannelType" NOT NULL,
    "providerType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "requiredVariables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" "NotifChannelType"[],
    "legalBasis" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channelType" "NotifChannelType" NOT NULL,
    "providerType" TEXT NOT NULL,
    "status" "NotifDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "queuedCount" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "NotifBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelType" "NotifChannelType" NOT NULL,
    "isOptedIn" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "channels" "NotifChannelType"[],
    "priority" "NotifPriority" NOT NULL DEFAULT 'NORMAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_audit_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "notificationId" TEXT,
    "recipientId" TEXT,
    "deliveryId" TEXT,
    "batchId" TEXT,
    "ruleId" TEXT,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "contractId" TEXT NOT NULL,
    "packageId" TEXT,
    "acceptanceId" TEXT,
    "workflowId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "department" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" "PaymentCurrency" NOT NULL DEFAULT 'VND',
    "legalBasis" JSONB NOT NULL DEFAULT '[]',
    "resolvedRuleId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" "PaymentCurrency" NOT NULL DEFAULT 'VND',
    "paidAt" TIMESTAMP(3),
    "treasuryRef" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_installments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "installmentCode" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" "PaymentCurrency" NOT NULL DEFAULT 'VND',
    "dueDate" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_submissions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "submissionCode" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "treasuryBranch" TEXT,
    "status" "TreasuryStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" "PaymentAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "fromStatus" "PaymentStatus",
    "toStatus" "PaymentStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_documents" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_symbol_key" ON "legal_documents"("symbol");

-- CreateIndex
CREATE INDEX "legal_documents_status_idx" ON "legal_documents"("status");

-- CreateIndex
CREATE INDEX "legal_documents_type_idx" ON "legal_documents"("type");

-- CreateIndex
CREATE INDEX "legal_documents_effectiveDate_idx" ON "legal_documents"("effectiveDate");

-- CreateIndex
CREATE INDEX "legal_versions_documentId_idx" ON "legal_versions"("documentId");

-- CreateIndex
CREATE INDEX "legal_articles_documentId_number_idx" ON "legal_articles"("documentId", "number");

-- CreateIndex
CREATE INDEX "legal_clauses_articleId_idx" ON "legal_clauses"("articleId");

-- CreateIndex
CREATE INDEX "legal_points_clauseId_idx" ON "legal_points"("clauseId");

-- CreateIndex
CREATE INDEX "legal_appendices_documentId_idx" ON "legal_appendices"("documentId");

-- CreateIndex
CREATE INDEX "legal_citations_citingDocId_idx" ON "legal_citations"("citingDocId");

-- CreateIndex
CREATE INDEX "legal_citations_citedDocId_idx" ON "legal_citations"("citedDocId");

-- CreateIndex
CREATE INDEX "legal_keywords_domain_idx" ON "legal_keywords"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "legal_keywords_term_domain_key" ON "legal_keywords"("term", "domain");

-- CreateIndex
CREATE INDEX "legal_amendments_baseDocumentId_idx" ON "legal_amendments"("baseDocumentId");

-- CreateIndex
CREATE INDEX "legal_effective_periods_documentId_idx" ON "legal_effective_periods"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "md_departments_code_key" ON "md_departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_employees_code_key" ON "md_employees"("code");

-- CreateIndex
CREATE INDEX "md_employees_departmentId_idx" ON "md_employees"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "md_approval_authorities_code_key" ON "md_approval_authorities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_approval_authorities_level_key" ON "md_approval_authorities"("level");

-- CreateIndex
CREATE UNIQUE INDEX "md_vendors_code_key" ON "md_vendors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_fund_sources_code_key" ON "md_fund_sources"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_budget_years_code_key" ON "md_budget_years"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_package_types_code_key" ON "md_package_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_procurement_methods_code_key" ON "md_procurement_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_procurement_categories_code_key" ON "md_procurement_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_document_templates_code_key" ON "md_document_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_packages_packageCode_key" ON "procurement_packages"("packageCode");

-- CreateIndex
CREATE INDEX "procurement_packages_status_idx" ON "procurement_packages"("status");

-- CreateIndex
CREATE INDEX "procurement_packages_department_idx" ON "procurement_packages"("department");

-- CreateIndex
CREATE INDEX "procurement_packages_workflowId_idx" ON "procurement_packages"("workflowId");

-- CreateIndex
CREATE INDEX "procurement_packages_createdAt_idx" ON "procurement_packages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_requests_requestCode_key" ON "procurement_requests"("requestCode");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_plans_planNumber_key" ON "procurement_plans"("planNumber");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_demands_demandCode_key" ON "procurement_demands"("demandCode");

-- CreateIndex
CREATE UNIQUE INDEX "package_proposals_proposalCode_key" ON "package_proposals"("proposalCode");

-- CreateIndex
CREATE UNIQUE INDEX "annual_procurement_plans_annualPlanCode_key" ON "annual_procurement_plans"("annualPlanCode");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_requestCode_key" ON "approval_requests"("requestCode");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_department_idx" ON "approval_requests"("department");

-- CreateIndex
CREATE INDEX "approval_requests_subjectId_idx" ON "approval_requests"("subjectId");

-- CreateIndex
CREATE INDEX "approval_requests_approvalType_idx" ON "approval_requests"("approvalType");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_requestId_key" ON "approval_decisions"("requestId");

-- CreateIndex
CREATE INDEX "approval_decisions_decidedBy_idx" ON "approval_decisions"("decidedBy");

-- CreateIndex
CREATE INDEX "approval_history_requestId_performedAt_idx" ON "approval_history"("requestId", "performedAt");

-- CreateIndex
CREATE INDEX "approval_comments_requestId_idx" ON "approval_comments"("requestId");

-- CreateIndex
CREATE INDEX "approval_attachments_requestId_idx" ON "approval_attachments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_packageId_idx" ON "contracts"("packageId");

-- CreateIndex
CREATE INDEX "contracts_winnerCode_idx" ON "contracts"("winnerCode");

-- CreateIndex
CREATE INDEX "contracts_workflowId_idx" ON "contracts"("workflowId");

-- CreateIndex
CREATE INDEX "contracts_effectiveDate_idx" ON "contracts"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_amendmentCode_key" ON "contract_amendments"("amendmentCode");

-- CreateIndex
CREATE INDEX "contract_amendments_contractId_idx" ON "contract_amendments"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_contractId_amendmentNumber_key" ON "contract_amendments"("contractId", "amendmentNumber");

-- CreateIndex
CREATE INDEX "contract_milestones_contractId_status_idx" ON "contract_milestones"("contractId", "status");

-- CreateIndex
CREATE INDEX "contract_guarantees_contractId_status_idx" ON "contract_guarantees"("contractId", "status");

-- CreateIndex
CREATE INDEX "contract_guarantees_contractId_guaranteeType_idx" ON "contract_guarantees"("contractId", "guaranteeType");

-- CreateIndex
CREATE INDEX "contract_history_contractId_performedAt_idx" ON "contract_history"("contractId", "performedAt");

-- CreateIndex
CREATE INDEX "contract_attachments_contractId_idx" ON "contract_attachments"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_requests_requestCode_key" ON "acceptance_requests"("requestCode");

-- CreateIndex
CREATE INDEX "acceptance_requests_contractId_idx" ON "acceptance_requests"("contractId");

-- CreateIndex
CREATE INDEX "acceptance_requests_status_idx" ON "acceptance_requests"("status");

-- CreateIndex
CREATE INDEX "acceptance_requests_workflowId_idx" ON "acceptance_requests"("workflowId");

-- CreateIndex
CREATE INDEX "acceptance_requests_department_idx" ON "acceptance_requests"("department");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_committees_requestId_key" ON "acceptance_committees"("requestId");

-- CreateIndex
CREATE INDEX "acceptance_committees_requestId_idx" ON "acceptance_committees"("requestId");

-- CreateIndex
CREATE INDEX "acceptance_members_committeeId_isActive_idx" ON "acceptance_members"("committeeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_members_committeeId_memberCode_key" ON "acceptance_members"("committeeId", "memberCode");

-- CreateIndex
CREATE INDEX "acceptance_sessions_requestId_status_idx" ON "acceptance_sessions"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_sessions_requestId_sessionNumber_key" ON "acceptance_sessions"("requestId", "sessionNumber");

-- CreateIndex
CREATE INDEX "acceptance_items_requestId_status_idx" ON "acceptance_items"("requestId", "status");

-- CreateIndex
CREATE INDEX "acceptance_items_sessionId_idx" ON "acceptance_items"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_minutes_sessionId_key" ON "acceptance_minutes"("sessionId");

-- CreateIndex
CREATE INDEX "acceptance_minutes_requestId_idx" ON "acceptance_minutes"("requestId");

-- CreateIndex
CREATE INDEX "acceptance_history_requestId_performedAt_idx" ON "acceptance_history"("requestId", "performedAt");

-- CreateIndex
CREATE INDEX "acceptance_attachments_requestId_idx" ON "acceptance_attachments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_username_key" ON "auth_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE INDEX "auth_users_departmentId_idx" ON "auth_users"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_roles_code_key" ON "auth_roles"("code");

-- CreateIndex
CREATE INDEX "auth_permissions_resource_action_idx" ON "auth_permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_delegation_grants_fromUserId_idx" ON "auth_delegation_grants"("fromUserId");

-- CreateIndex
CREATE INDEX "auth_delegation_grants_toUserId_idx" ON "auth_delegation_grants"("toUserId");

-- CreateIndex
CREATE INDEX "auth_permission_grants_userId_idx" ON "auth_permission_grants"("userId");

-- CreateIndex
CREATE INDEX "auth_approval_hierarchies_userId_idx" ON "auth_approval_hierarchies"("userId");

-- CreateIndex
CREATE INDEX "auth_approval_hierarchies_departmentId_idx" ON "auth_approval_hierarchies"("departmentId");

-- CreateIndex
CREATE INDEX "auth_policies_resource_action_idx" ON "auth_policies"("resource", "action");

-- CreateIndex
CREATE INDEX "auth_audit_events_userId_idx" ON "auth_audit_events"("userId");

-- CreateIndex
CREATE INDEX "auth_audit_events_eventType_idx" ON "auth_audit_events"("eventType");

-- CreateIndex
CREATE INDEX "auth_audit_events_occurredAt_idx" ON "auth_audit_events"("occurredAt");

-- CreateIndex
CREATE INDEX "storage_attachment_references_objectId_idx" ON "storage_attachment_references"("objectId");

-- CreateIndex
CREATE INDEX "storage_attachment_references_moduleType_moduleId_idx" ON "storage_attachment_references"("moduleType", "moduleId");

-- CreateIndex
CREATE INDEX "storage_attachment_references_documentType_idx" ON "storage_attachment_references"("documentType");

-- CreateIndex
CREATE INDEX "storage_upload_sessions_status_idx" ON "storage_upload_sessions"("status");

-- CreateIndex
CREATE INDEX "storage_upload_sessions_uploadedBy_idx" ON "storage_upload_sessions"("uploadedBy");

-- CreateIndex
CREATE INDEX "storage_retention_policies_documentType_idx" ON "storage_retention_policies"("documentType");

-- CreateIndex
CREATE INDEX "storage_legal_holds_objectId_idx" ON "storage_legal_holds"("objectId");

-- CreateIndex
CREATE INDEX "storage_legal_holds_moduleType_moduleId_idx" ON "storage_legal_holds"("moduleType", "moduleId");

-- CreateIndex
CREATE INDEX "storage_audit_events_objectId_idx" ON "storage_audit_events"("objectId");

-- CreateIndex
CREATE INDEX "storage_audit_events_userId_idx" ON "storage_audit_events"("userId");

-- CreateIndex
CREATE INDEX "storage_audit_events_eventType_idx" ON "storage_audit_events"("eventType");

-- CreateIndex
CREATE INDEX "storage_audit_events_moduleType_moduleId_idx" ON "storage_audit_events"("moduleType", "moduleId");

-- CreateIndex
CREATE INDEX "notification_notifications_moduleType_moduleId_idx" ON "notification_notifications"("moduleType", "moduleId");

-- CreateIndex
CREATE INDEX "notification_notifications_batchId_idx" ON "notification_notifications"("batchId");

-- CreateIndex
CREATE INDEX "notification_notifications_status_idx" ON "notification_notifications"("status");

-- CreateIndex
CREATE INDEX "notification_notifications_scheduledAt_idx" ON "notification_notifications"("scheduledAt");

-- CreateIndex
CREATE INDEX "notification_notifications_createdAt_idx" ON "notification_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notification_recipients_notificationId_idx" ON "notification_recipients"("notificationId");

-- CreateIndex
CREATE INDEX "notification_channels_channelType_idx" ON "notification_channels"("channelType");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "notification_deliveries_recipientId_idx" ON "notification_deliveries"("recipientId");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_channelType_key" ON "notification_preferences"("userId", "channelType");

-- CreateIndex
CREATE INDEX "notification_rules_eventType_idx" ON "notification_rules"("eventType");

-- CreateIndex
CREATE INDEX "notification_events_eventType_idx" ON "notification_events"("eventType");

-- CreateIndex
CREATE INDEX "notification_events_sourceModule_sourceId_idx" ON "notification_events"("sourceModule", "sourceId");

-- CreateIndex
CREATE INDEX "notification_audit_events_notificationId_idx" ON "notification_audit_events"("notificationId");

-- CreateIndex
CREATE INDEX "notification_audit_events_userId_idx" ON "notification_audit_events"("userId");

-- CreateIndex
CREATE INDEX "notification_audit_events_eventType_idx" ON "notification_audit_events"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_requestCode_key" ON "payment_requests"("requestCode");

-- CreateIndex
CREATE INDEX "payment_requests_contractId_idx" ON "payment_requests"("contractId");

-- CreateIndex
CREATE INDEX "payment_requests_acceptanceId_idx" ON "payment_requests"("acceptanceId");

-- CreateIndex
CREATE INDEX "payment_requests_status_idx" ON "payment_requests"("status");

-- CreateIndex
CREATE INDEX "payment_requests_department_idx" ON "payment_requests"("department");

-- CreateIndex
CREATE INDEX "payment_requests_paymentType_idx" ON "payment_requests"("paymentType");

-- CreateIndex
CREATE INDEX "payment_requests_workflowId_idx" ON "payment_requests"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE INDEX "payments_requestId_idx" ON "payments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_installments_installmentCode_key" ON "payment_installments"("installmentCode");

-- CreateIndex
CREATE INDEX "payment_installments_requestId_idx" ON "payment_installments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_submissions_submissionCode_key" ON "treasury_submissions"("submissionCode");

-- CreateIndex
CREATE INDEX "treasury_submissions_requestId_idx" ON "treasury_submissions"("requestId");

-- CreateIndex
CREATE INDEX "payment_history_requestId_performedAt_idx" ON "payment_history"("requestId", "performedAt");

-- CreateIndex
CREATE INDEX "payment_documents_requestId_idx" ON "payment_documents"("requestId");

-- AddForeignKey
ALTER TABLE "legal_versions" ADD CONSTRAINT "legal_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_articles" ADD CONSTRAINT "legal_articles_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_articles" ADD CONSTRAINT "legal_articles_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "legal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_clauses" ADD CONSTRAINT "legal_clauses_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "legal_articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_points" ADD CONSTRAINT "legal_points_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "legal_clauses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_appendices" ADD CONSTRAINT "legal_appendices_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_appendices" ADD CONSTRAINT "legal_appendices_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "legal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_citations" ADD CONSTRAINT "legal_citations_citingDocId_fkey" FOREIGN KEY ("citingDocId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_citations" ADD CONSTRAINT "legal_citations_citedDocId_fkey" FOREIGN KEY ("citedDocId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_keywords" ADD CONSTRAINT "legal_keywords_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "legal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_domains" ADD CONSTRAINT "legal_document_domains_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_domains" ADD CONSTRAINT "legal_document_domains_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "legal_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_amendments" ADD CONSTRAINT "legal_amendments_baseDocumentId_fkey" FOREIGN KEY ("baseDocumentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_amendments" ADD CONSTRAINT "legal_amendments_amendingDocumentId_fkey" FOREIGN KEY ("amendingDocumentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_effective_periods" ADD CONSTRAINT "legal_effective_periods_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "md_departments" ADD CONSTRAINT "md_departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "md_procurement_categories" ADD CONSTRAINT "md_procurement_categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "md_procurement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "procurement_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_budgets" ADD CONSTRAINT "package_budgets_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "procurement_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_attachments" ADD CONSTRAINT "package_attachments_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "procurement_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_history" ADD CONSTRAINT "package_history_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "procurement_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_planId_fkey" FOREIGN KEY ("planId") REFERENCES "procurement_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_allocations" ADD CONSTRAINT "funding_allocations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "procurement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_proposals" ADD CONSTRAINT "package_proposals_planId_fkey" FOREIGN KEY ("planId") REFERENCES "procurement_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "approval_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_attachments" ADD CONSTRAINT "approval_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_guarantees" ADD CONSTRAINT "contract_guarantees_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_history" ADD CONSTRAINT "contract_history_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_attachments" ADD CONSTRAINT "contract_attachments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_committees" ADD CONSTRAINT "acceptance_committees_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "acceptance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_members" ADD CONSTRAINT "acceptance_members_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "acceptance_committees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_sessions" ADD CONSTRAINT "acceptance_sessions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "acceptance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_items" ADD CONSTRAINT "acceptance_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "acceptance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_items" ADD CONSTRAINT "acceptance_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "acceptance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_minutes" ADD CONSTRAINT "acceptance_minutes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "acceptance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_minutes" ADD CONSTRAINT "acceptance_minutes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "acceptance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_history" ADD CONSTRAINT "acceptance_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "acceptance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_attachments" ADD CONSTRAINT "acceptance_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "acceptance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_delegation_grants" ADD CONSTRAINT "auth_delegation_grants_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_delegation_grants" ADD CONSTRAINT "auth_delegation_grants_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_permission_grants" ADD CONSTRAINT "auth_permission_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_approval_hierarchies" ADD CONSTRAINT "auth_approval_hierarchies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "notification_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_submissions" ADD CONSTRAINT "treasury_submissions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

