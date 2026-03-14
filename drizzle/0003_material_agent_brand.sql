CREATE TABLE `relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personAId` int NOT NULL,
	`personBId` int NOT NULL,
	`relationshipType` varchar(64) NOT NULL,
	`confidence` decimal(3,2) DEFAULT '0.50',
	`source` varchar(32) DEFAULT 'inferred',
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `relationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `opportunityId` int;--> statement-breakpoint
CREATE INDEX `idx_relationships_userId` ON `relationships` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_relationships_personA` ON `relationships` (`personAId`);--> statement-breakpoint
CREATE INDEX `idx_relationships_personB` ON `relationships` (`personBId`);