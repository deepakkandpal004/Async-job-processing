-- CreateTable
CREATE TABLE "JobEffect" (
    "idempotentKey" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEffect_pkey" PRIMARY KEY ("idempotentKey")
);

-- CreateIndex
CREATE INDEX "JobEffect_jobId_idx" ON "JobEffect"("jobId");
