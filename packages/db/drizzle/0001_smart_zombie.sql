CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'ADMIN', 'INSTRUCTOR');--> statement-breakpoint
CREATE TYPE "public"."submission_verdict" AS ENUM('PENDING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'COMPILE_ERROR', 'RUNTIME_ERROR', 'SAMPLE_PASSED', 'SAMPLE_FAILED', 'SERVICE_UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."student_problem_status" AS ENUM('ATTEMPTED', 'SOLVED');--> statement-breakpoint
CREATE TYPE "public"."contest_status" AS ENUM('UPCOMING', 'ACTIVE', 'PAUSED', 'ENDED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(100),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"problem_id" varchar(64) NOT NULL,
	"language" varchar(32) NOT NULL,
	"code" text NOT NULL,
	"verdict" "submission_verdict" DEFAULT 'PENDING' NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"execution_time" varchar(32),
	"memory" integer,
	"error" text,
	"evaluations" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_problem_progress" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"problem_id" varchar(64) NOT NULL,
	"status" "student_problem_status" DEFAULT 'ATTEMPTED' NOT NULL,
	"attempts_count" integer DEFAULT 1 NOT NULL,
	"first_solved_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"best_submission_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_stats" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"solved_count" integer DEFAULT 0 NOT NULL,
	"easy_solved" integer DEFAULT 0 NOT NULL,
	"medium_solved" integer DEFAULT 0 NOT NULL,
	"hard_solved" integer DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"last_active_date" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"badge_icon" varchar(100) DEFAULT 'award' NOT NULL,
	"category" varchar(50) DEFAULT 'GENERAL' NOT NULL,
	"criteria_type" varchar(50) NOT NULL,
	"criteria_threshold" integer DEFAULT 1 NOT NULL,
	"xp_reward" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"achievement_id" varchar(64) NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_participants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contest_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"penalty_minutes" integer DEFAULT 0 NOT NULL,
	"problems_solved" integer DEFAULT 0 NOT NULL,
	"last_submission_time" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contest_problems" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contest_id" varchar(64) NOT NULL,
	"problem_id" varchar(64) NOT NULL,
	"display_order" integer DEFAULT 1 NOT NULL,
	"points" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_solves" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contest_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"problem_id" varchar(64) NOT NULL,
	"submission_id" varchar(64) NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"penalty_minutes" integer DEFAULT 0 NOT NULL,
	"solved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_submissions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contest_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"problem_id" varchar(64) NOT NULL,
	"submission_id" varchar(64) NOT NULL,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"penalty_minutes" integer DEFAULT 0 NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "contest_status" DEFAULT 'UPCOMING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_problem_progress" ADD CONSTRAINT "student_problem_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_problem_progress" ADD CONSTRAINT "student_problem_progress_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_problem_progress" ADD CONSTRAINT "student_problem_progress_best_submission_id_submissions_id_fk" FOREIGN KEY ("best_submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_stats" ADD CONSTRAINT "student_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_problems" ADD CONSTRAINT "contest_problems_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_problems" ADD CONSTRAINT "contest_problems_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_solves" ADD CONSTRAINT "contest_solves_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_solves" ADD CONSTRAINT "contest_solves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_solves" ADD CONSTRAINT "contest_solves_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_solves" ADD CONSTRAINT "contest_solves_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_xp_idx" ON "users" USING btree ("xp");--> statement-breakpoint
CREATE INDEX "users_rating_idx" ON "users" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "submissions_user_id_idx" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submissions_problem_id_idx" ON "submissions" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "submissions_user_problem_idx" ON "submissions" USING btree ("user_id","problem_id");--> statement-breakpoint
CREATE INDEX "submissions_verdict_idx" ON "submissions" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "submissions_created_at_idx" ON "submissions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "student_problem_progress_user_problem_idx" ON "student_problem_progress" USING btree ("user_id","problem_id");--> statement-breakpoint
CREATE INDEX "student_problem_progress_user_id_idx" ON "student_problem_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_problem_progress_problem_id_idx" ON "student_problem_progress" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "student_problem_progress_status_idx" ON "student_problem_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "student_stats_solved_count_idx" ON "student_stats" USING btree ("solved_count");--> statement-breakpoint
CREATE INDEX "student_stats_current_streak_idx" ON "student_stats" USING btree ("current_streak");--> statement-breakpoint
CREATE INDEX "achievements_category_idx" ON "achievements" USING btree ("category");--> statement-breakpoint
CREATE INDEX "achievements_criteria_type_idx" ON "achievements" USING btree ("criteria_type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_user_achievement_idx" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_achievements_achievement_id_idx" ON "user_achievements" USING btree ("achievement_id");--> statement-breakpoint
CREATE INDEX "user_achievements_unlocked_at_idx" ON "user_achievements" USING btree ("unlocked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contest_participants_contest_user_idx" ON "contest_participants" USING btree ("contest_id","user_id");--> statement-breakpoint
CREATE INDEX "contest_participants_contest_id_idx" ON "contest_participants" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "contest_participants_user_id_idx" ON "contest_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contest_participants_ranking_idx" ON "contest_participants" USING btree ("contest_id","score","penalty_minutes");--> statement-breakpoint
CREATE UNIQUE INDEX "contest_problems_contest_problem_idx" ON "contest_problems" USING btree ("contest_id","problem_id");--> statement-breakpoint
CREATE INDEX "contest_problems_contest_id_idx" ON "contest_problems" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "contest_problems_problem_id_idx" ON "contest_problems" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "contest_problems_order_idx" ON "contest_problems" USING btree ("contest_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "contest_solves_contest_user_problem_idx" ON "contest_solves" USING btree ("contest_id","user_id","problem_id");--> statement-breakpoint
CREATE INDEX "contest_solves_contest_id_idx" ON "contest_solves" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "contest_solves_user_id_idx" ON "contest_solves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contest_submissions_contest_user_idx" ON "contest_submissions" USING btree ("contest_id","user_id");--> statement-breakpoint
CREATE INDEX "contest_submissions_contest_problem_idx" ON "contest_submissions" USING btree ("contest_id","problem_id");--> statement-breakpoint
CREATE INDEX "contest_submissions_submitted_at_idx" ON "contest_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "contests_status_idx" ON "contests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contests_start_time_idx" ON "contests" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "contests_end_time_idx" ON "contests" USING btree ("end_time");