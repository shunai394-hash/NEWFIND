import { createSelfDeleteHandler } from "@/lib/account/delete-handlers";
import { deleteOwnedAccount } from "@/lib/account/delete-user";
import { requireUser } from "@/lib/auth/request-user";

export const dynamic = "force-dynamic";

const handleDelete = createSelfDeleteHandler({
  requireUser,
  deleteOwnAccount: deleteOwnedAccount,
});

export async function DELETE(request: Request) {
  return handleDelete(request);
}
