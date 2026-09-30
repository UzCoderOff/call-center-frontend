import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "../components/clients/Clients.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { SelectField, TextAreaField } from "../components/ui/Field";
import { AsyncBoundary, Banner, EmptyState, KeyValue, PageHeader } from "../components/ui/Misc";
import { LEGAL_STAGES, MoneyBlock, STATUSES, StageTrack, StatusBadge, personName } from "../components/clients/parts";
import { CaseSheet, ClientSheet, LinkSheet, MergeSheet, NextCallSheet, PaymentSheet } from "../components/clients/ClientSheets";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { telHref } from "../lib/format";
import { useI18n } from "../i18n";
import { saveFailed } from "../lib/saveFailed";
import { TaskSheet } from "../components/tasks/TaskParts";
import { canBookAppointments } from "../lib/access";

// One client: contact details, the next call, their cases (status, court
// stage, money), connected people, and a timeline of everything — notes,
// calls, appointments, payments, status changes.
export default function ClientPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const goBack = useBack("/clients");
  const state = useAsync(() => api.client(id), [id]);

  if (state.error?.status === 404) {
    return <PageHeader back={{ label: t("clients.title"), onClick: goBack }} title={t("clients.notFound")} />;
  }
  return <AsyncBoundary state={state}>{(client) => <ClientView client={client} reload={state.reload} goBack={goBack} />}</AsyncBoundary>;
}

function ClientView({ client, reload, goBack }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null); // { type, ...props }
  const close = () => setSheet(null);
  // A consultation is usually a visit to the lawyer: offer to book it (it's
  // optional — "Hozir emas" just closes the offer).
  const [params, setParams] = useSearchParams();
  const mayBook = canBookAppointments(user) && !client.archivedAt && !client.asLawyer;
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
            {!client.asLawyer && (
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
          {/* A lawyer sees their own cases of this client and can move them
              along and write notes; the rest is the office's. */}
          {!client.asLawyer && <NextCall client={client} onChange={() => setSheet({ type: "nextCall" })} onDone={reload} />}

          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{client.asLawyer ? t("lawyer.yourCases") : t("cases.title")}</h2>
            {!client.asLawyer && (
              <Button size="small" icon="plus" onClick={() => setSheet({ type: "case" })}>
                {t("cases.add")}
              </Button>
            )}
          </div>
          {client.cases.length === 0 ? (
            <EmptyState icon="briefcase" text={t("cases.empty")} />
          ) : (
            client.cases.map((c) => (
              <CaseCard
                key={c.id}
                item={c}
                canManage={client.canManage}
                asLawyer={client.asLawyer}
                onEdit={() => setSheet({ type: "case", item: c })}
                finance={client.finance}
                onPay={() => setSheet({ type: "payment", caseId: c.id })}
                onChanged={reload}
              />
            ))
          )}

          {!client.asLawyer && <Connections client={client} onAdd={() => setSheet({ type: "link" })} onChanged={reload} />}
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
            {client.createdBy && <KeyValue label={t("clients.addedBy")}>{personName(client.createdBy)}</KeyValue>}
            {client.notes && <p className={pageStyles.note} style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{client.notes}</p>}
          </Card>
          <Timeline client={client} userId={user.id} onChanged={reload} />
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
      {sheet?.type === "nextCall" && <NextCallSheet client={client} onClose={close} onSaved={saved} />}
      {sheet?.type === "case" && (
        <CaseSheet
          clientId={client.id}
          item={sheet.item}
          canManage={client.canManage}
          finance={client.finance}
          onClose={close}
          onSaved={(result) => {
            saved();
            // A new consultation: offer to book the visit too.
            if (!sheet.item && result?.status === "consultation" && mayBook) setParams({ ask: "book" }, { replace: true });
          }}
        />
      )}
      {sheet?.type === "payment" && <PaymentSheet clientId={client.id} cases={client.cases} caseId={sheet.caseId} finance={client.finance} onClose={close} onSaved={saved} />}
      {sheet?.type === "link" && <LinkSheet client={client} onClose={close} onSaved={saved} />}
      {sheet?.type === "merge" && <MergeSheet client={client} onClose={close} onSaved={saved} />}
      {sheet?.type === "task" && <TaskSheet client={{ id: client.id, name: client.name }} onClose={close} onSaved={close} />}
    </div>
  );
}

