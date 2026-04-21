import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "snapshot_comparisons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticker" varchar NOT NULL,
  	"snapshot_a" varchar NOT NULL,
  	"snapshot_b" varchar NOT NULL,
  	"explanation" varchar NOT NULL,
  	"model" varchar,
  	"generated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "snapshot_comparisons_id" integer;
  CREATE INDEX "snapshot_comparisons_ticker_idx" ON "snapshot_comparisons" USING btree ("ticker");
  CREATE INDEX "snapshot_comparisons_updated_at_idx" ON "snapshot_comparisons" USING btree ("updated_at");
  CREATE INDEX "snapshot_comparisons_created_at_idx" ON "snapshot_comparisons" USING btree ("created_at");
  CREATE UNIQUE INDEX "snapshotA_snapshotB_idx" ON "snapshot_comparisons" USING btree ("snapshot_a","snapshot_b");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_snapshot_comparisons_fk" FOREIGN KEY ("snapshot_comparisons_id") REFERENCES "public"."snapshot_comparisons"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_snapshot_comparisons_id_idx" ON "payload_locked_documents_rels" USING btree ("snapshot_comparisons_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "snapshot_comparisons" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "snapshot_comparisons" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_snapshot_comparisons_fk";
  
  DROP INDEX "payload_locked_documents_rels_snapshot_comparisons_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "snapshot_comparisons_id";`)
}
