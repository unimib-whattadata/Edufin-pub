DO $$
BEGIN
    CREATE TYPE "public"."conversation_flow" AS ENUM('message', 'meeting', 'meeting_area', 'end');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
DO $$
BEGIN
    CREATE TYPE "public"."sender" AS ENUM('bot', 'user');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edufin-db_chat" (
	"chat_id" serial PRIMARY KEY NOT NULL,
	"last_update" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"anonymId" text,
	"messageCount" integer DEFAULT 1 NOT NULL,
	"meetingConditionsAccepted" boolean,
	"meetingAgreed" boolean,
	"historyContext" text[] DEFAULT '{}' NOT NULL,
	"conversation_flowEnum" "conversation_flow" DEFAULT 'message' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edufin-db_message" (
	"message_id" serial PRIMARY KEY NOT NULL,
	"chat_id" serial NOT NULL,
	"text" text NOT NULL,
	"sender" "sender" NOT NULL,
	"time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"formMessage" text,
	"meetingMessage" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "edufin-db_message"
		ADD CONSTRAINT "edufin-db_message_chat_id_edufin-db_chat_chat_id_fk"
		FOREIGN KEY ("chat_id") REFERENCES "public"."edufin-db_chat"("chat_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anonym_id_idx" ON "edufin-db_chat" USING btree ("anonymId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_idx" ON "edufin-db_message" USING btree ("time");