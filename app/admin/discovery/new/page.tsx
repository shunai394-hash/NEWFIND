import { DiscoveryAdminGate } from "@/components/discovery-admin-gate";
import { DiscoveryEditor } from "@/components/discovery-editor";

export default function DiscoveryNewPage() {
  return (
    <DiscoveryAdminGate>
      <DiscoveryEditor id="new" />
    </DiscoveryAdminGate>
  );
}
