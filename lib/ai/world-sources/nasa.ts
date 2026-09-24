import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

type NasaApodItem = {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: string;
  service_version?: string;
  copyright?: string;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchApod(
  startDate: string,
  endDate: string,
): Promise<NasaApodItem[]> {
  const url =
    "https://api.nasa.gov/planetary/apod" +
    "?api_key=DEMO_KEY" +
    `&start_date=${encodeURIComponent(startDate)}` +
    `&end_date=${encodeURIComponent(endDate)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "NEWFIND-World-Intelligence/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `NASA APOD request failed: ${response.status}`,
    );
  }

  const data = (await response.json()) as unknown;

  if (Array.isArray(data)) {
    return data as NasaApodItem[];
  }

  return [data as NasaApodItem];
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export const nasaWorldSourceCollector: WorldSourceCollector = {
  source: "nasa",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(
      Math.max(context.limit ?? 7, 1),
      30,
    );

    const endDate = new Date()
      .toISOString()
      .slice(0, 10);

    const startDate = dateDaysAgo(limit - 1);

    const entries = await fetchApod(
      startDate,
      endDate,
    );

    return entries
      .filter(
        (entry) =>
          entry.title &&
          entry.url &&
          entry.media_type === "image",
      )
      .sort((a, b) =>
        String(b.date).localeCompare(String(a.date)),
      )
      .slice(0, limit)
      .map((entry) => {
        const title = cleanText(entry.title);
        const explanation = cleanText(entry.explanation);

        return {
          title,
          url: entry.url,
          snippet: explanation.slice(0, 2000),
          sourceType: "other" as const,
          domain: "nasa.gov",
          language: "en",
          sourceCountry: "US",
          publishedAt: entry.date
            ? `${entry.date}T00:00:00Z`
            : null,
          sourceRole: "news" as const,
          origin: "web" as const,
          rawContent: explanation || null,
          sourceReliability: "official",
          retrievedAt: new Date().toISOString(),

          sourceName: "nasa" as const,
          sourceRef: `apod:${entry.date}`,
          signalType: "space" as const,

          metadata: {
            kind: "nasa_apod",
            date: entry.date,
            hdUrl: entry.hdurl ?? null,
            mediaType: entry.media_type,
            copyright: entry.copyright ?? null,
            serviceVersion:
              entry.service_version ?? null,
            officialPage: entry.url,
          },
        };
      });
  },
};
