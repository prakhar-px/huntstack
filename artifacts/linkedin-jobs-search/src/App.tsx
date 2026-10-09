import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  searchLinkedInGuestJobs,
  type ExperienceLevel,
  type LinkedInGuestJob,
  type SearchLinkedInGuestJobsParams,
} from '@workspace/api-client-react';
import { ArrowUpRight, BriefcaseBusiness, Building2, Clock3, MapPin, Search, TriangleAlert } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const LINKEDIN_PAGE_SIZE = 10;
const MAX_LINKEDIN_START = 1000;
const FRESHNESS_WINDOWS = [1, 2, 6, 12, 24] as const;
type FreshnessWindow = (typeof FRESHNESS_WINDOWS)[number];
const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'internship', label: 'Internship' },
  { value: 'entry_level', label: 'Entry level' },
  { value: 'associate', label: 'Associate' },
  { value: 'mid_senior', label: 'Mid-Senior level' },
  { value: 'director', label: 'Director' },
  { value: 'executive', label: 'Executive' },
  { value: 'not_applicable', label: 'Not applicable' },
];

function experienceLabel(level: ExperienceLevel) {
  return EXPERIENCE_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

type JobScrollAnchor = { jobId: string; top: number };

function getVisibleJobScrollAnchor(): JobScrollAnchor | null {
  const centerX = Math.max(0, Math.min(window.innerWidth - 1, window.innerWidth / 2));
  const verticalChecks = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];

  for (const ratio of verticalChecks) {
    const y = Math.max(0, Math.min(window.innerHeight - 1, window.innerHeight * ratio));
    const card = document
      .elementFromPoint(centerX, y)
      ?.closest<HTMLElement>('[data-job-id]');
    const jobId = card?.dataset.jobId;
    if (card && jobId) {
      return { jobId, top: card.getBoundingClientRect().top };
    }
  }

  return null;
}

