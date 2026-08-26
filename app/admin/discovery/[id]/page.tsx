import { DiscoveryAdminGate } from "@/components/discovery-admin-gate";
import { DiscoveryEditor } from "@/components/discovery-editor";

export default async function DiscoveryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DiscoveryAdminGate>
      <DiscoveryEditor id={id} />
    </DiscoveryAdminGate>
  );
}
