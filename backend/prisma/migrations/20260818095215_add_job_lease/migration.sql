-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "leaseUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Job_status_leaseUntil_idx" ON "Job"("status", "leaseUntil");
