DO $$
BEGIN
	CREATE TYPE "public"."bot_vote" AS ENUM('up', 'down');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
ALTER TABLE "edufin-db_message" ADD COLUMN IF NOT EXISTS "botVoteSubmitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "edufin-db_message" ADD COLUMN IF NOT EXISTS "botVote" "bot_vote";--> statement-breakpoint
ALTER TABLE "edufin-db_message" ADD COLUMN IF NOT EXISTS "botVoteAt" timestamp with time zone;