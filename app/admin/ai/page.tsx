import { AdminGate } from "@/components/admin-gate";
import { AiControlTower } from "@/components/ai-control-tower";

export default function AdminAiPage() {
  return (
    <AdminGate>
      <div className="px-4 py-4">
        <AiControlTower />
      </div>
    </AdminGate>
  );
}
