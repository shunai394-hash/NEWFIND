import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
  author?: {
    login?: string;
  } | null;
  repository?: {
    full_name?: string;
    html_url?: string;
    description?: string | null;
  } | null;
};

const DEFAULT_REPOSITORIES = [
  "openai/openai-cookbook",
  "huggingface/transformers",
  "huggingface/diffusers",
  "ollama/ollama",
  "langchain-ai/langchain",
  "microsoft/autogen",
  "vllm-project/vllm",
  "comfyanonymous/ComfyUI",
  "n8n-io/n8n",
  "home-assistant/core",
];

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function repositoryUrl(fullName: string): string {
  return `https://github.com/${fullName}`;
}

async function fetchReleases(
  repository: string,
  limit: number,
): Promise<GitHubRelease[]> {
  const url =
    `https://api.github.com/repos/${repository}/releases` +
    `?per_page=${Math.min(Math.max(limit, 1), 20)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "NEWFIND-World-Intelligence/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `GitHub releases failed for ${repository}: ${response.status}`,
    );
  }

  const data = (await response.json()) as unknown;

  if (!Array.isArray(data)) return [];

  return data as GitHubRelease[];
}

export const githubWorldSourceCollector: WorldSourceCollector = {
  source: "github",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(Math.max(context.limit ?? 5, 1), 20);
    const repositories = DEFAULT_REPOSITORIES;

    const batches = await Promise.all(
      repositories.map(async (repository) => {
        try {
          return await fetchReleases(repository, limit);
        } catch (error) {
          console.warn(
            "[world-source:github]",
            repository,
            error instanceof Error ? error.message : error,
          );
          return [];
        }
      }),
    );

    const items: WorldSourceItem[] = [];

    for (let i = 0; i < repositories.length; i += 1) {
      const repository = repositories[i];
      const releases = batches[i] ?? [];

      for (const release of releases) {
        if (release.draft) continue;
        if (!release.html_url) continue;

        const repositoryName =
          release.repository?.full_name || repository;

        const repositoryDescription =
          cleanText(release.repository?.description);

        const body = cleanText(release.body);
        const title =
          cleanText(release.name) ||
          `${repositoryName} ${release.tag_name}`;

        const snippet = [
          repositoryDescription,
          body,
          `Release ${release.tag_name}`,
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000);

        items.push({
          title,
          url: release.html_url,
          snippet,
          sourceType: "other",
          domain: "github.com",
          language: "en",
          sourceCountry: "US",
          publishedAt:
            release.published_at ||
            release.created_at ||
            null,
          sourceRole: "news",
          origin: "web",
          rawContent: body || null,
          sourceReliability: "official",
          retrievedAt: new Date().toISOString(),

          sourceName: "github",
          sourceRef: `${repositoryName}:release:${release.id}`,
          signalType: "software",

          metadata: {
            repository: repositoryName,
            repositoryUrl:
              release.repository?.html_url ||
              repositoryUrl(repositoryName),
            releaseId: release.id,
            tagName: release.tag_name,
            author: release.author?.login ?? null,
            prerelease: release.prerelease,
            source: "github_release",
          },
        });
      }
    }

    return items;
  },
};
