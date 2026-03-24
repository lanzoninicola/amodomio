import {
  AsyncJobsRecentPage,
  useAdminAsyncJobsOutletContext,
} from "~/domain/async-jobs/admin-async-jobs-ui";

export default function AdminAsyncJobsRecentRoute() {
  const { runningJobs } = useAdminAsyncJobsOutletContext();
  return <AsyncJobsRecentPage runningJobsCount={runningJobs.length} />;
}
