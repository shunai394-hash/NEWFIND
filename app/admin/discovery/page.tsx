import { DiscoveryAdminGate } from "@/components/discovery-admin-gate";
import { DiscoveryManager } from "@/components/discovery-manager";

export default function DiscoveryAdminPage() {
  return (
    <DiscoveryAdminGate>
      <DiscoveryManager />
    </DiscoveryAdminGate>
  );
}
