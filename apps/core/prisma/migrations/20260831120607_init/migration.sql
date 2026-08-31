-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('editorial', 'technical', 'commercial', 'management', 'other');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('bug', 'improvement', 'idea');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('new', 'triaged', 'queued', 'in_progress', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "TriageOutcome" AS ENUM ('convert', 'merge', 'reject', 'need_data');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('bot', 'fast_track', 'manual');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('member', 'exception', 'revoked');

-- CreateEnum
CREATE TYPE "DerivedDimension" AS ENUM ('confidence', 'severity', 'impact');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('on_track', 'at_risk', 'done');

-- CreateEnum
CREATE TYPE "DecisionForum" AS ENUM ('council', 'fast_track');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('execute', 'park', 'reject');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('worked', 'did_not_work', 'inconclusive');

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "originalType" "RequestType" NOT NULL,
    "submitterId" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "rawAnswers" JSONB NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "serviceRef" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "triageOutcome" "TriageOutcome",
    "mergedIntoId" TEXT,
    "promotedRef" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "responseDueAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "source" "RequestSource" NOT NULL DEFAULT 'bot',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submitter" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "accessStatus" "AccessStatus" NOT NULL DEFAULT 'member',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Submitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "TriageOutcome" NOT NULL,
    "body" TEXT NOT NULL,
    "rejectUnderstood" TEXT,
    "rejectWhyNot" TEXT,
    "rejectWhenYes" TEXT,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "handedToEdgeAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dimension" "DerivedDimension" NOT NULL,
    "mapping" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededBy" TEXT,

    CONSTRAINT "ExtractionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DerivedValue" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "dimension" "DerivedDimension" NOT NULL,
    "value" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "derivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overriddenBy" TEXT,

    CONSTRAINT "DerivedValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "estimateDays" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isFastTrack" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'on_track',
    "dependsOnQueueItems" TEXT[],
    "riskReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouncilSession" (
    "id" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "cardsPresented" TEXT[],
    "snapshotPath" TEXT,

    CONSTRAINT "CouncilSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "forum" "DecisionForum" NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "successMetric" TEXT,
    "reviewDate" TIMESTAMP(3),
    "displaced" JSONB NOT NULL DEFAULT '[]',
    "incomplete" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT NOT NULL,
    "reviewOutcome" "ReviewOutcome",
    "reviewedAt" TIMESTAMP(3),
    "sessionId" TEXT,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPeriod" (
    "id" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "submittedCount" INTEGER NOT NULL,
    "evaluatedCount" INTEGER NOT NULL,
    "executedCount" INTEGER NOT NULL,
    "avgResponseDays" DOUBLE PRECISION NOT NULL,
    "slaBreaches" INTEGER NOT NULL,
    "unitDiversity" INTEGER NOT NULL,
    "fastTrackShare" DOUBLE PRECISION NOT NULL,
    "successRateByForum" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Request_status_responseDueAt_idx" ON "Request"("status", "responseDueAt");

-- CreateIndex
CREATE INDEX "Request_submittedAt_idx" ON "Request"("submittedAt");

-- CreateIndex
CREATE INDEX "Request_serviceRef_idx" ON "Request"("serviceRef");

-- CreateIndex
CREATE UNIQUE INDEX "Submitter_chatId_key" ON "Submitter"("chatId");

-- CreateIndex
CREATE INDEX "Response_requestId_idx" ON "Response"("requestId");

-- CreateIndex
CREATE INDEX "Response_deliveredAt_idx" ON "Response"("deliveredAt");

-- CreateIndex
CREATE INDEX "ExtractionRule_dimension_effectiveFrom_idx" ON "ExtractionRule"("dimension", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionRule_dimension_version_key" ON "ExtractionRule"("dimension", "version");

-- CreateIndex
CREATE INDEX "DerivedValue_requestId_idx" ON "DerivedValue"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedValue_requestId_dimension_key" ON "DerivedValue"("requestId", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_requestId_key" ON "QueueItem"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_position_key" ON "QueueItem"("position");

-- CreateIndex
CREATE INDEX "QueueItem_position_idx" ON "QueueItem"("position");

-- CreateIndex
CREATE INDEX "Decision_requestId_idx" ON "Decision"("requestId");

-- CreateIndex
CREATE INDEX "Decision_forum_decidedAt_idx" ON "Decision"("forum", "decidedAt");

-- CreateIndex
CREATE INDEX "Decision_incomplete_decidedAt_idx" ON "Decision"("incomplete", "decidedAt");

-- CreateIndex
CREATE INDEX "Decision_reviewDate_idx" ON "Decision"("reviewDate");

-- CreateIndex
CREATE INDEX "AuditEntry_entity_entityId_idx" ON "AuditEntry"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEntry_at_idx" ON "AuditEntry"("at");

-- CreateIndex
CREATE UNIQUE INDEX "ReportPeriod_from_to_key" ON "ReportPeriod"("from", "to");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedValue" ADD CONSTRAINT "DerivedValue_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CouncilSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
