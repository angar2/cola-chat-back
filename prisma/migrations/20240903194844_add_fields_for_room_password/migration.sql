-- AlterTable
ALTER TABLE `Room` ADD COLUMN `isPassword` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `password` VARCHAR(191) NULL;