function Home() {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [searchParams, setSearchParams] = useState<SearchLinkedInGuestJobsParams | null>(null);
  const [freshnessHours, setFreshnessHours] = useState<FreshnessWindow>(24);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>('');
  const search = useInfiniteQuery({
    queryKey: ['linkedin-guest-jobs', searchParams, freshnessHours, experienceLevel],
    enabled: Boolean(searchParams),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      if (!searchParams) throw new Error('Search terms are required.');
      return searchLinkedInGuestJobs(
        {
          ...searchParams,
          freshnessHours,
          ...(experienceLevel ? { experienceLevel } : {}),
          start: pageParam,
        },
        { signal },
      );
    },
    getNextPageParam: (lastPage, _allPages, lastPageStart) =>
      lastPage.length > 0 && lastPageStart < MAX_LINKEDIN_START
        ? lastPageStart + LINKEDIN_PAGE_SIZE
        : undefined,
  });
  const loadedPageCount = search.data?.pages.length ?? 0;
  const resultsSessionKey = JSON.stringify([
    searchParams?.keywords ?? null,
    searchParams?.location ?? null,
    freshnessHours,
    experienceLevel,
  ]);
  const scrollAnchorRef = useRef<JobScrollAnchor | null>(null);
  const scrollAnchorSessionRef = useRef(resultsSessionKey);

  useEffect(() => {
    let frameId: number | null = null;
    const captureAnchor = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        scrollAnchorRef.current = getVisibleJobScrollAnchor();
        frameId = null;
      });
    };

    captureAnchor();
    window.addEventListener('scroll', captureAnchor, { passive: true });
    window.addEventListener('resize', captureAnchor);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', captureAnchor);
      window.removeEventListener('resize', captureAnchor);
    };
  }, []);

  useLayoutEffect(() => {
    if (scrollAnchorSessionRef.current !== resultsSessionKey) {
      scrollAnchorSessionRef.current = resultsSessionKey;
      scrollAnchorRef.current = getVisibleJobScrollAnchor();
      return;
    }

    if (search.data?.pages.length) {
      const previousAnchor = scrollAnchorRef.current;
      const anchoredCard = previousAnchor
        ? document.getElementById(`job-card-${previousAnchor.jobId}`)
        : null;

      if (previousAnchor && anchoredCard) {
        const positionChange =
          anchoredCard.getBoundingClientRect().top - previousAnchor.top;
        if (Math.abs(positionChange) > 1) window.scrollBy(0, positionChange);
      }
    }

    scrollAnchorRef.current = getVisibleJobScrollAnchor();
  }, [loadedPageCount, resultsSessionKey, search.data?.pages]);

  useEffect(() => {
    if (
      !searchParams ||
      loadedPageCount === 0 ||
      !search.hasNextPage ||
      search.isFetching ||
      search.isFetchNextPageError
    ) {
      return;
    }
    void search.fetchNextPage();
  }, [
    loadedPageCount,
    experienceLevel,
    freshnessHours,
    search.fetchNextPage,
    search.hasNextPage,
    search.isFetchNextPageError,
    search.isFetching,
    searchParams,
  ]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKeywords = keywords.trim();
    if (!trimmedKeywords) return;
    const trimmedLocation = location.trim();
    setSearchParams({
      keywords: trimmedKeywords,
      ...(trimmedLocation ? { location: trimmedLocation } : {}),
    });
  }

  const jobs = search.data?.pages.flatMap((page) => page) ?? [];
  const uniqueJobs = [...new Map(jobs.map((job) => [job.id, job])).values()];
  const freshestFirst = [...uniqueJobs].sort(
    (first, second) =>
      new Date(second.computedPostTime).getTime() -
      new Date(first.computedPostTime).getTime(),
  );
  const recentJobs = freshestFirst.filter(
    (job) => job.relativeAgeMs <= freshnessHours * 60 * 60 * 1000,
  );
  const visibleJobs = experienceLevel
    ? recentJobs.filter(
        (job) =>
          job.experienceLevelStatus === 'available' &&
          job.experienceLevel === experienceLevel,
      )
    : recentJobs;
  const lastPageIndex = loadedPageCount - 1;
  const lastPageStart = search.data?.pageParams[lastPageIndex];
  const lastPage = search.data?.pages[lastPageIndex];
  const reachedResultCap =
    lastPageStart === MAX_LINKEDIN_START && (lastPage?.length ?? 0) > 0;
  const collectionFinished =
    loadedPageCount > 0 &&
    !search.hasNextPage &&
    !search.isFetchingNextPage &&
    !search.isFetchNextPageError;

  return (
    <div className="page-shell">
      <header className="masthead">
        <div className="mx-auto flex h-[68px] max-w-5xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[15px] font-bold text-[hsl(var(--primary-foreground))]" aria-hidden="true">in</div>
            <span className="brand-mark text-[18px] font-extrabold tracking-tight">Fresh Jobs</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">LinkedIn guest search</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16 pt-9 sm:px-8 sm:pt-14">
        <section className="mb-8 max-w-2xl sm:mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">A fresher look at the feed</p>
          <h1 className="font-serif text-[clamp(2.35rem,7vw,4rem)] font-extrabold leading-[1.03] tracking-[-.055em] text-[hsl(var(--foreground))]">
            Find your next <span className="text-[hsl(var(--primary))]">good fit.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))]">
            Search public LinkedIn guest listings by role, skill, or phrase. Results can differ from LinkedIn’s signed-in feed.
          </p>
        </section>

        <form onSubmit={submitSearch} className="search-panel grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:grid-cols-[1.25fr_1fr_auto] sm:items-end sm:gap-3 sm:p-5" data-testid="form-job-search">
          <label className="block">
            <span className="mb-2 block text-xs font-bold tracking-wide text-[hsl(var(--foreground))]">Keywords <span className="text-[hsl(var(--primary))]">*</span></span>
            <span className="relative block">
              <Search size={17} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                required
                maxLength={150}
                placeholder="e.g. product designer"
                aria-label="Job keywords"
                className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] pl-10 pr-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
                data-testid="input-job-keywords"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold tracking-wide text-[hsl(var(--foreground))]">Location <span className="font-normal text-[hsl(var(--muted-foreground))]">optional</span></span>
            <span className="relative block">
              <MapPin size={17} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={120}
                placeholder="City, region, or remote"
                aria-label="Job location"
                className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] pl-10 pr-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
                data-testid="input-job-location"
              />
            </span>
          </label>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-95 sm:w-auto"
            data-testid="button-search-jobs"
          >
            <Search size={16} aria-hidden="true" />
            Search jobs
          </button>
        </form>

        <div className="mt-7 flex items-start gap-3 rounded-xl border border-[hsl(39_60%_76%)] bg-[hsl(42_78%_91%)] px-4 py-3.5 text-[hsl(30_42%_30%)]" role="note" data-testid="notice-estimated-time">
          <Clock3 size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs leading-5 sm:text-[13px]">
            <strong className="font-bold">Posting times are estimates.</strong> LinkedIn shows relative labels such as “2 hours ago”; the UTC time here is calculated from that label and the search time, not an exact timestamp.
          </p>
        </div>

        <section className="mt-10" aria-live="polite">
          {!searchParams && (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-6 py-12 text-center sm:py-16" data-testid="empty-search-prompt">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
                <BriefcaseBusiness size={20} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h2 className="font-serif text-xl font-bold tracking-tight">Start with a role or a skill</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Add a keyword above to see recent guest job listings and their relative posting times.</p>
            </div>
          )}

          {searchParams && !search.data && search.isFetching && (
            <div data-testid="loading-jobs" aria-label="Loading job listings">
              <div className="mb-4 flex items-center justify-between">
                <div className="skeleton h-5 w-40 rounded-md" />
                <div className="skeleton h-4 w-20 rounded-md" />
              </div>
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                    <div className="skeleton h-5 w-2/3 rounded-md" />
                    <div className="skeleton mt-3 h-4 w-1/3 rounded-md" />
                    <div className="skeleton mt-6 h-4 w-1/2 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchParams && search.isError && !search.data && !search.isFetching && (
            <div className="rounded-2xl border border-[hsl(2_50%_82%)] bg-[hsl(2_70%_97%)] p-6 sm:p-8" role="alert" data-testid="error-job-search">
              <div className="flex items-start gap-3">
                <TriangleAlert size={20} className="mt-0.5 shrink-0 text-[hsl(var(--destructive))]" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-lg font-bold">We couldn’t reach the listings</h2>
                  <p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">LinkedIn’s guest search may be temporarily unavailable. Give it another try in a moment.</p>
                  <button type="button" onClick={() => search.refetch()} className="mt-4 rounded-lg border border-[hsl(2_40%_78%)] bg-[hsl(var(--card))] px-4 py-2 text-sm font-bold text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))]" data-testid="button-retry-search">Try again</button>
                </div>
              </div>
            </div>
          )}

          {searchParams && search.data && (
            uniqueJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-6 py-12 text-center sm:py-16" data-testid="empty-job-results">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
                  <Search size={19} aria-hidden="true" />
                </div>
                <h2 className="font-serif text-xl font-bold tracking-tight">No recent matches this time</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Try a broader keyword or leave location blank to widen your search.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-serif text-xl font-bold tracking-tight" data-testid="text-results-heading">Recent listings</h2>
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]" data-testid="text-sort-order">Sorted by freshness · newest first</span>
                </div>
                <div className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-[1fr_240px] sm:items-end">
                    <div>
                      <p className="mb-2 text-xs font-bold tracking-wide text-[hsl(var(--foreground))]">Posted within</p>
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by estimated posting age" data-testid="group-freshness-filters">
                        {FRESHNESS_WINDOWS.map((hours) => {
                          const selected = freshnessHours === hours;
                          return (
                            <button
                              key={hours}
                              type="button"
                              aria-pressed={selected}
                              aria-label={`Show jobs estimated within ${hours} ${hours === 1 ? 'hour' : 'hours'}`}
                              onClick={() => setFreshnessHours(hours)}
                              className={`min-h-10 rounded-lg border px-3.5 text-sm font-bold transition ${
                                selected
                                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                  : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]'
                              }`}
                              data-testid={`button-freshness-${hours}h`}
                            >
                              {hours} {hours === 1 ? 'hour' : 'hours'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold tracking-wide text-[hsl(var(--foreground))]">Experience level</span>
                      <select
                        value={experienceLevel}
                        onChange={(event) => setExperienceLevel(event.target.value as ExperienceLevel | '')}
                        aria-label="Filter by experience level"
                        className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm font-semibold text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
                        data-testid="select-experience-level"
                      >
                        <option value="">Any experience</option>
                        {EXPERIENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 border-t border-[hsl(var(--border))] pt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p data-testid="text-freshness-count">
                        {visibleJobs.length} matching jobs · {uniqueJobs.length} loaded within the last {freshnessHours} {freshnessHours === 1 ? 'hour' : 'hours'}
                      </p>
                      {experienceLevel && (
                        <p className="mt-1" data-testid="text-experience-coverage">
                          {recentJobs.filter((job) => job.experienceLevelStatus !== 'available').length > 0
                            ? `Seniority is missing or unavailable for ${recentJobs.filter((job) => job.experienceLevelStatus !== 'available').length} recent listings; they are excluded from this filter.`
                            : 'Seniority levels are available for all loaded listings in this time window.'}
                        </p>
                      )}
                    </div>
                    <div className="sm:text-right" aria-live="polite" data-testid="text-auto-load-status">
                      {search.isFetchingNextPage
                        ? `Loading more results automatically · ${uniqueJobs.length} loaded`
                        : search.isFetchNextPageError
                          ? (
                            <span className="inline-flex flex-wrap items-center gap-2 text-[hsl(var(--destructive))]">
                              Couldn’t fetch the next page.
                              <button
                                type="button"
                                onClick={() => void search.fetchNextPage()}
                                className="font-bold underline underline-offset-2"
                                data-testid="button-retry-more-jobs"
                              >
                                Retry
                              </button>
                            </span>
                          )
                          : reachedResultCap
                            ? 'LinkedIn’s public result limit was reached; more jobs may exist.'
                            : collectionFinished
                              ? 'All available public guest pages are loaded.'
                              : 'Fetching all available public guest pages automatically…'}
                    </div>
                  </div>
                </div>
                {visibleJobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-6 py-10 text-center" data-testid="empty-freshness-results">
                    <h3 className="font-serif text-lg font-bold tracking-tight">
                      {experienceLevel ? 'No listings match this experience level' : 'No jobs in this time window'}
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                      {experienceLevel
                        ? 'Try another level, or choose “Any experience” to see all recent listings.'
                        : 'Choose a wider window to see older recent listings.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="list-job-results">
                    {visibleJobs.map((job) => <JobCard key={job.id} job={job} />)}
                  </div>
                )}
              </>
            )
          )}
        </section>
        <footer className="mt-12 border-t border-[hsl(var(--border))] pt-5 text-center text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          Listings link directly to LinkedIn. Times are indicative, not guarantees of when a role was posted.
        </footer>
      </main>
    </div>
  );
}

function JobCard({ job }: { job: LinkedInGuestJob }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const estimate = new Date(job.computedPostTime);
  const timeOptions: Intl.DateTimeFormatOptions = job.timePrecision === 'day'
    ? {}
    : {
        hour: 'numeric',
        ...(job.timePrecision !== 'hour' ? { minute: '2-digit' } : {}),
        ...(job.timePrecision === 'second' ? { second: '2-digit' } : {}),
        timeZone: 'UTC',
        timeZoneName: 'short',
      };
  const formattedEstimate = Number.isNaN(estimate.getTime())
    ? job.computedPostTime
    : new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
        ...timeOptions,
      }).format(estimate);

  return (
    <article
      id={`job-card-${job.id}`}
      data-job-id={job.id}
      className="job-card rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 sm:px-6 sm:py-5"
      data-testid={`card-job-${job.id}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            {job.companyLogoUrl && !logoFailed ? (
              <img
                src={job.companyLogoUrl}
                alt={`${job.company || 'Company'} logo`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="size-full object-contain p-1"
                data-testid={`img-company-logo-${job.id}`}
              />
            ) : (
              <Building2 size={20} className="text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg font-bold leading-snug tracking-[-.02em] text-[hsl(var(--foreground))]" data-testid={`text-job-title-${job.id}`}>{job.title}</h3>
            {job.companyProfileUrl ? (
              <a
                href={job.companyProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-semibold text-[hsl(var(--foreground))] underline-offset-2 hover:underline"
                data-testid={`link-company-${job.id}`}
              >
                {job.company || 'Company not listed'}
              </a>
            ) : (
              <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]" data-testid={`text-job-company-${job.id}`}>{job.company || 'Company not listed'}</p>
            )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[hsl(var(--muted-foreground))]">
            {job.location && <span className="inline-flex items-center gap-1.5" data-testid={`text-job-location-${job.id}`}><MapPin size={13} aria-hidden="true" />{job.location}</span>}
            <span className="inline-flex items-center gap-1.5" data-testid={`text-job-relative-${job.id}`}><Clock3 size={13} aria-hidden="true" />{job.rawRelative}</span>
            {job.jobInsight && <span className="inline-flex items-center rounded-full bg-[hsl(var(--primary)/.1)] px-2.5 py-1 font-semibold text-[hsl(var(--primary))]" data-testid={`text-job-insight-${job.id}`}>{job.jobInsight}</span>}
          </div>
          </div>
        </div>
        <a href={job.verifiedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-[hsl(var(--border))] px-3.5 text-xs font-bold text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]" data-testid={`link-job-${job.id}`}>
          View on LinkedIn <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[hsl(var(--border))] pt-3 text-xs">
        <span className="font-semibold text-[hsl(var(--foreground))]" data-testid={`text-job-estimate-${job.id}`}>Estimated {formattedEstimate}</span>
        <span className="text-[hsl(var(--muted-foreground))]">UTC · approximate from “{job.rawRelative}”</span>
        {job.rawDateOnly && <span className="text-[hsl(var(--muted-foreground))]">· LinkedIn date label: {job.rawDateOnly}</span>}
      </div>
    </article>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
