import { AppShellHeader } from "@spine/ui";
import { getSession } from "../../../../lib/get-session";
import { JobDetail } from "../job-detail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Jobs", href: "/jobs" }, { label: "Detail" }]} title="Job" />
      <JobDetail jobId={id} currentUserId={session?.user?.id ?? null} />
    </>
  );
}
