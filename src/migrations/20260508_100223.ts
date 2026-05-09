import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "stocks_analyst_targets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider" varchar,
  	"rating" varchar,
  	"target_price" numeric,
  	"report_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "stock_snapshots_analyst_targets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider" varchar,
  	"rating" varchar,
  	"target_price" numeric,
  	"report_date" timestamp(3) with time zone
  );
  
  ALTER TABLE "stocks_analyst_targets" ADD CONSTRAINT "stocks_analyst_targets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stock_snapshots_analyst_targets" ADD CONSTRAINT "stock_snapshots_analyst_targets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stock_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "stocks_analyst_targets_order_idx" ON "stocks_analyst_targets" USING btree ("_order");
  CREATE INDEX "stocks_analyst_targets_parent_id_idx" ON "stocks_analyst_targets" USING btree ("_parent_id");
  CREATE INDEX "stock_snapshots_analyst_targets_order_idx" ON "stock_snapshots_analyst_targets" USING btree ("_order");
  CREATE INDEX "stock_snapshots_analyst_targets_parent_id_idx" ON "stock_snapshots_analyst_targets" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "stocks_analyst_targets" CASCADE;
  DROP TABLE "stock_snapshots_analyst_targets" CASCADE;`)
}
