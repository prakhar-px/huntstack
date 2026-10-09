import * as cheerio from "cheerio";
import type {
  ExperienceLevel,
  LinkedInGuestJobExperienceLevelStatus,
} from "@workspace/api-zod";

export type TimePrecision = "second" | "minute" | "hour" | "day";

export type ParsedRelativeAge = {
  deltaMs: number;
  precision: TimePrecision;
};

export type ParsedLinkedInJob = {
  id: string;
  title: string;
  company: string | null;
  companyLogoUrl: string | null;
  companyProfileUrl: string | null;
  location: string | null;
  jobInsight: string | null;
  rawRelative: string;
  rawDateOnly: string | null;
  relativeAgeMs: number;
  computedPostTime: string;
  timestampIsEstimate: true;
  timePrecision: TimePrecision;
  verifiedUrl: string;
  experienceLevel: ExperienceLevel | null;
  experienceLevelStatus: LinkedInGuestJobExperienceLevelStatus;
};

export type ParsedJobExperience = Pick<
  ParsedLinkedInJob,
  "experienceLevel" | "experienceLevelStatus"
>;

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

const experienceLabels: Record<string, ExperienceLevel> = {
  internship: "internship",
  "entry level": "entry_level",
  associate: "associate",
  "mid senior level": "mid_senior",
  director: "director",
  executive: "executive",
  "not applicable": "not_applicable",
};

const experienceCache = new Map<
  string,
  { value: ParsedJobExperience; expiresAt: number }
>();
const EXPERIENCE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const JOB_DETAIL_TIMEOUT_MS = 8_000;

function unavailableExperience(): ParsedJobExperience {
  return { experienceLevel: null, experienceLevelStatus: "unavailable" };
}

async function fetchJobExperience(id: string): Promise<ParsedJobExperience> {
  const cached = experienceCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) experienceCache.delete(id);

  let value: ParsedJobExperience = unavailableExperience();
  try {
    const response = await fetch(`https://www.linkedin.com/jobs/view/${id}`, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.8",
        "user-agent": "LinkedInGuestJobTimingService/1.0",
      },
      signal: AbortSignal.timeout(JOB_DETAIL_TIMEOUT_MS),
    });

    if (
      response.ok &&
      response.headers.get("content-type")?.toLowerCase().includes("text/html")
    ) {
      const html = await response.text();
      if (
        html.length <= 5_000_000 &&
        html.includes("description__job-criteria-list")
      ) {
        const $ = cheerio.load(html);
        let seniorityText = "";
        $(".description__job-criteria-item").each((_, element) => {
          const item = $(element);
          const label = cleanText(
            item.find(".description__job-criteria-subheader").text(),
          ).toLowerCase();
          if (label === "seniority level") {
            seniorityText = cleanText(
              item.find(".description__job-criteria-text").text(),
            );
          }
        });

        if (!seniorityText) {
          value = { experienceLevel: null, experienceLevelStatus: "not_listed" };
        } else {
          const normalized = seniorityText
            .toLowerCase()
            .replace(/[–—]/g, "-")
            .replace(/[^a-z]+/g, " ")
            .trim();
          const experienceLevel = experienceLabels[normalized];
          value = experienceLevel
            ? { experienceLevel, experienceLevelStatus: "available" }
            : unavailableExperience();
        }
      }
    }
  } catch {
    // A missing or blocked detail page cannot be used to infer seniority.
  }

  experienceCache.set(id, {
    value,
    expiresAt:
      Date.now() +
      (value.experienceLevelStatus === "unavailable"
        ? 60_000
        : EXPERIENCE_CACHE_TTL_MS),
  });
  return value;
}

export async function addLinkedInJobExperience(
  jobs: ParsedLinkedInJob[],
): Promise<ParsedLinkedInJob[]> {
  const enriched = [...jobs];
  let nextIndex = 0;
  const workerCount = Math.min(3, jobs.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex++;
        const job = jobs[index];
        if (!job) return;
        enriched[index] = { ...job, ...(await fetchJobExperience(job.id)) };
      }
    }),
  );

  return enriched;
}

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

function extractCompanyLogoUrl(...candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;

    try {
      const url = new URL(candidate.trim());
      if (url.protocol === "https:" && url.hostname === "media.licdn.com") {
        return url.toString();
      }
    } catch {
      // Ignore malformed logo URLs and keep trying other image attributes.
    }
  }

  return null;
}

function extractCompanyProfileUrl(href: string): string | null {
  try {
    const url = new URL(href, "https://www.linkedin.com");
    if (
      (url.hostname !== "linkedin.com" &&
        !url.hostname.endsWith(".linkedin.com")) ||
      url.protocol !== "https:"
    ) {
      return null;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (
      pathParts.length < 2 ||
      (pathParts[0] !== "company" && pathParts[0] !== "school")
    ) {
      return null;
    }

    return `https://www.linkedin.com/${pathParts.slice(0, 2).join("/")}/`;
  } catch {
    return null;
  }
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
    const companyLink = card
      .find(".base-search-card__subtitle a")
      .first()
      .attr("href");
    const companyImage = card.find(".artdeco-entity-image").first();
    const companyLogoUrl = extractCompanyLogoUrl(
      companyImage.attr("data-delayed-url"),
      companyImage.attr("src"),
      companyImage.attr("data-src"),
    );
    const locationText = cleanText(
      card.find(".job-search-card__location").first().text(),
    );
    const jobInsightText = cleanText(
      card
        .find(".job-posting-benefits__text, .job-search-card__job-insight")
        .first()
        .text(),
    );
    const rawDateOnly = timeElement.attr("datetime")?.trim() || null;
    const estimatedEpoch = scrapeTime - parsedAge.deltaMs;

    jobs.push({
      id,
      title,
      company: companyText || null,
      companyLogoUrl,
      companyProfileUrl: companyLink
        ? extractCompanyProfileUrl(companyLink)
        : null,
      location: locationText || null,
      jobInsight: jobInsightText || null,
      rawRelative,
      rawDateOnly,
      relativeAgeMs: parsedAge.deltaMs,
      computedPostTime: new Date(estimatedEpoch).toISOString(),
      timestampIsEstimate: true,
      timePrecision: parsedAge.precision,
      verifiedUrl: `https://www.linkedin.com/jobs/view/${id}`,
      experienceLevel: null,
      experienceLevelStatus: "not_requested",
    });
  });

  jobs.sort(
    (first, second) =>
      Date.parse(second.computedPostTime) - Date.parse(first.computedPostTime),
  );

  return { jobs, cardsSeen, skippedUnsupportedTiming };
}
