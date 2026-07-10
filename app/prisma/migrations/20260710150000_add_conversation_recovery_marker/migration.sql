-- CreateEnum
CREATE TYPE "RecoveryMarkerStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "conversation_recovery_markers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "question" TEXT NOT NULL,
    "asOfDate" TEXT,
    "status" "RecoveryMarkerStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_recovery_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_recovery_markers_status_idx" ON "conversation_recovery_markers"("status");

-- CreateIndex
CREATE INDEX "conversation_recovery_markers_sessionId_idx" ON "conversation_recovery_markers"("sessionId");

