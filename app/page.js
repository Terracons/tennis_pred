import model from "../data/model.json";
import Dashboard from "./dashboard";
import { getCurrentModel } from "../lib/current-history.mjs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function Page() {
  try {
    return <Dashboard model={await getCurrentModel(model)} />;
  } catch {
    return (
      <Dashboard
        model={model}
        historyError="Current history could not be refreshed. The saved snapshot is displayed for reference; new predictions are unavailable until the feed recovers."
      />
    );
  }
}
