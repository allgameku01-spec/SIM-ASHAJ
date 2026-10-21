CREATE TABLE "app_state" (
	"key" text PRIMARY KEY,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presences" (
	"user_id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"collection" text,
	"id" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "records_pkey" PRIMARY KEY("collection","id")
);
--> statement-breakpoint
CREATE INDEX "records_collection_idx" ON "records" ("collection");