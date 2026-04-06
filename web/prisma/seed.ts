import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.observation.deleteMany();
  await prisma.hierarchyRule.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.feature.deleteMany();

  await prisma.feature.createMany({
    data: [
      { id: 1, code: "fi_sovereign" },
      { id: 2, code: "fi_corporate" },
      { id: 3, code: "region_emea" },
      { id: 4, code: "region_na" },
      { id: 5, code: "rating_ig" },
    ],
  });

  await prisma.rule.createMany({
    data: [
      { id: 1, decisionCode: "ald_sov_rates_na" },
      { id: 2, decisionCode: "ald_corp_credit_na" },
      { id: 3, decisionCode: "ald_corp_credit_emea" },
    ],
  });

  await prisma.observation.createMany({
    data: [
      {
        isin: "US00ALDINFI01",
        aldIssuerClass: "sovereign",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: null,
        aldRatingBand: "ig",
        fundRatingBandOverride: null,
      },
      {
        isin: "DE00ALDINFI02",
        aldIssuerClass: "corporate",
        fundIssuerClassOverride: null,
        aldRegion: "emea",
        fundRegionOverride: null,
        aldRatingBand: "core",
        fundRatingBandOverride: null,
      },
      {
        isin: "US00ALDINFI03",
        aldIssuerClass: "corporate",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: "emea",
        aldRatingBand: "core",
        fundRatingBandOverride: null,
      },
      {
        isin: "GB00ALDINFI04",
        aldIssuerClass: "sovereign",
        fundIssuerClassOverride: null,
        aldRegion: "emea",
        fundRegionOverride: null,
        aldRatingBand: "ig",
        fundRatingBandOverride: null,
      },
      {
        isin: "FR00ALDINFI05",
        aldIssuerClass: "corporate",
        fundIssuerClassOverride: null,
        aldRegion: "emea",
        fundRegionOverride: null,
        aldRatingBand: "ig",
        fundRatingBandOverride: "core",
      },
      {
        isin: "CA00ALDINFI06",
        aldIssuerClass: "corporate",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: "emea",
        aldRatingBand: "core",
        fundRatingBandOverride: null,
      },
      {
        isin: "US00ALDINFI07",
        aldIssuerClass: "derivative",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: null,
        aldRatingBand: "core",
        fundRatingBandOverride: null,
      },
    ],
  });

  await prisma.hierarchyRule.createMany({
    data: [
      {
        ruleId: 1,
        hierarchyTop: "Debt",
        hierarchyMiddle: "Govt",
        hierarchyBottom: "sovereign",
        descriptor01: "rates_coverage",
        descriptor02: "SOV-RATES-NA",
        descriptor03: "T+0_CLOSE",
        descriptor04: "BOOK_NA_GOVT",
      },
      {
        ruleId: 3,
        hierarchyTop: "Debt",
        hierarchyMiddle: "Corp",
        hierarchyBottom: "corporate",
        descriptor01: "credit_coverage",
        descriptor02: "CORP-CREDIT-EMEA",
        descriptor03: "T+1_STD",
        descriptor04: "BOOK_EMEA_CREDIT",
      },
      {
        ruleId: 2,
        hierarchyTop: "Debt",
        hierarchyMiddle: "*",
        hierarchyBottom: "*",
        descriptor01: "general_debt_coverage",
        descriptor02: "CORP-CREDIT-NA",
        descriptor03: "T+1_STD",
        descriptor04: "BOOK_NA_CREDIT",
      },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
