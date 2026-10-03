import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "../components/clients/Clients.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Segmented from "../components/ui/Segmented";
import { SelectField, TextAreaField, TextField } from "../components/ui/Field";
import { AsyncBoundary, Banner, EmptyState, KeyValue, PageHeader } from "../components/ui/Misc";
import { personName } from "../components/clients/parts";
import CasePanel from "../components/clients/CaseWork";
import { CaseSheet, ClientSheet, LinkSheet, MergeSheet, PaymentSheet } from "../components/clients/ClientSheets";
import { ContactsCard, FilesCard, NextSteps } from "../components/clients/ClientWork";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { telHref } from "../lib/format";
import { useI18n } from "../i18n";
import { saveFailed } from "../lib/saveFailed";
import { TaskSheet } from "../components/tasks/TaskParts";
import ScheduleSheet from "../components/clients/ScheduleSheet";
import { canBookAppointments } from "../lib/access";

// One client: who they are, the people on their cases, each case's way
// (milestones, stage history with dates, key dates, money), connected
// people, and everything that happened in one timeline — notes, calls,
// appointments, payments, every change. What's shown and what can be done
// follow the person looking (the server shapes it; see the backend's
// src/lib/clientAccess.js). An operator whose client signed sees just the
// result: who, when, and their own calls.
export default function ClientPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const goBack = useBack("/clients");
  const state = useAsync(() => api.client(id), [id]);

  if (state.error?.status === 404) {
    return <PageHeader back={{ label: t("clients.title"), onClick: goBack }} title={t("clients.notFound")} />;
  }
  return (
    <AsyncBoundary state={state}>
      {(client) => (client.view === "result" ? <ResultView client={client} reload={state.reload} goBack={goBack} /> : <ClientView client={client} reload={state.reload} goBack={goBack} />)}
    </AsyncBoundary>
  );
}

