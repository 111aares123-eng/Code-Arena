CREATE TYPE "public"."problem_difficulty" AS ENUM('Easy', 'Medium', 'Hard');--> statement-breakpoint
CREATE TYPE "public"."problem_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "problems" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"difficulty" "problem_difficulty" DEFAULT 'Easy' NOT NULL,
	"category" varchar(100) DEFAULT 'Algorithms' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supported_languages" jsonb DEFAULT '["Python","C++"]'::jsonb NOT NULL,
	"starter_code" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb,
	"acceptance_rate" varchar(32) DEFAULT '0.0%',
	"total_submissions" integer DEFAULT 0 NOT NULL,
	"status" "problem_status" DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problems_slug_unique" UNIQUE("slug")
);
