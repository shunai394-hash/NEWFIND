import { AdminGate } from "@/components/admin-gate";
import { AdminHome } from "@/components/admin-home";

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminHome />
    </AdminGate>
  );
}
