CREATE TABLE `ai_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`promptModule` varchar(64) NOT NULL,
	`entityType` varchar(32),
	`entityId` int,
	`success` int NOT NULL DEFAULT 1,
	`usedFallback` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobType` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`payload` json DEFAULT ('{}'),
	`result` json,
	`error` text,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ai_audit_userId` ON `ai_audit_log` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_ai_audit_module` ON `ai_audit_log` (`promptModule`);--> statement-breakpoint
CREATE INDEX `idx_jobs_userId_type` ON `jobs` (`userId`,`jobType`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `jobs` (`status`);