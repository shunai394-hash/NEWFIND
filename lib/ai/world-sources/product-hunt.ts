import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

type ProductHuntPost = {
  id: string;
  name: string;
  tagline: string;
  description?: string | null;
  url: string;
  website?: string | null;
  createdAt?: string | null;
  featuredAt?: string | null;
  votesCount?: number;
  commentsCount?: number;
  topics?: {
    edges?: Array<{
      node?: {
        name?: string | null;
      } | null;
    }>;
  } | null;
  thumbnail?: {
    url?: string | null;
  } | null;
};

type ProductHuntResponse = {
  data?: {
    posts?: {
      edges?: Array<{
        node?: ProductHuntPost | null;
      }>;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchProductHuntPosts(
  limit: number,
): Promise<ProductHuntPost[]> {
  const token =
    process.env.PRODUCT_HUNT_API_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "PRODUCT_HUNT_API_TOKEN is not configured",
    );
  }

  const query = `
    query LatestPosts($first: Int!) {
      posts(first: $first, order: NEWEST) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            website
            createdAt
            featuredAt
            votesCount
            commentsCount
            topics {
              edges {
                node {
                  name
                }
              }
            }
            thumbnail {
              url
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    "https://api.producthunt.com/v2/api/graphql",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "NEWFIND-World-Intelligence/1.0",
      },
      body: JSON.stringify({
        query,
        variables: {
          first: limit,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Product Hunt request failed: ${response.status}`,
    );
  }

  const result =
    (await response.json()) as ProductHuntResponse;

  if (result.errors?.length) {
    throw new Error(
      result.errors
        .map((error) => error.message)
        .filter(Boolean)
        .join("; "),
    );
  }

  return (
    result.data?.posts?.edges
      ?.map((edge) => edge.node)
      .filter(
        (post): post is ProductHuntPost =>
          Boolean(post?.id && post.name && post.url),
      ) ?? []
  );
}

export const productHuntWorldSourceCollector: WorldSourceCollector = {
  source: "product_hunt",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(
      Math.max(context.limit ?? 20, 1),
      50,
    );

    const posts =
      await fetchProductHuntPosts(limit);

    return posts.map((post) => {
      const topics =
        post.topics?.edges
          ?.map((edge) =>
            cleanText(edge.node?.name),
          )
          .filter(Boolean) ?? [];

      const tagline = cleanText(post.tagline);
      const description = cleanText(post.description);

      return {
        title: cleanText(post.name),
        url: post.url,
        snippet:
          `${tagline}${description ? ` — ${description}` : ""}`
            .trim()
            .slice(0, 2000),
        sourceType: "other" as const,
        domain: "producthunt.com",
        language: "en",
        sourceCountry: "US",
        publishedAt:
          post.featuredAt ||
          post.createdAt ||
          null,
        sourceRole: "news" as const,
        origin: "web" as const,
        rawContent:
          description || tagline || null,
        imageUrl:
          post.thumbnail?.url?.trim() || null,
        sourceReliability: "official",
        retrievedAt: new Date().toISOString(),

        sourceName: "product_hunt" as const,
        sourceRef: `producthunt:${post.id}`,
        signalType: "product" as const,

        metadata: {
          productHuntId: post.id,
          website: post.website ?? null,
          tagline,
          topics,
          votesCount: post.votesCount ?? 0,
          commentsCount: post.commentsCount ?? 0,
          createdAt: post.createdAt ?? null,
          featuredAt: post.featuredAt ?? null,
          source: "product_hunt_graphql",
        },
      };
    });
  },
};