// "Call again: tomorrow 10:00 — tell them the court date" with Done / Change;
// or a quiet "plan a call" when nothing is planned.
function NextCall({ client, onChange, onDone }) {
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  if (!client.nextCallAt) {
    return (
      <div className={`${styles.nextCall} ${styles.nextCallCalm}`}>
        <Icon name="bell" size={18} />
        <span className={styles.nextCallText}>{t("clients.noNextCall")}</span>
        <Button size="small" onClick={onChange}>
          {t("clients.planCall")}
        </Button>
      </div>
    );
  }
  const at = new Date(client.nextCallAt).getTime();
  async function done() {
    setBusy(true);
    try {
      await api.updateClient(client.id, { nextCallAt: null, nextCallNote: null });
      onDone();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.nextCall}>
      <Icon name="bell" size={18} />
      <span className={styles.nextCallText}>
        {t("clients.nextCall")}: <strong>{fmt.dateTime(at)}</strong>
        {at < now && ` · ${t("clients.overdue")}`}
        {client.nextCallNote ? ` — ${client.nextCallNote}` : ""}
      </span>
      <span className={styles.nextCallActions}>
        <Button size="small" variant="primary" icon="check" busy={busy} onClick={done}>
          {t("clients.callDone")}
        </Button>
        <Button size="small" onClick={onChange}>
          {t("clients.change")}
        </Button>
      </span>
    </div>
  );
}

