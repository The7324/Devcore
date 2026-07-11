CREATE TABLE `active_connections` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`activated_at` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connection_group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`connection_id` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `connection_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connection_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connection_groups_name_unique` ON `connection_groups` (`name`);--> statement-breakpoint
CREATE TABLE `connection_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`timestamp` text NOT NULL,
	`success` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connection_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`encrypted_credentials` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`health` text DEFAULT 'unknown' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_validated_at` text,
	`last_used_at` text,
	`owner_id` integer NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#6b7280' NOT NULL,
	`icon` text DEFAULT '🔌' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `migrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `migrations_name_unique` ON `migrations` (`name`);