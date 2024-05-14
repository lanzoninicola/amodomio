/*
  Warnings:

  - Added the required column `um` to the `ingredients` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "um" VARCHAR NOT NULL;
