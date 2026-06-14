import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";

export default function PermissionsNeedsReviewPage() {
  return (
    <div className="page-chrome">
      <PageHeader
        title="Permissions configs to review"
        subtitle="No local permission config entries need review across your harnesses."
      />
      <div className="empty-panel">
        <h3 className="empty-panel__title">No permissions need review</h3>
        <p className="empty-panel__body">
          Your harness configs only reference permissions that skill-manager already tracks.
        </p>
        <div className="empty-panel__actions">
          <Link to="/permissions/use" className="action-pill action-pill--md action-pill--accent">
            View Permissions in Use
          </Link>
        </div>
      </div>
    </div>
  );
}
