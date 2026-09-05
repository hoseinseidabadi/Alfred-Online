-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "originalType" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "rawAnswers" JSONB NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT [],
    "serviceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "triageOutcome" TEXT,
    "mergedIntoId" TEXT,
    "promotedRef" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL,
    "responseDueAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "closedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'bot',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submitter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "accessStatus" TEXT NOT NULL DEFAULT 'member',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rejectUnderstood" TEXT,
    "rejectWhyNot" TEXT,
    "rejectWhenYes" TEXT,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" DATETIME NOT NULL,
    "handedToEdgeAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Response_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "dimension" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededBy" TEXT
);

-- CreateTable
CREATE TABLE "DerivedValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "derivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overriddenBy" TEXT,
    CONSTRAINT "DerivedValue_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "estimateDays" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "isFastTrack" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QueueItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'on_track',
    "dependsOnQueueItems" TEXT NOT NULL DEFAULT '[]',
    "riskReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CouncilSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "heldAt" DATETIME NOT NULL,
    "cardsPresented" TEXT NOT NULL DEFAULT '[]',
    "snapshotPath" TEXT
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "forum" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "successMetric" TEXT,
    "reviewDate" DATETIME,
    "displaced" JSONB NOT NULL DEFAULT [],
    "incomplete" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT NOT NULL,
    "reviewOutcome" TEXT,
    "reviewedAt" DATETIME,
    "sessionId" TEXT,
    CONSTRAINT "Decision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Decision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CouncilSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "actor" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReportPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from" DATETIME NOT NULL,
    "to" DATETIME NOT NULL,
    "submittedCount" INTEGER NOT NULL,
    "evaluatedCount" INTEGER NOT NULL,
    "executedCount" INTEGER NOT NULL,
    "avgResponseDays" REAL NOT NULL,
    "slaBreaches" INTEGER NOT NULL,
    "unitDiversity" INTEGER NOT NULL,
    "fastTrackShare" REAL NOT NULL,
    "successRateByForum" JSONB NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
