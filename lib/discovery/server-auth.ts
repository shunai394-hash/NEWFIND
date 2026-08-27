import { getRequestAuth } from "@/lib/auth/request-user";

export async function getDiscoveryAdminState(request?: Request) {
  const auth = await getRequestAuth(request);
  return { admin: auth.admin, email: auth.email, userId: auth.userId };
}
