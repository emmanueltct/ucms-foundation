/*
  Warnings:

  - Made the column `period_label` on table `hierarchy_requirement_submissions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "hierarchy_requirement_submissions" ALTER COLUMN "period_label" SET NOT NULL,
ALTER COLUMN "period_label" SET DEFAULT '';
