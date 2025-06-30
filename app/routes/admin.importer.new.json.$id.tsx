import ImporterNotificationStatus from "~/domain/importer/components/importer-notification-status";
import JsonImporter from "~/domain/importer/components/json-importer";



export default function AdminImporterJSON() {
  return (
    <div className="flex flex-col rounded-md border p-4 gap-6" >
      <ImporterNotificationStatus status={notification.status} message={notification.message} />
      <JsonImporter
        importProfileId={importProfileId}
        description={description}
        setNotification={setNotification} submisionStatus={submissionStatus} setSubmissionStatus={setSubmissionStatus} />
    </div>
  )
}