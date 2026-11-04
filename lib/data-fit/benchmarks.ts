// ---------------------------------------------------------------------------
// Published market evidence used to calibrate the valuation model.
//
// Every figure below is copied from a public page checked on 2026-11-03.
// They are published OFFERS and INDICATIVE prices from buyers, data brokers and
// one seller's term sheet. They are not completed-sale prices, and the sources
// say so themselves. The only completed sales with a stated amount in the
// public record are very few (see REALIZED_SALES).
//
// If a figure changes at its source, update it here and the page follows.
// ---------------------------------------------------------------------------

export const BENCHMARKS_CHECKED = "2026-11-03";

export type Benchmark = {
  id: string;
  who: string;
  what: string;
  kind: "published offer range" | "indicative list price" | "market index";
  lowUsd: number;
  /** Open-ended ranges ("and up") set openEnded. */
  highUsd: number;
  openEnded?: boolean;
  note: string;
  url: string;
};

export const BENCHMARKS: readonly Benchmark[] = [
  {
    id: "para",
    who: "PARA AI Labs (AI data buyer)",
    what: "Completed construction project records: drawings, specifications, RFIs, change orders, site imagery",
    kind: "published offer range",
    lowUsd: 115_000,
    highUsd: 1_000_000,
    note: "Stated for firms with 50 to 2,000 employees. Moves with the number of projects and depth of imagery.",
    url: "https://parailabs.com/data-licensing/construction",
  },
  {
    id: "opentrain",
    who: "A buyer quoted by OpenTrain (introducer)",
    what: "Finished construction project files, drawings, and site photos",
    kind: "published offer range",
    lowUsd: 150_000,
    highUsd: 2_000_000,
    openEnded: true,
    note: "Buyer's own estimate: $150K to over $2M. OpenTrain states it is not a promise and the buyer may offer less or nothing.",
    url: "https://www.opentrain.ai/company-data-licensing/construction-companies/",
  },
  {
    id: "renaissance",
    who: "Renaissance Data Labs (finder)",
    what: "BIM models, drawing sets, RFIs, change orders, bids, daily logs from architecture and construction firms",
    kind: "published offer range",
    lowUsd: 100_000,
    highUsd: 5_000_000,
    note: "Headline estimate for firms with 20+ employees and 3+ years of records. A written offer follows a review of actual systems and volume.",
    url: "https://renaissancedatalabs.com/industries/architecture-construction",
  },
  {
    id: "jwse",
    who: "J W Salm Engineering (seller term sheet)",
    what: "30+ years of civil engineering workflows, about 285,647 indexed files",
    kind: "indicative list price",
    lowUsd: 35_000,
    highUsd: 2_500_000,
    note: "Three indicative tiers: $35K evaluation, $750K CAD corpus, $2.5M operational corpus. List prices, not completed sales.",
    url: "https://jwse.ai/JWSE_Indicative_AI_Data_License_Term_Sheet.pdf",
  },
];

/** Published offers for company records across 93 figures (AIData.Broker price index, Oct 2026). */
export const OFFER_INDEX = {
  medianUsd: 316_228,
  q1Usd: 152_700,
  q3Usd: 692_800,
  figures: 93,
  url: "https://aidata.broker/research/paper-prices.pdf",
};

/** The few public completed sales with a stated amount for company records. */
export const REALIZED_SALES = {
  medianUsd: 28_300,
  count: 4,
  url: "https://aidata.broker/research/paper-prices.pdf",
};

export const BENCHMARK_CAVEAT =
  "These are what buyers and brokers publish they might offer, not what companies have been paid. Only four public completed sales with a stated amount exist for company records, with a median near $28K. Many firms receive less than the published ranges, or no offer at all.";

const offerRanges = BENCHMARKS.filter((b) => b.kind === "published offer range");

/** Widest span across the published offer ranges, for attributed marketing copy. */
export const PUBLISHED_OFFER_SPAN = {
  lowUsd: Math.min(...offerRanges.map((b) => b.lowUsd)),
  highUsd: Math.max(...offerRanges.map((b) => b.highUsd)),
};

function compactUsd(n: number) {
  return n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${Math.round(n / 1000)}K`;
}

/** "$100K to $5M". Always pair with PUBLISHED_RANGE_QUALIFIER nearby. */
export const PUBLISHED_RANGE_TEXT = `${compactUsd(PUBLISHED_OFFER_SPAN.lowUsd)} to ${compactUsd(PUBLISHED_OFFER_SPAN.highUsd)}`;

export const PUBLISHED_RANGE_QUALIFIER =
  "Published offer ranges from AI data buyers and brokers for construction and design records. Not completed sales, not a promise of payment.";
