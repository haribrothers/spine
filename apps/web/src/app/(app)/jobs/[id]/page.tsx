import { Suspense } from "react";
import { getSession } from "../../../../lib/get-session";
import { JobDetail } from "../job-detail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    // US-JOB-34: the job renders its own header, with its number as the page title.
    // JobDetail reads ?tab= (notification deep links) via useSearchParams, which requires a Suspense boundary.
    <Suspense>
      <JobDetail jobId={id} currentUserId={session?.user?.id ?? null} />
    </Suspense>
  );
}
