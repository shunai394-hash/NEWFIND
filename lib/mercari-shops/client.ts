export type MercariShopsGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{
    message?: string;
    extensions?: Record<string, unknown>;
  }>;
};

const MERCARI_SHOPS_API_URL =
  "https://api.mercari-shops.com/v1/graphql";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function mercariShopsGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<MercariShopsGraphQLResponse<T>> {
  const token = getEnv("MERCARI_ACCESS_TOKEN");
  const clientName = getEnv("MERCARI_API_CLIENT_NAME");

  const response = await fetch(MERCARI_SHOPS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `${clientName}/0.0.0`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const text = await response.text();

  let body: MercariShopsGraphQLResponse<T>;

  try {
    body = JSON.parse(text) as MercariShopsGraphQLResponse<T>;
  } catch {
    throw new Error(
      `Mercari Shops API returned HTTP ${response.status} with non-JSON response`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Mercari Shops API HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

