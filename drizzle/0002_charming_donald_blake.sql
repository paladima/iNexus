ALTER TABLE `search_queries` ADD `parsedIntentsJson` json;--> statement-breakpoint
ALTER TABLE `search_queries` ADD `queryVariantsJson` json;--> statement-breakpoint
ALTER TABLE `search_queries` ADD `negativeTermsJson` json;--> statement-breakpoint
ALTER TABLE `search_results` ADD `scoringJson` json;--> statement-breakpoint
ALTER TABLE `search_results` ADD `matchReasonsJson` json;