// ------------------------------------------------------------ result
// The client signed thanks to this operator; the case is the coordinator's
// now. What's theirs to see: who, the dates, their own calls and bookings.
// Back with something new: a new matter (a consultation again — theirs).
function ResultView({ client, reload, goBack }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [adding, setAdding] = useState(false);
  const tel = telHref(client.phones[0]?.phone);
  const mayBook = canBookAppointments(user) && !client.archivedAt;
  const bookUrl = `/calendar?${new URLSearchParams({ clientId: client.id, name: client.name, ...(client.phones[0] ? { phone: client.phones[0].phone } : {}) })}`;
  return (
    <div>
      <PageHeader
        back={{ label: t("clients.title"), onClick: goBack }}
        title={client.name}
        subtitle={client.phones.map((p) => fmt.phone(p.phone)).join(" · ")}
        actions={
          <>
            {tel && (
              <Button variant="primary" icon="phone" href={tel}>
                {t("common.call")}
              </Button>
            )}
            {mayBook && (
              <Button icon="calendar" to={bookUrl}>
                {t("clients.bookConsultation")}
              </Button>
            )}
            <Button icon="plus" onClick={() => setAdding(true)}>
              {t("clients.newMatter")}
            </Button>
          </>
        }
      />
      {adding && (
        <CaseSheet
          clientId={client.id}
          canManage={false}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      <div className={pageStyles.bannerSpace}>
        <Banner icon="checkCircle">
          <strong>{t("clients.result.title")}</strong>
          <div className={pageStyles.bannerDetail}>{t("clients.result.text")}</div>
        </Banner>
      </div>
      <div className={styles.layout}>
        <div className={styles.column}>
          {client.results.map((r) => (
            <Card key={r.id} title={t("clients.result.cardTitle")}>
              <KeyValue label={t("caseWork.milestones.start")}>{r.startDate ? fmt.isoDateLong(r.startDate) : "—"}</KeyValue>
              <KeyValue label={t("caseWork.milestones.consultation")}>{r.consultationDate ? fmt.isoDateLong(r.consultationDate) : "—"}</KeyValue>
              <KeyValue label={t("caseWork.milestones.contract")}>{r.contractDate ? fmt.isoDateLong(r.contractDate) : "—"}</KeyValue>
              <KeyValue label={t("cases.coordinator")}>{r.coordinator || t("caseWork.notAssigned")}</KeyValue>
              {r.coordinator && <p className={pageStyles.note}>{t("clients.result.askCoordinator", { name: r.coordinator })}</p>}
            </Card>
          ))}
        </div>
        <div className={styles.column}>
          <Card title={t("clients.result.history")}>
            <ResultHistory client={client} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultHistory({ client }) {
  const { t, fmt } = useI18n();
  const items = [
    ...client.calls.map((c) => ({
      key: `c${c.id}`,
      at: Number(c.callTimestampMs),
      icon: c.missed ? "phoneMissed" : c.callType === "outgoing" ? "phoneOutgoing" : "phoneIncoming",
      title: c.missed ? t("clients.events.missedCall") : t("clients.events.call", { type: t(`callType.${c.callType}`), duration: fmt.duration(c.durationSeconds) }),
      sub: fmt.dateTime(Number(c.callTimestampMs)),
      to: `/calls/${c.id}`,
    })),
    ...client.appointments.map((a) => {
      const [y, m, d] = a.date.split("-").map(Number);
      return {
        key: `a${a.id}`,
        at: new Date(y, m - 1, d, Math.floor(a.start / 60), a.start % 60).getTime(),
        icon: "calendar",
        title: `${t("clients.events.appointment", { calendar: a.calendar?.name || "" })} · ${t(`calendar.appointmentStatus.${a.status}`)}`,
        sub: `${fmt.isoDay(a.date)}, ${fmt.minutes(a.start)}`,
      };
    }),
  ].sort((a, b) => b.at - a.at);
  if (items.length === 0) return <p className={pageStyles.note}>{t("clients.timelineEmpty")}</p>;
  return <TimelineList items={items} />;
}

// -------------------------------------------------------------- full
function ClientView({ client, reload, goBack }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null); // { type, ...props }
  const close = () => setSheet(null);
  const lawyer = client.level === "lawyer";
  // A consultation is usually a visit to the lawyer: offer to book it (it's
  // optional — "Hozir emas" just closes the offer).
  const [params, setParams] = useSearchParams();
  const mayBook = canBookAppointments(user) && !client.archivedAt && !lawyer;
  const askBook = mayBook && params.get("ask") === "book";
  const bookUrl = `/calendar?${new URLSearchParams({ clientId: client.id, name: client.name, ...(client.phones[0] ? { phone: client.phones[0].phone } : {}) })}`;
  const dismissAsk = () => {
    const next = new URLSearchParams(params);
    next.delete("ask");
    setParams(next, { replace: true });
  };
  const saved = () => {
    setSheet(null);
    reload();
  };
  const tel = telHref(client.phones[0]?.phone);

  // Archiving hides the client from lists; everything is kept and it can be
  // restored from the "Archive" filter.
  async function archive() {
    if (!confirm(t("clients.confirmArchive", { name: client.name }))) return;
    try {
      await api.archiveClient(client.id);
      navigate("/clients", { replace: true });
    } catch (err) {
      saveFailed(err, t);
    }
  }

  async function restore() {
    try {
      await api.restoreClient(client.id);
      reload();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  async function removePayment(p) {
    if (!confirm(t("payments.confirmDelete"))) return;
    try {
      await api.deletePayment(p.id);
      reload();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  const sub = [client.city, client.source && t(`clients.sources.${client.source}`), t("clients.addedOn", { date: fmt.date(new Date(client.createdAt).getTime()) })]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        back={{ label: t("clients.title"), onClick: goBack }}
        title={client.name}
        subtitle={sub}
        actions={
          <>
            {tel && (
              <Button variant="primary" icon="phone" href={tel}>
                {t("common.call")}
              </Button>
            )}
            {mayBook && (
              <Button icon="calendar" to={bookUrl}>
                {t("clients.bookConsultation")}
              </Button>
            )}
            {client.canManage && (
              <Button icon="checkCircle" onClick={() => setSheet({ type: "task" })}>
                {t("tasks.giveForClient")}
              </Button>
            )}
            {client.canEdit && (
              <Button icon="sliders" onClick={() => setSheet({ type: "client" })}>
                {t("clients.edit")}
              </Button>
            )}
          </>
        }
      />

      {askBook && (
        <div className={pageStyles.bannerSpace}>
          <Banner
            icon="calendar"
            action={
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button size="small" variant="primary" to={bookUrl}>
                  {t("clients.askBookYes")}
                </Button>
                <Button size="small" onClick={dismissAsk}>
                  {t("clients.askBookNo")}
                </Button>
              </span>
            }
          >
            <strong>{t("clients.askBookTitle")}</strong>
            <div className={pageStyles.bannerDetail}>{t("clients.askBookText")}</div>
          </Banner>
        </div>
      )}
      {client.archivedAt && (
        <div className={pageStyles.bannerSpace}>
          <Banner
            tone="warning"
            icon="minusCircle"
            action={
              client.canManage && (
                <Button size="small" variant="primary" onClick={restore}>
                  {t("clients.restore")}
                </Button>
              )
            }
          >
            {t("clients.archivedNote", { date: fmt.date(new Date(client.archivedAt).getTime()) })}
          </Banner>
        </div>
      )}
      <div className={styles.layout}>
        <div className={styles.column}>
          <NextSteps client={client} onChanged={reload} />

          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{lawyer ? t("lawyer.yourCases") : t("cases.title")}</h2>
            {!lawyer && (
              <Button size="small" icon="plus" onClick={() => setSheet({ type: "case" })}>
                {client.results?.length ? t("clients.newMatter") : t("cases.add")}
              </Button>
            )}
          </div>
          {client.cases.length === 0 ? (
            <EmptyState icon="briefcase" text={t("cases.empty")} />
          ) : (
            client.cases.map((c) => (
              <CasePanel
                key={c.id}
                item={c}
                client={client}
                onChanged={reload}
                onEdit={() => setSheet({ type: "case", item: c })}
                onPay={!lawyer && c.permissions?.role !== "result" ? () => setSheet({ type: "payment", caseId: c.id }) : null}
                onSchedule={() => setSheet({ type: "schedule", item: c })}
                onRemovePayment={removePayment}
              />
            ))
          )}

          {client.results?.length > 0 && (
            <Card title={t("clients.result.earlier")} subtitle={t("clients.result.earlierHint")}>
              {client.results.map((r) => (
                <KeyValue key={r.id} label={r.contractDate ? t("clients.signedOn", { date: fmt.isoDateLong(r.contractDate) }) : t("cases.statuses.contract")}>
                  {r.coordinator ? t("clients.coordinatorIs", { name: r.coordinator }) : t("caseWork.notAssigned")}
                </KeyValue>
              ))}
            </Card>
          )}

          <FilesCard client={client} onChanged={reload} />
          {!lawyer && <Connections client={client} onAdd={() => setSheet({ type: "link" })} onChanged={reload} />}
        </div>

        <div className={styles.column}>
          <Card title={t("clients.details")}>
            {client.phones.map((p) => (
              <div key={p.id} className={styles.phoneRow}>
                <Icon name="phone" size={16} />
                <a href={telHref(p.phone) || undefined}>{fmt.phone(p.phone)}</a>
              </div>
            ))}
            {client.email && <KeyValue label={t("clients.email")}>{client.email}</KeyValue>}
            <KeyValue label={t("clients.idLabel")}>#{client.id}</KeyValue>
            {client.createdBy && <KeyValue label={t("clients.addedBy")}>{personName(client.createdBy)}</KeyValue>}
            {client.notes && <p className={pageStyles.note} style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{client.notes}</p>}
            <KeepOutOfArchive client={client} onChanged={reload} />
          </Card>
          <ContactsCard client={client} onChanged={reload} />
          <Activity client={client} userId={user.id} onChanged={reload} />
          {client.canManage && (
            <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
              <Button icon="link" onClick={() => setSheet({ type: "merge" })}>
                {t("clients.merge")}
              </Button>
              {!client.archivedAt && (
                <Button variant="destructive" icon="minusCircle" onClick={archive}>
                  {t("clients.archive")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {sheet?.type === "client" && <ClientSheet client={client} onClose={close} onSaved={saved} />}
      {sheet?.type === "case" && (
        <CaseSheet
          clientId={client.id}
          item={sheet.item}
          canManage={client.canManage}
          finance={sheet.item ? Boolean(sheet.item.permissions?.money && client.finance) : client.finance}
          onClose={close}
          onSaved={(result) => {
            saved();
            // A new consultation: offer to book the visit too.
            if (!sheet.item && result?.status === "consultation" && mayBook) setParams({ ask: "book" }, { replace: true });
          }}
        />
      )}
      {sheet?.type === "schedule" && <ScheduleSheet item={sheet.item} onClose={close} onSaved={saved} />}
      {sheet?.type === "payment" && (
        <PaymentSheet
          clientId={client.id}
          cases={client.cases}
          caseId={sheet.caseId}
          finance={Boolean(client.cases.find((c) => c.id === sheet.caseId)?.permissions?.canPay)}
          onClose={close}
          onSaved={saved}
        />
      )}
      {sheet?.type === "link" && <LinkSheet client={client} onClose={close} onSaved={saved} />}
      {sheet?.type === "merge" && <MergeSheet client={client} onClose={close} onSaved={saved} />}
      {sheet?.type === "task" && <TaskSheet client={{ id: client.id, name: client.name }} onClose={close} onSaved={close} />}
    </div>
  );
}

const LINK_LABEL = (link) => (link.kind === "referral" ? (link.direction === "to" ? "referredBy" : "referred") : link.kind);

function Connections({ client, onAdd, onChanged }) {
  const { t, fmt } = useI18n();
  async function remove(link) {
    if (!confirm(t("links.confirmRemove", { name: link.other.name }))) return;
    try {
      await api.deleteLink(link.id);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }
  return (
    <Card
      title={t("links.title")}
      action={
        client.canEdit && (
          <Button size="small" icon="plus" onClick={onAdd}>
            {t("links.add")}
          </Button>
        )
      }
    >
      {client.links.length === 0 ? (
        <p className={pageStyles.note}>{t("links.empty")}</p>
      ) : (
        client.links.map((l) => (
          <div key={l.id} className={styles.link}>
            {l.other.restricted ? (
              <span className={styles.linkMain}>
                <span className={styles.linkName}>{t("clients.othersClient")}</span>
              </span>
            ) : (
              <Link to={`/clients/${l.other.id}`} className={styles.linkMain}>
                <span className={styles.chip}>
                  {t(`links.kinds.${LINK_LABEL(l)}`)}
                  {l.label && l.direction === "from" ? ` · ${l.label}` : ""}
                </span>
                <span className={styles.linkName}>
                  {l.other.name}
                  {l.other.archived ? ` · ${t("links.archived")}` : ""}
                </span>
                <span className={styles.linkSub}>
                  {[l.other.phone && fmt.phone(l.other.phone), l.other.status && t(`cases.statuses.${l.other.status}`)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            )}
            {client.canEdit && (
              <button type="button" className={styles.iconButton} onClick={() => remove(l)} aria-label={t("links.remove")}>
                <Icon name="x" size={15} />
              </button>
            )}
          </div>
        ))
      )}
    </Card>
  );
}

// ------------------------------------------------------- automatic archive
// A consultation that goes quiet goes to the archive by itself (backend:
// services/clientArchive.js). "Arxivga tushmasin" keeps it out until a date:
// we may still work with them.
const CONTRACT = ["contract", "done"];
const KEEP_FOR = [
  ["2w", 14],
  ["1m", 30],
  ["3m", 91],
];

function KeepOutOfArchive({ client, onChanged }) {
  const { t, fmt } = useI18n();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const consulting = !client.archivedAt && !client.cases.some((k) => CONTRACT.includes(k.status)) && !client.results?.length;
  if (!consulting || !client.canEdit) return null;
  const kept = client.keepUntil && new Date(client.keepUntil).getTime() > Date.now() ? client.keepUntil : null;

  async function save(until) {
    setBusy(true);
    try {
      await api.updateClient(client.id, { keepUntil: until });
      setOpen(false);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }
  const inDays = (n) => {
    const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <KeyValue label={t("clients.keep.label")}>{kept ? t("clients.keep.until", { date: fmt.date(new Date(kept).getTime()) }) : t("clients.keep.auto")}</KeyValue>
      {open ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {KEEP_FOR.map(([key, days]) => (
            <Button key={key} size="small" busy={busy} onClick={() => save(inDays(days))}>
              {t(`clients.keep.for.${key}`)}
            </Button>
          ))}
          <TextField type="date" label={t("clients.keep.date")} value={date} min={inDays(1)} onChange={(e) => setDate(e.target.value)} />
          <Button size="small" variant="primary" disabled={!date} busy={busy} onClick={() => save(date)}>
            {t("common.save")}
          </Button>
          <Button size="small" variant="plain" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button size="small" icon="clock" onClick={() => setOpen(true)}>
            {kept ? t("clients.keep.change") : t("clients.keep.button")}
          </Button>
          {kept && (
            <Button size="small" variant="plain" busy={busy} onClick={() => save(null)}>
              {t("clients.keep.off")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ activity
const CALL_ICON ={ incoming: "phoneIncoming", outgoing: "phoneOutgoing" };
const EVENT_ICON = {
  import: "upload",
  note: "note",
  archive: "minusCircle",
  keep: "clock",
  restore: "refresh",
  merge: "link",
  status: "checkCircle",
  stage: "briefcase",
  stage_row: "briefcase",
  date_row: "calendar",
  assign: "users",
  case_edit: "edit",
  case: "plus",
  follow_up: "bell",
  contact: "user",
  file: "file",
  lost: "minusCircle",
};
// Which filter each kind of entry belongs to.
const GROUP = { note: "notes", call: "calls", appointment: "appointments", payment: "money" };
// How a talk happened, when it wasn't a call in Ledger.
const CHANNELS = ["", "telegram", "meeting", "phone", "sms"];
const CHANNEL_ICON = { telegram: "send", meeting: "users", phone: "smartphone", sms: "note" };
const FILTERS = ["all", "notes", "calls", "case", "money", "appointments"];

// One line of the timeline for a recorded change, in words.
function useEventText() {
  const { t, fmt } = useI18n();
  return (e) => {
    const d = e.data || {};
    const [from, to] = (e.text || "").split(">");
    switch (e.kind) {
      case "status":
        return t("clients.events.status", { from: from ? t(`cases.statuses.${from}`) : "—", to: to ? t(`cases.statuses.${to}`) : "—" });
      case "stage":
        return t("clients.events.stage", { from: from ? t(`cases.stages.${from}`) : "—", to: to ? t(`cases.stages.${to}`) : "—" });
      case "stage_row":
        if (d.action === "clear") return t("caseWork.events.stageClear");
        return t(`caseWork.events.stage_${d.action}`, { stage: d.stage ? t(`cases.stages.${d.stage}`) : "—", date: d.date ? fmt.isoDateLong(d.date) : "—" });
      case "date_row":
        return t(`caseWork.events.date_${d.action}`, { title: d.title || t(`caseWork.kinds.${d.kind || "other"}`), date: d.date ? fmt.isoDateLong(d.date) : "—", outcome: d.outcome || "" });
      case "assign":
        return d.to ? t("caseWork.events.assign", { role: t(`cases.${d.role}`), name: d.to }) : t("caseWork.events.unassign", { role: t(`cases.${d.role}`), name: d.from || "—" });
      case "case_edit":
        return t("caseWork.events.edit", {
          fields: (d.changes || []).map((c) => `${t(`caseWork.fields.${c.field}`)}: ${showValue(c.from, fmt)} → ${showValue(c.to, fmt)}`).join("; "),
        });
      case "case":
        return t("clients.events.case", { text: e.text || "—" });
      case "archive":
        return d.auto ? t("clients.events.archiveAuto", { days: d.days }) : t("clients.events.archive");
      case "keep":
        return d.until ? t("clients.events.keep", { date: fmt.isoDateLong(d.until) }) : t("clients.events.keepOff");
      case "restore":
        return t("clients.events.restore");
      case "merge":
        return t("clients.events.merge", { name: e.text });
      case "follow_up": {
        const what = t(`clientWork.kinds.${d.kind || "other"}`);
        const who = d.contact ? ` — ${d.contact.name} (${t(`clientWork.relations.${d.contact.relation}`)})` : "";
        const when = d.dueAt ? fmt.dateTime(new Date(d.dueAt).getTime()) : "";
        if (d.action === "done") return `${t("clientWork.events.done", { what, when })}${who}${d.outcome ? ` — ${t(`clientWork.outcomes.${d.outcome}`)}` : ""}${d.outcomeNote ? `: ${d.outcomeNote}` : ""}`;
        if (d.action === "cancel") return t("clientWork.events.cancel", { what, when });
        if (d.action === "move") return t("clientWork.events.move", { what, when });
        return `${t("clientWork.events.add", { what, when })}${who}${d.note ? ` — ${d.note}` : ""}`;
      }
      case "contact":
        return t(`clientWork.events.contact_${d.action || "add"}`, { name: d.name || "—", relation: d.relation ? t(`clientWork.relations.${d.relation}`) : "" });
      case "file":
        return t(`clientWork.events.file_${d.action || "add"}`, { name: d.name || "—", kind: d.kind ? t(`clientWork.fileKinds.${d.kind}`) : "" });
      case "lost":
        return t("clientWork.events.lost", { reason: d.reason ? t(`clientWork.lost.${d.reason}`) : "—" }) + (d.note ? `: ${d.note}` : "");
      default:
        return e.text;
    }
  };
}

const showValue = (v, fmt) => (v == null || v === "" ? "—" : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmt.isoDateLong(v) : v);

// Everything about the client in time order, newest first — filterable, with
// a note box (a note can be about one case: then only its people see it).
function Activity({ client, userId, onChanged }) {
  const { t, fmt } = useI18n();
  const eventText = useEventText();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text }
  // A coordinator's or lawyer's note goes on their case; an operator's or a
  // manager's on the client.
  const ownCase = client.cases.length === 1 && ["coordinator", "lawyer"].includes(client.cases[0].permissions?.role) ? String(client.cases[0].id) : "";
  const [noteCase, setNoteCase] = useState(ownCase);
  const [channel, setChannel] = useState("");
  const caseName = useMemo(() => new Map(client.cases.map((k) => [k.id, k.matter || t("cases.untitled")])), [client.cases, t]);
  const many = client.cases.length > 1;

  const items = useMemo(() => {
    const out = [];
    for (const e of client.events) {
      const at = new Date(e.createdAt).getTime();
      out.push({
        key: `e${e.id}`,
        group: e.kind === "note" || e.kind === "follow_up" ? "notes" : ["import", "archive", "keep", "restore", "merge", "contact"].includes(e.kind) ? "client" : "case",
        at,
        icon: e.kind === "note" && e.data?.channel ? CHANNEL_ICON[e.data.channel] : EVENT_ICON[e.kind] || "briefcase",
        title: e.kind === "note" && e.data?.channel ? `${t(`clientWork.channels.${e.data.channel}`)}: ${e.text}` : eventText(e),
        sub: [e.kind === "import" ? t("clients.events.fromExcel") : personName(e.author), fmt.dateTime(at), e.editedAt ? t("clients.edited") : null, many && e.caseId ? caseName.get(e.caseId) : null].filter(Boolean).join(" · "),
        note: e.kind === "note" ? e : null,
        mine: e.kind === "note" && (e.authorId === userId || client.canManage),
      });
    }
    for (const c of client.calls) {
      const title = c.missed ? t("clients.events.missedCall") : t("clients.events.call", { type: t(`callType.${c.callType}`), duration: fmt.duration(c.durationSeconds) });
      out.push({
        key: `c${c.id}`,
        group: GROUP.call,
        at: Number(c.callTimestampMs),
        icon: c.missed ? "phoneMissed" : CALL_ICON[c.callType] || "phone",
        title,
        sub: [c.employee?.name, c.employee?.job ? t(`work.jobs.${c.employee.job}`) : null, fmt.dateTime(Number(c.callTimestampMs)), c.hasRecording ? t("clients.withRecording") : null].filter(Boolean).join(" · "),
        to: `/calls/${c.id}`,
      });
    }
    for (const a of client.appointments) {
      const [y, m, d] = a.date.split("-").map(Number);
      const at = new Date(y, m - 1, d, Math.floor(a.start / 60), a.start % 60).getTime();
      out.push({
        key: `a${a.id}`,
        group: GROUP.appointment,
        at,
        icon: "calendar",
        title: `${t("clients.events.appointment", { calendar: a.calendar?.name || "" })} · ${t(`calendar.appointmentStatus.${a.status}`)}`,
        sub: [`${fmt.isoDay(a.date)}, ${fmt.minutes(a.start)}`, a.format === "online" ? t("calendar.format.online") : null, a.matter].filter(Boolean).join(" · "),
        to: `/calendar?cal=${a.calendarId}&day=${a.date}`,
      });
    }
    for (const p of client.payments) {
      const [y, m, d] = p.date.split("-").map(Number);
      out.push({
        key: `p${p.id}`,
        group: GROUP.payment,
        at: new Date(y, m - 1, d, 12).getTime(),
        icon: "cash",
        title: `${t("clients.events.payment", { amount: fmt.money(p.amount) })}${p.method ? ` · ${t(`payments.methods.${p.method}`)}` : ""}`,
        sub: [fmt.isoDateLong(p.date), personName(p.recordedBy), p.note].filter(Boolean).join(" · "),
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [client, t, fmt, userId, eventText, caseName, many]);

  const filtered = filter === "all" ? items : items.filter((i) => i.group === filter);
  const shown = showAll ? filtered : filtered.slice(0, 30);

  async function addNote() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.addNote(client.id, text, noteCase ? Number(noteCase) : undefined, channel || undefined);
      setText("");
      onChanged();
    } catch (err) {
      // The note stays in the box, to send again.
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing.text.trim()) return;
    try {
      await api.updateNote(editing.id, editing.text);
      setEditing(null);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  async function removeNote(noteId) {
    if (!confirm(t("clients.confirmDeleteNote"))) return;
    try {
      await api.deleteNote(noteId);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <Card title={t("clients.timeline")} subtitle={t("clients.timelineHint")}>
      <div className={styles.composer}>
        <TextAreaField aria-label={t("clients.writeNote")} placeholder={t("clients.writeNote")} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        <div className={styles.composerRow}>
          <SelectField aria-label={t("clientWork.channel")} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c ? t(`clientWork.channels.${c}`) : t("clientWork.channels.note")}
              </option>
            ))}
          </SelectField>
          {client.cases.length > 0 && (
            <SelectField aria-label={t("clients.noteAbout")} value={noteCase} onChange={(e) => setNoteCase(e.target.value)}>
              <option value="">{t("clients.noteAboutClient")}</option>
              {client.cases
                .filter((k) => k.permissions?.role !== "result")
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {t("clients.noteAboutCase", { name: k.matter || t("cases.untitled") })}
                  </option>
                ))}
            </SelectField>
          )}
          <Button size="small" variant="primary" busy={busy} disabled={!text.trim()} onClick={addNote}>
            {t("clients.addNote")}
          </Button>
        </div>
      </div>
      <div className={styles.activityFilters}>
        <Segmented wrap size="small" value={filter} onChange={(v) => (setFilter(v), setShowAll(false))} label={t("clients.timeline")} options={FILTERS.map((f) => ({ value: f, label: t(`clients.activity.${f}`) }))} />
      </div>
      {filtered.length === 0 ? (
        <p className={pageStyles.note}>{t("clients.timelineEmpty")}</p>
      ) : (
        <>
          <TimelineList
            items={shown}
            renderExtra={(item) =>
              item.note && item.mine ? (
                <span className={styles.itemActions}>
                  <button type="button" className={styles.iconButton} onClick={() => setEditing({ id: item.note.id, text: item.note.text })} aria-label={t("clients.editNote")}>
                    <Icon name="edit" size={15} />
                  </button>
                  <button type="button" className={styles.iconButton} onClick={() => removeNote(item.note.id)} aria-label={t("clients.deleteNote")}>
                    <Icon name="trash" size={15} />
                  </button>
                </span>
              ) : null
            }
            editing={editing}
            editor={
              editing && (
                <div className={styles.noteEditor}>
                  <TextAreaField aria-label={t("clients.editNote")} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} />
                  <span className={styles.itemActions}>
                    <Button size="small" onClick={() => setEditing(null)}>
                      {t("common.cancel")}
                    </Button>
                    <Button size="small" variant="primary" onClick={saveEdit}>
                      {t("common.save")}
                    </Button>
                  </span>
                </div>
              )
            }
          />
          {filtered.length > shown.length && (
            <Button size="small" variant="plain" onClick={() => setShowAll(true)}>
              {t("clients.showAll", { count: filtered.length })}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function TimelineList({ items, renderExtra, editing, editor }) {
  return (
    <div className={styles.timeline}>
      {items.map((item) => {
        const body = (
          <>
            <span className={styles.itemIcon}>
              <Icon name={item.icon} size={16} />
            </span>
            <span className={styles.itemMain}>
              <span className={styles.itemTitle} style={item.note ? { whiteSpace: "pre-wrap", fontWeight: 500 } : undefined}>
                {item.title}
              </span>
              <span className={styles.itemSub} style={{ display: "block" }}>
                {item.sub}
              </span>
            </span>
          </>
        );
        if (item.to) {
          return (
            <Link key={item.key} to={item.to} className={styles.item}>
              {body}
            </Link>
          );
        }
        if (editing && item.note && editing.id === item.note.id) {
          return (
            <div key={item.key} className={styles.item}>
              {editor}
            </div>
          );
        }
        return (
          <div key={item.key} className={styles.item}>
            {body}
            {renderExtra ? renderExtra(item) : null}
          </div>
        );
      })}
    </div>
  );
}
