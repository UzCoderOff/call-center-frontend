import { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Badge from "../ui/Badge";
import { List, ListRow } from "../ui/List";
import { CloseSheet } from "./ClientWork";
import { personName } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { telHref } from "../../lib/format";
import { useI18n } from "../../i18n";

const SHOWN = 8;

// Home: what has to be done today (and what's late) — call the client back,
// call the father whose decision they were waiting for, collect documents —
// with a call button and "Done" right there. `team`: everyone's (managers),
// with whose it is.
export function FollowUpsCard({ team = false }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.followUps("today", team ? "team" : undefined), [team]);
  const [closing, setClosing] = useState(null);
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now());
  const list = state.data || [];
  if (list.length === 0) return null;
  const late = list.filter((f) => new Date(f.dueAt).getTime() < now).length;

  return (
    <Card
      flush
      title={team ? t("clientWork.home.teamTitle") : t("clientWork.home.title")}
      subtitle={late > 0 ? t("clientWork.home.late", { count: late }) : t("clientWork.home.subtitle")}
      action={<Badge tone={late > 0 ? "critical" : "neutral"}>{list.length}</Badge>}
    >
      <List plain>
        {(all ? list : list.slice(0, SHOWN)).map((f) => {
          const at = new Date(f.dueAt).getTime();
          const phone = f.contact?.phone || f.client.phones[0]?.phone;
          const tel = telHref(phone);
          const who = f.contact ? `${f.contact.name} (${t(`clientWork.relations.${f.contact.relation}`)})` : null;
          return (
            <ListRow
              key={f.id}
              to={`/clients/${f.client.id}`}
              title={f.client.name}
              subtitle={[t(`clientWork.kinds.${f.kind}`) + (who ? ` — ${who}` : ""), f.note].filter(Boolean).join(" · ")}
              footer={
                <>
                  <Badge tone={at < now ? "critical" : "warning"} icon="clock">
                    {at < now ? `${t("clientWork.late")} · ` : ""}
                    {at < now - 86400000 ? fmt.dateTime(at) : fmt.time(at)}
                  </Badge>
                  {team && f.assignee && <span>{personName(f.assignee)}</span>}
                </>
              }
              actions={
                <>
                  {tel && <Button size="small" variant="primary" icon="phone" href={tel} aria-label={t("common.call")} />}
                  <Button size="small" icon="check" onClick={() => setClosing(f)} aria-label={t("clientWork.done")} />
                </>
              }
            />
          );
        })}
      </List>
      {list.length > SHOWN && (
        <div style={{ padding: "4px 12px 12px" }}>
          <Button size="small" variant="plain" onClick={() => setAll(!all)}>
            {all ? t("clientWork.home.less") : `${t("common.seeAll")} (${list.length})`}
            {!all && <Icon name="chevronDown" size={15} />}
          </Button>
        </div>
      )}
      {closing && (
        <CloseSheet
          client={closing.client}
          item={closing}
          onClose={() => setClosing(null)}
          onSaved={() => {
            setClosing(null);
            state.reload();
          }}
        />
      )}
    </Card>
  );
}

// Home: open consultations nobody planned anything for — no next step, no
// appointment coming. Every open lead should have one; these slip away
// otherwise.
export function NoNextStepCard({ team = false }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.noNextStep(), []);
  const [open, setOpen] = useState(false);
  const list = state.data || [];
  if (list.length === 0) return null;
  const shown = open ? list : list.slice(0, 5);

  return (
    <Card
      flush
      title={t("clientWork.home.noNextTitle")}
      subtitle={t("clientWork.home.noNextHint")}
      action={<Badge tone="warning">{list.length}</Badge>}
    >
      <List plain>
        {shown.map((c) => {
          const tel = telHref(c.client.phones[0]?.phone);
          const since = c.consultationDate || c.startDate;
          return (
            <ListRow
              key={c.id}
              to={`/clients/${c.client.id}`}
              title={c.client.name}
              subtitle={[t(`cases.statuses.${c.status}`), c.matter, team && c.operator ? c.operator.name : null].filter(Boolean).join(" · ")}
              footer={since ? <span>{t("clientWork.home.since", { date: fmt.isoDay(since) })}</span> : null}
              actions={tel ? <Button size="small" icon="phone" href={tel} aria-label={t("common.call")} /> : null}
            />
          );
        })}
      </List>
      {list.length > 5 && (
        <div style={{ padding: "4px 12px 12px" }}>
          <Button size="small" variant="plain" onClick={() => setOpen(!open)}>
            {open ? t("clientWork.home.less") : `${t("common.seeAll")} (${list.length})`}
            {!open && <Icon name="chevronDown" size={15} />}
          </Button>
        </div>
      )}
    </Card>
  );
}
