import { useSearchParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import Segmented from "../components/ui/Segmented";
import { PageHeader } from "../components/ui/Misc";
import { SummariesList, SummaryStrikesCard } from "../components/consultations/Summaries";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useI18n } from "../i18n";

// Consultation summaries still to write (/consultations): one's own — or,
// for managers, everyone's — and this month's ones written too late.
export default function ConsultationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const manager = isManagerRole(user.role);
  const [params, setParams] = useSearchParams();
  const team = manager && params.get("scope") === "team";
  return (
    <div>
      <PageHeader title={t("summary.listTitle")} subtitle={t("summary.listSubtitle")} />
      {manager && (
        <div className={pageStyles.bannerSpace}>
          <Segmented
            value={team ? "team" : "mine"}
            onChange={(v) => setParams(v === "team" ? { scope: "team" } : {}, { replace: true })}
            label={t("summary.listTitle")}
            options={[
              { value: "mine", label: t("summary.mine") },
              { value: "team", label: t("summary.team") },
            ]}
          />
        </div>
      )}
      <div className={pageStyles.stack}>
        <SummariesList team={team} />
        <SummaryStrikesCard manager={manager} />
      </div>
    </div>
  );
}
