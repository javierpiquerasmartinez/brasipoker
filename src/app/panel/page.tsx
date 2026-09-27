import { getOrganizerEventsAction } from "./actions";
import { OrganizerDashboard } from "./organizer-dashboard";

export default async function PanelHomePage() {
  const res = await getOrganizerEventsAction();
  const initialUpcoming = res.success ? res.upcoming : [];
  const initialPast = res.success ? res.past : [];

  return (
    <OrganizerDashboard
      initialUpcoming={initialUpcoming}
      initialPast={initialPast}
    />
  );
}