function CaseCard({ item, canManage, finance = false, asLawyer = false, onEdit, onPay, onChanged }) {
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(false);
  const hasContract = item.status === "contract" || item.status === "done";
  const meta = [item.number && `№ ${item.number}`, item.lawyer, item.operator?.name, item.startDate && fmt.isoDateLong(item.startDate)].filter(Boolean).join(" · ");

  // The two things that change most often, right on the card.
  async function change(patch) {
    setBusy(true);
    try {
      await api.updateCase(item.id, patch);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  async function removePayment(p) {
    if (!confirm(t("payments.confirmDelete"))) return;
    try {
      await api.deletePayment(p.id);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <section className={styles.case} aria-busy={busy}>
      <div className={styles.caseTop}>
        <StatusBadge status={item.status} />
        <span className={styles.caseTitle}>{item.matter || t("cases.untitled")}</span>
      </div>
      {meta && <p className={styles.caseMeta}>{meta}</p>}
      <div className={styles.caseControls}>
        <SelectField label={t("cases.status")} value={item.status} onChange={(e) => change({ status: e.target.value })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`cases.statuses.${s}`)}
            </option>
          ))}
        </SelectField>
        {hasContract && (
          <SelectField label={t("cases.legalStage")} value={item.legalStage || ""} onChange={(e) => change({ legalStage: e.target.value || null })}>
            <option value="">{t("cases.noStage")}</option>
            {LEGAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`cases.stages.${s}`)}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {hasContract && <StageTrack stage={item.legalStage} />}
      <MoneyBlock item={item} />
      {item.payments?.length > 0 && (
        <div className={styles.payments}>
          {item.payments.slice(0, 5).map((p) => (
            <div key={p.id} className={styles.payment}>
              <Icon name="cash" size={16} />
              <span className={styles.paymentMain}>
                {fmt.isoDateLong(p.date)}
                {p.method ? ` · ${t(`payments.methods.${p.method}`)}` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </span>
              <span className={styles.paymentAmount}>{fmt.money(p.amount)}</span>
              {canManage && (finance || p.kind === "consultation") && (
                <button type="button" className={styles.iconButton} onClick={() => removePayment(p)} aria-label={t("payments.delete")}>
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!asLawyer && (
        <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
          {onPay && (
            <Button size="small" icon="cash" onClick={onPay}>
              {t("payments.add")}
            </Button>
          )}
          <Button size="small" variant="plain" onClick={onEdit}>
            {t("cases.edit")}
          </Button>
        </div>
      )}
    </section>
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
        <Button size="small" icon="plus" onClick={onAdd}>
          {t("links.add")}
        </Button>
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
            <button type="button" className={styles.iconButton} onClick={() => remove(l)} aria-label={t("links.remove")}>
              <Icon name="x" size={15} />
            </button>
          </div>
        ))
      )}
    </Card>
  );
}

const CALL_ICON = { incoming: "phoneIncoming", outgoing: "phoneOutgoing" };
const EVENT_ICON = { import: "upload", note: "note", archive: "minusCircle", restore: "refresh", merge: "link" };

// Everything about the client in time order, newest first.
function Timeline({ client, userId, onChanged }) {
  const { t, fmt } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    const out = [];
    for (const e of client.events) {
      const at = new Date(e.createdAt).getTime();
      const [from, to] = (e.text || "").split(">");
      let title = e.text;
      if (e.kind === "status") title = t("clients.events.status", { from: from ? t(`cases.statuses.${from}`) : "—", to: to ? t(`cases.statuses.${to}`) : "—" });
      if (e.kind === "stage") title = t("clients.events.stage", { from: from ? t(`cases.stages.${from}`) : "—", to: to ? t(`cases.stages.${to}`) : "—" });
      if (e.kind === "case") title = t("clients.events.case", { text: e.text || "—" });
      if (e.kind === "archive") title = t("clients.events.archive");
      if (e.kind === "restore") title = t("clients.events.restore");
      if (e.kind === "merge") title = t("clients.events.merge", { name: e.text });
      out.push({
        key: `e${e.id}`,
        at,
        icon: EVENT_ICON[e.kind] || "briefcase",
        title,
        sub: [e.kind === "import" ? t("clients.events.fromExcel") : personName(e.author), fmt.dateTime(at)].filter(Boolean).join(" · "),
        removable: e.kind === "note" && (e.authorId === userId || client.canManage) ? e.id : null,
      });
    }
    for (const c of client.calls) {
      const title = c.missed
        ? t("clients.events.missedCall")
        : t("clients.events.call", { type: t(`callType.${c.callType}`), duration: fmt.duration(c.durationSeconds) });
      out.push({
        key: `c${c.id}`,
        at: Number(c.callTimestampMs),
        icon: c.missed ? "phoneMissed" : CALL_ICON[c.callType] || "phone",
        title,
        sub: [c.employee?.name, fmt.dateTime(Number(c.callTimestampMs))].filter(Boolean).join(" · "),
        to: `/calls/${c.id}`,
      });
    }
    for (const a of client.appointments) {
      const [y, m, d] = a.date.split("-").map(Number);
      const at = new Date(y, m - 1, d, Math.floor(a.start / 60), a.start % 60).getTime();
      out.push({
        key: `a${a.id}`,
        at,
        icon: "calendar",
        title: `${t("clients.events.appointment", { calendar: a.calendar?.name || "" })} · ${t(`calendar.appointmentStatus.${a.status}`)}`,
        sub: `${fmt.isoDay(a.date)}, ${fmt.minutes(a.start)}${a.matter ? ` · ${a.matter}` : ""}`,
        to: `/calendar?cal=${a.calendarId}&day=${a.date}`,
      });
    }
    for (const p of client.payments) {
      const [y, m, d] = p.date.split("-").map(Number);
      out.push({
        key: `p${p.id}`,
        at: new Date(y, m - 1, d, 12).getTime(),
        icon: "cash",
        title: `${t("clients.events.payment", { amount: fmt.money(p.amount) })}${p.method ? ` · ${t(`payments.methods.${p.method}`)}` : ""}`,
        sub: [fmt.isoDateLong(p.date), personName(p.recordedBy), p.note].filter(Boolean).join(" · "),
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [client, t, fmt, userId]);

  async function addNote() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.addNote(client.id, text);
      setText("");
      onChanged();
    } catch (err) {
      // The note stays in the box, to send again.
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(noteId) {
    try {
      await api.deleteNote(noteId);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  const shown = showAll ? items : items.slice(0, 25);
  return (
    <Card title={t("clients.timeline")}>
      <div className={styles.composer}>
        <TextAreaField aria-label={t("clients.writeNote")} placeholder={t("clients.writeNote")} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        <div>
          <Button size="small" variant="primary" busy={busy} disabled={!text.trim()} onClick={addNote}>
            {t("clients.addNote")}
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className={pageStyles.note}>{t("clients.timelineEmpty")}</p>
      ) : (
        <div className={styles.timeline}>
          {shown.map((item) => {
            const body = (
              <>
                <span className={styles.itemIcon}>
                  <Icon name={item.icon} size={16} />
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{item.title}</span>
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
            return (
              <div key={item.key} className={styles.item}>
                {body}
                {item.removable && (
                  <button type="button" className={styles.iconButton} onClick={() => removeNote(item.removable)} aria-label={t("clients.deleteNote")}>
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
            );
          })}
          {items.length > shown.length && (
            <Button size="small" variant="plain" onClick={() => setShowAll(true)}>
              {t("clients.showAll", { count: items.length })}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
