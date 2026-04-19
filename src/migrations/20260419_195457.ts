import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stocks" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "stocks" ALTER COLUMN "sector" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stocks" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "stocks" ALTER COLUMN "sector" SET NOT NULL;`)
}
