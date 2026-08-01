import OperatorOrderDetail from "./OperatorOrderDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OperatorOrderPage({ params }: PageProps) {
  const { id } = await params;
  return <OperatorOrderDetail orderId={id} />;
}
