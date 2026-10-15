import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { List, ListRow } from "../ui/List";
import { DebtList } from "../../pages/DebtsPage";
import Covers, { useCovers } from "../calendar/Covers";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Home cards for the work on cases (2026-10-15):
//   OutcomesDueCard  hearings that took place with nobody writing how they
//                    went — one tap to the case to write it
//   DebtsCard        who's late or due this week on my cases (coordinators)
//   CoversCard       a lawyer away and who covers for them, while it lasts

const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function OutcomesDueCard({ team = false }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.outcomesDue(), []);
  const items = state.data?.items || [];
  if (items.length === 0) return null;
  return (
    <Card flush title={team ? t("outcomesDue.teamTitle", { count: items.length }) : t("outcomesDue.title", { count: items.length })} subtitle={t("outcomesDue.hint")}>
      <List plain inset={52}>
        {items.slice(0, 6).map((d) => (
          <ListRow
            key={d.id}
            to={`/clients/${d.case.clientId}?case=${d.case.id}&section=dates`}
            leading={<Icon name="briefcase" size={20} />}
            title={`${d.title || t(`caseWork.kinds.${d.kind}`)} · ${d.case.clientName}`}
            subtitle={[fmt.isoDateLong(d.date), d.time != null ? clock(d.time) : null, d.case.matter, d.place].filter(Boolean).join(" · ")}
            chevron
          />
        ))}
      </List>
    </Card>
  );
}

export function DebtsCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.debts(7), []);
  const items = (state.data?.items || []).filter((d) => d.group === "overdue" || d.group === "soon");
  if (!state.data || items.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{t("debts.homeTitle")}</h2>
        <Button size="small" variant="plain" to="/debts">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      </div>
      <DebtList data={{ ...state.data, items }} limit={3} />
    </div>
  );
}

export function CoversCard() {
  const state = useCovers();
  if (!state.data?.covers?.length) return null;
  return <Covers state={state} />;
}
