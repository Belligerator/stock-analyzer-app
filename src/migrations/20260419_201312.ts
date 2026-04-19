import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "explanations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL,
  	"display_term" varchar NOT NULL,
  	"explanation" varchar NOT NULL,
  	"model" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "explanations_id" integer;
  CREATE INDEX "explanations_term_idx" ON "explanations" USING btree ("term");
  CREATE INDEX "explanations_updated_at_idx" ON "explanations" USING btree ("updated_at");
  CREATE INDEX "explanations_created_at_idx" ON "explanations" USING btree ("created_at");
  CREATE UNIQUE INDEX "term_idx" ON "explanations" USING btree ("term");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_explanations_fk" FOREIGN KEY ("explanations_id") REFERENCES "public"."explanations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_explanations_id_idx" ON "payload_locked_documents_rels" USING btree ("explanations_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "explanations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "explanations" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_explanations_fk";
  
  DROP INDEX "payload_locked_documents_rels_explanations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "explanations_id";`);
}
