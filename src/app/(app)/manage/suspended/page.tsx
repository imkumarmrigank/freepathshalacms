import OffRollPage from "./OffRollPage";

export const metadata = { title: "Suspended students · Pehchaan" };

export default function SuspendedPage({
  searchParams,
}: { searchParams: Promise<{ center?: string; q?: string }> }) {
  return <OffRollPage status="suspended" searchParams={searchParams} />;
}
