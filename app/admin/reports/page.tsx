import { AdminGate } from "@/components/admin-gate";
import { AdminReports } from "@/components/admin-reports";

export default function AdminReportsPage() {
  return (
    <AdminGate>
      <AdminReports />
    </AdminGate>
  );
}
