import model from "../data/model.json";
import Dashboard from "./dashboard";
export default function Page() {
  return <Dashboard model={model} />;
}
