-- CreateEnum
CREATE TYPE "PrincipalKind" AS ENUM ('ANONYMOUS', 'USER', 'SERVICE', 'SYSTEM');

-- CreateTable
CREATE TABLE "session_identity_bindings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "principalKind" "PrincipalKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_identity_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_identity_bindings_sessionId_idx" ON "session_identity_bindings"("sessionId");

