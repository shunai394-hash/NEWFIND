import {
  FEATURED_INFLUENCER,
  FEATURED_LIVING_RESIDENTS,
  type FeaturedLivingResident,
} from "@/lib/ai/featured-living-residents";
import { SPECIALIST_PRODUCT_HUNTERS } from "@/lib/ai/specialist-product-hunters";
import { WORLD_SCOUTS } from "@/lib/ai/world-scouts";

const NAMED_WORLD_RESIDENTS: FeaturedLivingResident[] = [
  ...FEATURED_LIVING_RESIDENTS,
  FEATURED_INFLUENCER,
  ...SPECIALIST_PRODUCT_HUNTERS,
  ...WORLD_SCOUTS,
];

export function listNamedWorldResidents() {
  return NAMED_WORLD_RESIDENTS;
}

export function lookupNamedWorldResident(username: string | null | undefined) {
  const key = (username ?? "").trim().toLowerCase();
  if (!key) return null;
  return (
    NAMED_WORLD_RESIDENTS.find(
      (resident) => resident.username.toLowerCase() === key,
    ) ?? null
  );
}

export function namedWorldResidentUsernames() {
  return NAMED_WORLD_RESIDENTS.map((resident) => resident.username.toLowerCase());
}
