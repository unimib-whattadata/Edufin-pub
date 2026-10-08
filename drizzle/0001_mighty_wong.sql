DO $$
BEGIN
    CREATE TYPE "public"."appointment_area" AS ENUM('PROTEZIONE', 'PREVIDENZA', 'FISCALITA', 'RISPARMIO/INVESTIMENTI', 'FINANZIAMENTI');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edufin-db_appointment" (
	"appointment_id" serial PRIMARY KEY NOT NULL,
	"area" "appointment_area" NOT NULL,
	"user_name" text,
	"user_surname" text,
	"user_email" text,
	"educator_email" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "area_idx" ON "edufin-db_appointment" USING btree ("area");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_created_at_idx" ON "edufin-db_appointment" USING btree ("created_at");