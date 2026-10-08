import { Router, type IRouter } from "express";
import {
  SearchLinkedInGuestJobsQueryParams,
  SearchLinkedInGuestJobsResponse,
} from "@workspace/api-zod";
import { parseLinkedInGuestTiming } from "../lib/linkedin-jobs";

const router: IRouter = Router();
const LINKEDIN_GUEST_SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const UPSTREAM_TIMEOUT_MS = 12_000;

router.get("/linkedin/jobs", async (req, res): Promise<void> => {
  if (
    typeof req.query.keywords !== "string" ||
    req.query.keywords.trim().length === 0
  ) {
    res.status(400).json({
      error: "The keywords parameter is required and cannot be blank.",
    });
    return;
  }

  if (
    (req.query.location !== undefined &&
      typeof req.query.location !== "string") ||
    (req.query.start !== undefined && typeof req.query.start !== "string")
  ) {
    res.status(400).json({ error: "Search parameters must appear only once." });
    return;
  }

  const query = SearchLinkedInGuestJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const keywords = query.data.keywords.trim();
  const location = query.data.location?.trim();
  if (!keywords) {
    res.status(400).json({ error: "The keywords parameter cannot be blank." });
    return;
  }

  const upstreamUrl = new URL(LINKEDIN_GUEST_SEARCH_URL);
  upstreamUrl.searchParams.set("keywords", keywords);
  if (location) upstreamUrl.searchParams.set("location", location);
  upstreamUrl.searchParams.set("sortBy", "DD");
  upstreamUrl.searchParams.set("f_TPR", "r86400");
  upstreamUrl.searchParams.set("start", String(query.data.start));

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.8",
        "user-agent": "LinkedInGuestJobTimingService/1.0",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    if (isTimeout) {
      req.log.warn({ timeoutMs: UPSTREAM_TIMEOUT_MS }, "LinkedIn request timed out");
      res.status(504).json({ error: "LinkedIn did not respond in time." });
      return;
    }

    req.log.error({ err: error }, "LinkedIn request failed");
    res.status(502).json({ error: "Could not fetch jobs from LinkedIn." });
    return;
  }

  if (!upstreamResponse.ok) {
    req.log.warn(
      { upstreamStatus: upstreamResponse.status },
      "LinkedIn guest search returned an error",
    );
    res.status(502).json({
      error: `LinkedIn guest search returned HTTP ${upstreamResponse.status}.`,
    });
    return;
  }

  if (
    !upstreamResponse.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("text/html")
  ) {
    req.log.warn(
      {
        contentType: upstreamResponse.headers.get("content-type"),
      },
      "LinkedIn returned a non-HTML response",
    );
    res.status(502).json({ error: "LinkedIn returned an unexpected response." });
    return;
  }

  let html: string;
  try {
    html = await upstreamResponse.text();
  } catch (error) {
    req.log.error({ err: error }, "Could not read LinkedIn response body");
    res.status(502).json({ error: "Could not read the LinkedIn job results." });
    return;
  }

  if (html.length > 5_000_000) {
    req.log.warn({ responseBytes: html.length }, "LinkedIn response exceeded size limit");
    res.status(502).json({ error: "LinkedIn returned an unexpectedly large page." });
    return;
  }

  const scrapedAt = Date.now();
  const parsed = parseLinkedInGuestTiming(html, scrapedAt);
  if (parsed.cardsSeen > 0 && parsed.jobs.length === 0) {
    req.log.warn(
      {
        cardsSeen: parsed.cardsSeen,
        skippedUnsupportedTiming: parsed.skippedUnsupportedTiming,
      },
      "LinkedIn jobs did not contain supported relative timing labels",
    );
    res.status(502).json({
      error: "LinkedIn's job time labels were missing or in an unsupported format.",
    });
    return;
  }

  if (parsed.cardsSeen === 0) {
    if (
      /captcha|security verification|unusual activity|robot check|challenge/i.test(
        html,
      )
    ) {
      req.log.warn("LinkedIn returned a verification or bot-check page");
      res.status(502).json({
        error: "LinkedIn returned a verification page instead of job results.",
      });
      return;
    }

    if (
      !/no jobs found|no matching jobs|no results found|0 results|jobs-search-no-results/i.test(
        html,
      )
    ) {
      req.log.warn("LinkedIn response contained no recognizable job cards");
      res.status(502).json({
        error: "LinkedIn's response format was not recognized.",
      });
      return;
    }
  }

  const jobs = SearchLinkedInGuestJobsResponse.parse(parsed.jobs);
  res.setHeader("X-LinkedIn-Scraped-At", new Date(scrapedAt).toISOString());
  res.json(jobs);
});

export default router;
