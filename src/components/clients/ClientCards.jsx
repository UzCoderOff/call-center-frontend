import { useState } from "react";
import styles from "./Clients.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Badge from "../ui/Badge";
import { List, ListRow } from "../ui/List";
import { Meter } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { telHref } from "../../lib/format";
import { useI18n } from "../../i18n";

// This month's consultations and contracts against the targets (Settings ->
// Positions). Staff see their own bars; managers one row per operator.
export function TargetsCard({ manager }) {
  const { t } = useI18n();
  const state = useAsync(() => api.clientTargets(), []);
  const rows = state.data?.rows || [];
  if (rows.length === 0) return null;
  const monthName = (() => {
    const [y, m] = state.data.month.split("-").map(Number);
    return `${t("time.months")[m - 1]} ${y}`;
  })();

  return (
    <Card title={t("clients.targets")} subtitle={monthName}>
      <div className={styles.targets}>
        {rows.map((r) => (
          <div key={r.employee.id} className={`${styles.targetRow} ${manager ? styles.withName : ""}`}>
            {manager && <span className={styles.targetName}>{r.employee.name}</span>}
            <Meter label={t("clients.consultations")} done={r.consultations} target={r.targetConsultations} />
            <Meter label={t("clients.contracts")} done={r.contracts} target={r.targetContracts} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// Home: clients to call today (and overdue ones), with a call button and
// "done" right there.
export function CallTodayCard() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.clients({ filter: "callToday" }), []);
  const [busy, setBusy] = useState(null);
  const [now] = useState(() => Date.now());
  const list = state.data?.clients || [];
  if (list.length === 0) return null;

  async function done(client) {
    setBusy(client.id);
    try {
      await api.updateClient(client.id, { nextCallAt: null, nextCallNote: null });
      state.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      flush
      title={t("clients.callToday")}
      action={
        <Button size="small" variant="plain" to="/clients?filter=callToday">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <List plain>
        {list.slice(0, 6).map((c) => {
          const at = new Date(c.nextCallAt).getTime();
          const tel = telHref(c.phone);
          return (
            <ListRow
              key={c.id}
              to={`/clients/${c.id}`}
              title={c.name}
              subtitle={c.nextCallNote || c.phone || ""}
              footer={
                <Badge tone={at < now ? "critical" : "warning"} icon="clock">
                  {at < now ? t("clients.overdue") : ""} {fmt.time(at)}
                </Badge>
              }
              actions={
                <>
                  {tel && <Button size="small" variant="primary" icon="phone" href={tel} aria-label={t("common.call")} />}
                  <Button size="small" icon="check" busy={busy === c.id} onClick={() => done(c)} aria-label={t("clients.callDone")} />
                </>
              }
            />
          );
        })}
      </List>
    </Card>
  );
}
