CREATE TABLE `unlinked_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'voice',
	`personNameHint` varchar(255),
	`captureId` int,
	`linkedPersonId` int,
	`linkedAt` timestamp,
	`status` varchar(32) NOT NULL DEFAULT 'unlinked',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `unlinked_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `priority` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `progress` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `jobs` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `maxRetries` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `dedupeKey` varchar(255);--> statement-breakpoint
ALTER TABLE `jobs` ADD `workerId` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `entityType` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `entityId` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `runAfter` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `attemptStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `cancelledAt` timestamp;--> statement-breakpoint
CREATE INDEX `idx_unlinked_notes_userId` ON `unlinked_notes` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_unlinked_notes_status` ON `unlinked_notes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jobs_priority` ON `jobs` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_jobs_dedupeKey` ON `jobs` (`dedupeKey`);--> statement-breakpoint
CREATE INDEX `idx_jobs_runAfter` ON `jobs` (`runAfter`);