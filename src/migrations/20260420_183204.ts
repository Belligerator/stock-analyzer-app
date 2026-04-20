import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "stock_snapshots_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar
  );
  
  CREATE TABLE "stock_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stock_id" integer,
  	"ticker" varchar NOT NULL,
  	"taken_at" timestamp(3) with time zone NOT NULL,
  	"label" varchar,
  	"my_prediction" varchar,
  	"my_note" varchar,
  	"price" numeric,
  	"currency" varchar,
  	"pe" numeric,
  	"fwd_pe" numeric,
  	"peg" numeric,
  	"gain52w" numeric,
  	"market_cap" numeric,
  	"revenue_growth_yo_y" numeric,
  	"profit_margin" numeric,
  	"roe" numeric,
  	"debt_to_equity" numeric,
  	"num_analysts" numeric,
  	"avg_target" numeric,
  	"target_high" numeric,
  	"target_low" numeric,
  	"cons" varchar,
  	"analyst_breakdown_strong_buy" numeric,
  	"analyst_breakdown_buy" numeric,
  	"analyst_breakdown_hold" numeric,
  	"analyst_breakdown_sell" numeric,
  	"analyst_breakdown_strong_sell" numeric,
  	"note" varchar,
  	"recent_context" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stock_snapshots_id" integer;
  ALTER TABLE "stock_snapshots_sources" ADD CONSTRAINT "stock_snapshots_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stock_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stock_snapshots" ADD CONSTRAINT "stock_snapshots_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "stock_snapshots_sources_order_idx" ON "stock_snapshots_sources" USING btree ("_order");
  CREATE INDEX "stock_snapshots_sources_parent_id_idx" ON "stock_snapshots_sources" USING btree ("_parent_id");
  CREATE INDEX "stock_snapshots_stock_idx" ON "stock_snapshots" USING btree ("stock_id");
  CREATE INDEX "stock_snapshots_ticker_idx" ON "stock_snapshots" USING btree ("ticker");
  CREATE INDEX "stock_snapshots_updated_at_idx" ON "stock_snapshots" USING btree ("updated_at");
  CREATE INDEX "stock_snapshots_created_at_idx" ON "stock_snapshots" USING btree ("created_at");
  CREATE INDEX "ticker_takenAt_idx" ON "stock_snapshots" USING btree ("ticker","taken_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_snapshots_fk" FOREIGN KEY ("stock_snapshots_id") REFERENCES "public"."stock_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_stock_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_snapshots_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stock_snapshots_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stock_snapshots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "stock_snapshots_sources" CASCADE;
  DROP TABLE "stock_snapshots" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_snapshots_fk";
  
  DROP INDEX "payload_locked_documents_rels_stock_snapshots_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stock_snapshots_id";`)
}
