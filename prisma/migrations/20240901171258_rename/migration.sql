/*
  Warnings:

  - You are about to drop the column `participantId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the `Participant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RoomParticipant` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `chatterId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_participantId_fkey`;

-- DropForeignKey
ALTER TABLE `RoomParticipant` DROP FOREIGN KEY `RoomParticipant_participantId_fkey`;

-- DropForeignKey
ALTER TABLE `RoomParticipant` DROP FOREIGN KEY `RoomParticipant_roomId_fkey`;

-- AlterTable
ALTER TABLE `Message` DROP COLUMN `participantId`,
    ADD COLUMN `chatterId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `Participant`;

-- DropTable
DROP TABLE `RoomParticipant`;

-- CreateTable
CREATE TABLE `Chatter` (
    `id` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomChatter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `roomId` VARCHAR(191) NOT NULL,
    `chatterId` VARCHAR(191) NOT NULL,

    INDEX `RoomChatter_roomId_idx`(`roomId`),
    INDEX `RoomChatter_chatterId_idx`(`chatterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Message_chatterId_idx` ON `Message`(`chatterId`);

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_chatterId_fkey` FOREIGN KEY (`chatterId`) REFERENCES `Chatter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomChatter` ADD CONSTRAINT `RoomChatter_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomChatter` ADD CONSTRAINT `RoomChatter_chatterId_fkey` FOREIGN KEY (`chatterId`) REFERENCES `Chatter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
