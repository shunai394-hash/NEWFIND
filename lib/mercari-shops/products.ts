import { mercariShopsGraphQL } from "./client";

export type MercariShopProduct = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  imageUrls?: string[];
  status?: string | null;
  createdAt?: string | null;
};

type ProductsResponse = {
  products?: {
    edges?: Array<{
      node: MercariShopProduct;
    }>;
    pageInfo?: {
      endCursor?: string | null;
      hasNextPage?: boolean;
    };
  };
};

export async function listMercariShopProducts(options?: {
  first?: number;
  keyword?: string;
}) {
  const first = Math.min(Math.max(options?.first ?? 20, 1), 200);

  const query = `
    query Products($first: Int!, $keyword: String) {
      products(first: $first, keyword: $keyword) {
        edges {
          node {
            id
            name
            description
            price
            imageUrls
            status
            createdAt
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  const result = await mercariShopsGraphQL<ProductsResponse>(
    query,
    {
      first,
      keyword: options?.keyword ?? null,
    },
  );

  if (result.errors?.length) {
    throw new Error(
      `Mercari Shops GraphQL error: ${JSON.stringify(result.errors)}`,
    );
  }

  return result.data?.products ?? {
    edges: [],
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
  };
}
