/**
 * lib/echotik/cron/syncCreators.ts — Creator/Influencer ranklist sync
 */

import { prisma } from "@/lib/prisma";
import { echotikRequest } from "@/lib/echotik/client";
import { CREATOR_RANK_FIELDS } from "@/lib/echotik/rankFields";
import type { Logger } from "@/lib/logger";
import type { EchotikApiResponse, EchotikInfluencerRankItem } from "./types";
import { CREATOR_RANKLIST_PAGES } from "./types";
import {
  formatDate,
  getCandidateDates,
  saveRawResponse,
  getConfiguredRegions,
  REGION_CURRENCY,
} from "./helpers";

// ---------------------------------------------------------------------------
// Sync creator ranklist for a single region / cycle / field
// ---------------------------------------------------------------------------

export async function syncCreatorRanklistForRegion(
  runId: string,
  region: string,
  rankingCycle: 1 | 2 | 3,
  rankField: number,
  log: Logger,
): Promise<number> {
  const endpoint = "/api/v3/echotik/influencer/ranklist";
  const datesToTry = getCandidateDates(rankingCycle);

  let synced = 0;
  let effectiveDate: Date | null = null;

  for (const candidateDate of datesToTry) {
    const checkParams = {
      date: formatDate(candidateDate),
      region,
      influencer_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: 1,
      page_size: 1,
      language: "en-US",
    };
    const check = await echotikRequest<
      EchotikApiResponse<EchotikInfluencerRankItem>
    >(endpoint, { params: checkParams });
    if (check.code === 0 && check.data && check.data.length > 0) {
      effectiveDate = candidateDate;
      log.debug("Creator data found", {
        field: rankField,
        date: formatDate(candidateDate),
      });
      break;
    }
  }

  if (!effectiveDate) {
    log.warn("No creator data available", { field: rankField, region });
    return 0;
  }

  const dateStr = formatDate(effectiveDate);
  const date = effectiveDate;

  for (let page = 1; page <= CREATOR_RANKLIST_PAGES; page++) {
    const params = {
      date: dateStr,
      region,
      influencer_rank_field: rankField,
      rank_type: rankingCycle,
      page_num: page,
      page_size: 10,
      language: "en-US",
    };

    let body: EchotikApiResponse<EchotikInfluencerRankItem>;
    try {
      body = await echotikRequest<
        EchotikApiResponse<EchotikInfluencerRankItem>
      >(endpoint, { params });
    } catch (err) {
      log.error("Creator ranklist fetch failed", {
        page,
        error: (err as Error).message,
      });
      throw err;
    }

    if (body.code !== 0) {
      throw new Error(`Creator API error: ${body.code} — ${body.message}`);
    }

    await saveRawResponse(endpoint, params, body, runId);

    const items = body.data ?? [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const userExternalId = item.user_id;
      if (!userExternalId) continue;

      const gmvCents = Math.round((item.total_sale_gmv_amt ?? 0) * 100);
      const rankPosition = (page - 1) * 10 + i + 1;

      await prisma.echotikCreatorTrendDaily.upsert({
        where: {
          userExternalId_date_country_rankingCycle_rankField: {
            userExternalId,
            date,
            country: region,
            rankingCycle,
            rankField,
          },
        },
        create: {
          date,
          rankingCycle,
          rankField,
          rankPosition,
          userExternalId,
          uniqueId: item.unique_id || null,
          nickName: item.nick_name || null,
          avatar: item.avatar || null,
          category: item.category || null,
          ecScore: item.ec_score ?? 0,
          followersCount: BigInt(
            item.total_followers_cnt || item.total_followers_history_cnt || 0,
          ),
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          diggCount: BigInt(
            item.total_digg_cnt || item.total_digg_history_cnt || 0,
          ),
          productCount: BigInt(
            item.total_product_cnt || item.total_product_history_cnt || 0,
          ),
          videoCount: BigInt(
            item.total_video_cnt || item.total_post_video_cnt || 0,
          ),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          mostCategoryId: item.most_category_id || null,
          currency: REGION_CURRENCY[region] ?? "USD",
          country: region,
          extra: item as any,
        },
        update: {
          rankPosition,
          uniqueId: item.unique_id || undefined,
          nickName: item.nick_name || undefined,
          avatar: item.avatar || undefined,
          category: item.category || undefined,
          ecScore: item.ec_score ?? 0,
          followersCount: BigInt(
            item.total_followers_cnt || item.total_followers_history_cnt || 0,
          ),
          saleCount: BigInt(item.total_sale_cnt ?? 0),
          gmv: BigInt(gmvCents),
          diggCount: BigInt(
            item.total_digg_cnt || item.total_digg_history_cnt || 0,
          ),
          productCount: BigInt(
            item.total_product_cnt || item.total_product_history_cnt || 0,
          ),
          videoCount: BigInt(
            item.total_video_cnt || item.total_post_video_cnt || 0,
          ),
          liveCount: BigInt(item.total_live_cnt ?? 0),
          mostCategoryId: item.most_category_id || undefined,
          currency: REGION_CURRENCY[region] ?? "USD",
          country: region,
          extra: item as any,
          syncedAt: new Date(),
        },
      });
      synced++;
    }
  }

  log.info("Creators synced", {
    region,
    cycle: rankingCycle,
    field: rankField,
    synced,
  });
  return synced;
}

// ---------------------------------------------------------------------------
// Sync creators for a single region across all cycles / fields
// ---------------------------------------------------------------------------

export async function syncCreatorRanklist(
  runId: string,
  region: string,
  log: Logger,
): Promise<number> {
  log.info("Syncing creators", { region });
  const rankingCycles: Array<1 | 2 | 3> = [1, 2, 3];
  let total = 0;
  for (const rankingCycle of rankingCycles) {
    for (const { field } of CREATOR_RANK_FIELDS) {
      const count = await syncCreatorRanklistForRegion(
        runId,
        region,
        rankingCycle,
        field,
        log,
      );
      total += count;
    }
  }
  return total;
}
