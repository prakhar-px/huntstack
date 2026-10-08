import * as cheerio from "cheerio";

export type TimePrecision = "second" | "minute" | "hour" | "day";

export type ParsedRelativeAge = {
  deltaMs: number;
  precision: TimePrecision;
};

export type ParsedLinkedInJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  rawRelative: string;
  rawDateOnly: string | null;
  relativeAgeMs: number;
  computedPostTime: string;
  timestampIsEstimate: true;
  timePrecision: TimePrecision;
  verifiedUrl: string;
};

export type LinkedInParseResult = {
  jobs: ParsedLinkedInJob[];
  cardsSeen: number;
  skippedUnsupportedTiming: number;
};

const timeUnits = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;

export function parseRelativeAge(rawRelative: string): ParsedRelativeAge | null {
  const normalized = rawRelative
    .toLowerCase()
    .replace(/[•·].*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:posted|reposted)\s+/, "");

  if (
    /^(?:just now|moments ago|less than a minute ago|<\s*1\s*min(?:ute)?)$/.test(
      normalized,
    )
  ) {
    return { deltaMs: 0, precision: "second" };
  }

  const match = normalized.match(
    /^(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)\s*(?:ago)?$/,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < 0) return null;

  const unit = match[2];
  if (!unit) return null;

  let precision: TimePrecision;
  let multiplier: number;

  if (/^(?:s|sec|secs|second|seconds)$/.test(unit)) {
    precision = "second";
    multiplier = timeUnits.second;
  } else if (/^(?:m|min|mins|minute|minutes)$/.test(unit)) {
    precision = "minute";
    multiplier = timeUnits.minute;
  } else if (/^(?:h|hr|hrs|hour|hours)$/.test(unit)) {
    precision = "hour";
    multiplier = timeUnits.hour;
  } else {
    precision = "day";
    multiplier = timeUnits.day;
  }

  const deltaMs = amount * multiplier;
  if (!Number.isSafeInteger(deltaMs)) return null;

  return { deltaMs, precision };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractJobId(href: string): string | null {
  try {
    const url = new URL(href, "https://www.linkedin.com");
    if (
      url.hostname !== "linkedin.com" &&
      !url.hostname.endsWith(".linkedin.com")
    ) {
      return null;
    }

    const jobPath = url.pathname.match(/\/view\/([^/]+)(?:\/|$)/)?.[1];
    if (!jobPath) return null;

    // LinkedIn's live links commonly include a slug before the numeric ID,
    // e.g. /jobs/view/backend-engineer-at-company-4477166420.
    return jobPath.match(/(?:^|-)(\d+)$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function parseLinkedInGuestTiming(
  rawHtml: string,
  scrapeTime = Date.now(),
): LinkedInParseResult {
  const $ = cheerio.load(rawHtml);
  const jobs: ParsedLinkedInJob[] = [];
  let cardsSeen = 0;
  let skippedUnsupportedTiming = 0;

  $("li").each((_, element) => {
    const card = $(element);
    const title = cleanText(card.find(".base-search-card__title").first().text());
    if (!title) return;

    cardsSeen += 1;

    const link =
      card.find("a.base-card__full-link").first().attr("href") ??
      card.find("a[href*='/view/']").first().attr("href") ??
      "";
    const id = extractJobId(link);
    const timeElement = card.find("time").first();
    const rawRelative = cleanText(timeElement.text());
    const parsedAge = parseRelativeAge(rawRelative);

    if (!id || !parsedAge) {
      skippedUnsupportedTiming += 1;
      return;
    }

    const companyText = cleanText(
      card.find(".base-search-card__subtitle").first().text(),
    );
    const locationText = cleanText(
      card.find(".job-search-card__location").first().text(),
    );
    const rawDateOnly = timeElement.attr("datetime")?.trim() || null;
    const estimatedEpoch = scrapeTime - parsedAge.deltaMs;

    jobs.push({
      id,
      title,
      company: companyText || null,
      location: locationText || null,
      rawRelative,
      rawDateOnly,
      relativeAgeMs: parsedAge.deltaMs,
      computedPostTime: new Date(estimatedEpoch).toISOString(),
      timestampIsEstimate: true,
      timePrecision: parsedAge.precision,
      verifiedUrl: `https://www.linkedin.com/jobs/view/${id}`,
    });
  });

  jobs.sort(
    (first, second) =>
      Date.parse(second.computedPostTime) - Date.parse(first.computedPostTime),
  );

  return { jobs, cardsSeen, skippedUnsupportedTiming };
}
