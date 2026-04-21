import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stock_snapshots" ALTER COLUMN "stock_id" SET NOT NULL;
  ALTER TABLE "stocks" ADD COLUMN "analyst_last_action_date" timestamp(3) with time zone;
  ALTER TABLE "stock_snapshots" ADD COLUMN "metrics_updated_at" timestamp(3) with time zone;
  ALTER TABLE "stock_snapshots" ADD COLUMN "note_updated_at" timestamp(3) with time zone;
  ALTER TABLE "stock_snapshots" ADD COLUMN "analyst_last_action_date" timestamp(3) with time zone;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stock_snapshots" ALTER COLUMN "stock_id" DROP NOT NULL;
  ALTER TABLE "stocks" DROP COLUMN "analyst_last_action_date";
  ALTER TABLE "stock_snapshots" DROP COLUMN "metrics_updated_at";
  ALTER TABLE "stock_snapshots" DROP COLUMN "note_updated_at";
  ALTER TABLE "stock_snapshots" DROP COLUMN "analyst_last_action_date";`);
}
