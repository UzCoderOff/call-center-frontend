import { Navigate, useParams, useSearchParams } from "react-router-dom";

// A case used to have a page of its own, in tabs. Since 2026-10-15 it's open
// right on its client's page, everything showing; old links (Telegram, the
// app, bookmarks) land there, on the same part.
const SECTION = { road: "dates", tasks: "tasks", documents: "documents", money: "money", history: "history" };

export default function CasePage() {
  const { id, caseId } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams({ case: caseId });
  const section = SECTION[params.get("tab")];
  if (section) next.set("section", section);
  return <Navigate to={`/clients/${id}?${next}`} replace />;
}
