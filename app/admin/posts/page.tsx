import { AdminGate } from "@/components/admin-gate";
import { AdminPosts } from "@/components/admin-posts";

export default function AdminPostsPage() {
  return (
    <AdminGate>
      <AdminPosts />
    </AdminGate>
  );
}
