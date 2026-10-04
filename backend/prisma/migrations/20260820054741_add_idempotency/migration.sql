/*
  Warnings:

  - A unique constraint covering the columns `[idempotentKey]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "idempotentKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotentKey_key" ON "Job"("idempotentKey");
