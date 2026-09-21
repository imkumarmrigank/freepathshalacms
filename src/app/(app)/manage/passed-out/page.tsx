import OffRollPage from "../suspended/OffRollPage";

export const metadata = { title: "Passed out students · Pehchaan" };

export default function PassedOutPage({
  searchParams,
}: { searchParams: Promise<{ center?: string; q?: string }> }) {
  return <OffRollPage status="graduated" searchParams={searchParams} />;
}
