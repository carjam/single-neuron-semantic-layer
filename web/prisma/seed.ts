import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.descriptor.deleteMany();
  await prisma.ruleWeight.deleteMany();
  await prisma.observation.deleteMany();
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

  await prisma.descriptor.createMany({
    data: [
      {
        ruleId: 1,
        routingQueue: "SOV-RATES-NA",
        slaBucket: "T+0_CLOSE",
        costCenter: "BOOK_NA_GOVT",
      },
      {
        ruleId: 2,
        routingQueue: "CORP-CREDIT-NA",
        slaBucket: "T+1_STD",
        costCenter: "BOOK_NA_CREDIT",
      },
      {
        ruleId: 3,
        routingQueue: "CORP-CREDIT-EMEA",
        slaBucket: "T+1_STD",
        costCenter: "BOOK_EMEA_CREDIT",
      },
    ],
  });

  await prisma.ruleWeight.createMany({
    data: [
      { ruleId: 1, featureId: 1, weight: 0.5 },
      { ruleId: 1, featureId: 5, weight: 0.5 },
      { ruleId: 2, featureId: 2, weight: 0.4 },
      { ruleId: 2, featureId: 4, weight: 0.6 },
      { ruleId: 3, featureId: 2, weight: 0.4 },
      { ruleId: 3, featureId: 3, weight: 0.6 },
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
