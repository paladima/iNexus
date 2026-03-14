CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`activityType` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`entityType` varchar(32),
	`entityId` int,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`briefDate` date NOT NULL,
	`briefJson` json NOT NULL,
	`deliveredVia` varchar(16) DEFAULT 'web',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_briefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_daily_briefs_userId_date` UNIQUE(`userId`,`briefDate`)
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personId` int,
	`listId` int,
	`draftType` varchar(64) NOT NULL,
	`tone` varchar(32) DEFAULT 'professional',
	`subject` varchar(500),
	`body` text NOT NULL,
	`status` varchar(32) DEFAULT 'pending_review',
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personId` int NOT NULL,
	`interactionType` varchar(64) NOT NULL,
	`channel` varchar(32),
	`content` text,
	`metadataJson` json,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `list_people` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listId` int NOT NULL,
	`personId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `list_people_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_list_people_unique` UNIQUE(`listId`,`personId`)
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`listType` varchar(32) DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personId` int,
	`title` varchar(500) NOT NULL,
	`opportunityType` varchar(64) NOT NULL,
	`signalSummary` text NOT NULL,
	`whyItMatters` text,
	`recommendedAction` text,
	`score` decimal(5,2),
	`status` varchar(16) DEFAULT 'open',
	`metadataJson` json,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`firstName` varchar(128),
	`lastName` varchar(128),
	`title` varchar(255),
	`company` varchar(255),
	`location` varchar(255),
	`linkedinUrl` text,
	`websiteUrl` text,
	`email` varchar(320),
	`phone` varchar(32),
	`sourceType` varchar(64),
	`sourceUrl` text,
	`aiSummary` text,
	`tags` json DEFAULT ('[]'),
	`status` varchar(32) DEFAULT 'saved',
	`relevanceScore` decimal(5,2),
	`lastInteractionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `people_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personId` int NOT NULL,
	`noteType` varchar(32) DEFAULT 'manual',
	`content` text NOT NULL,
	`createdBy` varchar(32) DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `person_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`queryText` text NOT NULL,
	`filtersJson` json,
	`resultCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchQueryId` int NOT NULL,
	`personSnapshotJson` json NOT NULL,
	`rank` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personId` int,
	`listId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`dueAt` timestamp,
	`priority` varchar(16) DEFAULT 'medium',
	`status` varchar(16) DEFAULT 'open',
	`source` varchar(32) DEFAULT 'manual',
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`primaryGoal` varchar(128),
	`industries` json DEFAULT ('[]'),
	`geographies` json DEFAULT ('[]'),
	`preferences` json DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voice_captures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`audioUrl` text,
	`transcript` text NOT NULL,
	`parsedJson` json,
	`status` varchar(32) DEFAULT 'parsed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voice_captures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(64) DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE `users` ADD `language` varchar(8) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `users` ADD `dailyBriefEnabled` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` ADD `reminderMode` varchar(16) DEFAULT 'smart';--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `idx_activity_log_userId` ON `activity_log` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_drafts_userId` ON `drafts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_drafts_personId` ON `drafts` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_interactions_userId_occurred` ON `interactions` (`userId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `idx_interactions_personId` ON `interactions` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_lists_userId` ON `lists` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_userId_status` ON `opportunities` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_personId` ON `opportunities` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_people_userId` ON `people` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_people_userId_fullName` ON `people` (`userId`,`fullName`);--> statement-breakpoint
CREATE INDEX `idx_person_notes_personId` ON `person_notes` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_search_queries_userId` ON `search_queries` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_search_results_queryId` ON `search_results` (`searchQueryId`);--> statement-breakpoint
CREATE INDEX `idx_tasks_userId_status_due` ON `tasks` (`userId`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `idx_tasks_personId` ON `tasks` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_user_goals_userId` ON `user_goals` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_voice_captures_userId` ON `voice_captures` (`userId`);