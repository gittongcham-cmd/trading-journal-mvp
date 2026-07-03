import { EditAccountBalancePage } from "@/components/pages/EditAccountBalancePage";

export default function Page({ params }: { params: { id: string } }) {
  return <EditAccountBalancePage id={params.id} />;
}
