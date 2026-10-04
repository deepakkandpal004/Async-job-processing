/*
  Warnings:

  - Made the column `idempotentKey` on table `Job` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "idempotentKey" SET NOT NULL;
