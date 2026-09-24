import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

type HuggingFaceModel = {
  id: string;
  modelId?: string;
  pipeline_tag?: string | null;
  library_name?: string | null;
  tags?: string[];
  downloads?: number;
  likes?: number;
  createdAt?: string | null;
  lastModified?: string | null;
  private?: boolean;
};

type HuggingFaceSpace = {
  id: string;
  sdk?: string | null;
  likes?: number;
  createdAt?: string | null;
  lastModified?: string | null;
  private?: boolean;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "NEWFIND-World-Intelligence/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Hugging Face request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const huggingFaceWorldSourceCollector: WorldSourceCollector = {
  source: "hugging_face",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(Math.max(context.limit ?? 10, 1), 50);

    const [models, spaces] = await Promise.all([
      fetchJson<HuggingFaceModel[]>(
        `https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=${limit}`,
      ),
      fetchJson<HuggingFaceSpace[]>(
        `https://huggingface.co/api/spaces?sort=createdAt&direction=-1&limit=${limit}`,
      ),
    ]);

    const items: WorldSourceItem[] = [];

    for (const model of models) {
      if (!model.id || model.private) continue;

      const modelId = cleanText(model.modelId || model.id);
      const url = `https://huggingface.co/${modelId}`;

      items.push({
        title: modelId,
        url,
        snippet: [
          model.pipeline_tag ? `Pipeline: ${model.pipeline_tag}` : "",
          model.library_name ? `Library: ${model.library_name}` : "",
          model.tags?.length
            ? `Tags: ${model.tags.slice(0, 12).join(", ")}`
            : "",
          typeof model.downloads === "number"
            ? `Downloads: ${model.downloads}`
            : "",
          typeof model.likes === "number"
            ? `Likes: ${model.likes}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")
          .slice(0, 2000),
        sourceType: "other",
        domain: "huggingface.co",
        language: "en",
        sourceCountry: "US",
        publishedAt: model.createdAt || model.lastModified || null,
        sourceRole: "news",
        origin: "web",
        sourceReliability: "official",
        retrievedAt: new Date().toISOString(),

        sourceName: "hugging_face",
        sourceRef: `model:${modelId}`,
        signalType: "model",

        metadata: {
          kind: "model",
          modelId,
          pipelineTag: model.pipeline_tag ?? null,
          libraryName: model.library_name ?? null,
          tags: model.tags ?? [],
          downloads: model.downloads ?? null,
          likes: model.likes ?? null,
          createdAt: model.createdAt ?? null,
          lastModified: model.lastModified ?? null,
        },
      });
    }

    for (const space of spaces) {
      if (!space.id || space.private) continue;

      const spaceId = cleanText(space.id);
      const url = `https://huggingface.co/spaces/${spaceId}`;

      items.push({
        title: spaceId,
        url,
        snippet: [
          space.sdk ? `SDK: ${space.sdk}` : "",
          typeof space.likes === "number"
            ? `Likes: ${space.likes}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")
          .slice(0, 2000),
        sourceType: "other",
        domain: "huggingface.co",
        language: "en",
        sourceCountry: "US",
        publishedAt: space.createdAt || space.lastModified || null,
        sourceRole: "news",
        origin: "web",
        sourceReliability: "official",
        retrievedAt: new Date().toISOString(),

        sourceName: "hugging_face",
        sourceRef: `space:${spaceId}`,
        signalType: "service",

        metadata: {
          kind: "space",
          spaceId,
          sdk: space.sdk ?? null,
          likes: space.likes ?? null,
          createdAt: space.createdAt ?? null,
          lastModified: space.lastModified ?? null,
        },
      });
    }

    return items;
  },
};
