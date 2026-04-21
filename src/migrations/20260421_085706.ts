import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stocks" ADD COLUMN "ev_to_ebitda" numeric;
  ALTER TABLE "stocks" ADD COLUMN "free_cash_flow" numeric;
  ALTER TABLE "stocks" ADD COLUMN "earnings_growth_yo_y" numeric;
  ALTER TABLE "stocks" ADD COLUMN "gross_margin" numeric;
  ALTER TABLE "stocks" ADD COLUMN "operating_margin" numeric;
  ALTER TABLE "stocks" ADD COLUMN "roa" numeric;
  ALTER TABLE "stocks" ADD COLUMN "insider_activity_net_percent" numeric;
  ALTER TABLE "stocks" ADD COLUMN "insider_activity_buy_count" numeric;
  ALTER TABLE "stocks" ADD COLUMN "insider_activity_sell_count" numeric;
  ALTER TABLE "stocks" ADD COLUMN "insider_activity_period" varchar;
  ALTER TABLE "stock_snapshots" ADD COLUMN "ev_to_ebitda" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "earnings_growth_yo_y" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "gross_margin" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "operating_margin" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "roa" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "free_cash_flow" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "insider_activity_net_percent" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "insider_activity_buy_count" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "insider_activity_sell_count" numeric;
  ALTER TABLE "stock_snapshots" ADD COLUMN "insider_activity_period" varchar;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stocks" DROP COLUMN "ev_to_ebitda";
  ALTER TABLE "stocks" DROP COLUMN "free_cash_flow";
  ALTER TABLE "stocks" DROP COLUMN "earnings_growth_yo_y";
  ALTER TABLE "stocks" DROP COLUMN "gross_margin";
  ALTER TABLE "stocks" DROP COLUMN "operating_margin";
  ALTER TABLE "stocks" DROP COLUMN "roa";
  ALTER TABLE "stocks" DROP COLUMN "insider_activity_net_percent";
  ALTER TABLE "stocks" DROP COLUMN "insider_activity_buy_count";
  ALTER TABLE "stocks" DROP COLUMN "insider_activity_sell_count";
  ALTER TABLE "stocks" DROP COLUMN "insider_activity_period";
  ALTER TABLE "stock_snapshots" DROP COLUMN "ev_to_ebitda";
  ALTER TABLE "stock_snapshots" DROP COLUMN "earnings_growth_yo_y";
  ALTER TABLE "stock_snapshots" DROP COLUMN "gross_margin";
  ALTER TABLE "stock_snapshots" DROP COLUMN "operating_margin";
  ALTER TABLE "stock_snapshots" DROP COLUMN "roa";
  ALTER TABLE "stock_snapshots" DROP COLUMN "free_cash_flow";
  ALTER TABLE "stock_snapshots" DROP COLUMN "insider_activity_net_percent";
  ALTER TABLE "stock_snapshots" DROP COLUMN "insider_activity_buy_count";
  ALTER TABLE "stock_snapshots" DROP COLUMN "insider_activity_sell_count";
  ALTER TABLE "stock_snapshots" DROP COLUMN "insider_activity_period";`);
}
