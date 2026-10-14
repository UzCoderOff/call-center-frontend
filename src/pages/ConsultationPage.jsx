import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import clientStyles from "../components/clients/Clients.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { SelectField, TextAreaField, TextField } from "../components/ui/Field";
import { AsyncBoundary, Banner, KeyValue, PageHeader } from "../components/ui/Misc";
import { SummaryList } from "../components/clients/CaseWork";
import { ChoiceChips, LOST_REASONS, WAITS, combine, daysFromNow, localDate } from "../components/clients/ClientWork";
import { personName } from "../components/clients/parts";
import { SummaryDraftBox } from "../components/ai/AiParts";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { saveFailed } from "../lib/saveFailed";
import { useI18n } from "../i18n";

// One consultation's summary ("suhbat yakuni", /consultations/:id) — written
// by the specialist who held it (or the boss): did the client come, what it
// was about, what was advised, how it ended, and — the part the operator
// works from — is this a potential client, and what happens next. "They'll
// think it over / talk to their family about the money" puts a date on the
// operator who brought the client (backend: services/consultSummary.js).
export default function ConsultationPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const goBack = useBack("/consultations");
  const state = useAsync(() => api.consultation(id), [id]);
  return (
    <AsyncBoundary state={state}>
      {(a) => (
        <div>
          <PageHeader
            back={{ label: t("summary.listTitle"), onClick: goBack }}
            title={a.summaryAt ? t("summary.title") : t("summary.writeTitle")}
            subtitle={`${a.clientName} · ${a.calendar?.name || ""}`}
          />
          <div className={clientStyles.layout}>
            <div className={clientStyles.column}>
              {a.summaryAt ? (
                a.summary ? (
                  <Written a={a} onChanged={state.reload} />
                ) : (
                  <Banner icon="lock">{t("summary.hidden")}</Banner>
                )
              ) : a.canWrite ? (
                <SummaryForm a={a} onSaved={state.reload} />
              ) : (
                <NotYet a={a} />
              )}
            </div>
            <div className={clientStyles.column}>
              <About a={a} />
            </div>
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}

// The appointment itself: who, when, what about, who booked it.
function About({ a }) {
  const { t, fmt } = useI18n();
  return (
    <Card title={t("summary.about")}>
      <KeyValue label={t("calendar.when")}>
        {fmt.isoDay(a.date)}, {fmt.minutes(a.start)}–{fmt.minutes(a.end)}
      </KeyValue>
      <KeyValue label={t("calendar.status")}>{t(`calendar.appointmentStatus.${a.status}`)}</KeyValue>
      <KeyValue label={t("calendar.format.label")}>{t(`calendar.format.${a.format === "online" ? "online" : "office"}`)}</KeyValue>
      {a.clientPhone && <KeyValue label={t("calendar.phone")}>{fmt.phone(a.clientPhone)}</KeyValue>}
      {a.matter && <KeyValue label={t("calendar.matter")}>{a.matter}</KeyValue>}
      {a.notes && <KeyValue label={t("calendar.notes")}>{a.notes}</KeyValue>}
      {a.bookedBy && <KeyValue label={t("calendar.bookedBy")}>{personName(a.bookedBy)}</KeyValue>}
      {a.clientId && (
        <p style={{ margin: "10px 0 0" }}>
          <Link to={`/clients/${a.clientId}`}>{t("summary.openClient")}</Link>
        </p>
      )}
    </Card>
  );
}

function NotYet({ a }) {
  const { t } = useI18n();
  return (
    <Banner icon="clock">
      <strong>{a.status === "cancelled" ? t("summary.cancelled") : a.status === "no_show" ? t("summary.noShow") : t("summary.notYet")}</strong>
      {a.status !== "cancelled" && a.status !== "no_show" && <div className={pageStyles.bannerDetail}>{t("summary.notYetHint", { name: a.calendar?.name || "" })}</div>}
    </Banner>
  );
}

// The summary as written (on its case too) — its texts can be corrected.
function Written({ a, onChanged }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const s = a.summary || {};
  const [topic, setTopic] = useState(s.topic || "");
  const [advice, setAdvice] = useState(s.advice || "");
  const [conclusion, setConclusion] = useState(s.conclusion || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!conclusion.trim()) return;
    setBusy(true);
    try {
      await api.updateSummary(a.id, { topic, advice, conclusion });
      setEditing(false);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={t("summary.title")}
      subtitle={t("summary.writtenBy", { name: personName(a.summaryBy) || "—" })}
      action={
        a.canEdit &&
        !editing && (
          <Button size="small" variant="plain" icon="edit" onClick={() => setEditing(true)}>
            {t("summary.editTexts")}
          </Button>
        )
      }
    >
      {editing ? (
        <div className={pageStyles.formStack}>
          <TextAreaField label={t("summary.topic")} value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} />
          <TextAreaField label={t("summary.advice")} value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3} />
          <TextAreaField label={t("summary.conclusion")} value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3} />
          <p className={pageStyles.note}>{t("summary.editHint")}</p>
          <div className={pageStyles.formActions}>
            <Button onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" busy={busy} disabled={!conclusion.trim()} onClick={save}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <SummaryList rows={[{ ...a, calendar: a.calendar }]} />
      )}
    </Card>
  );
}

const NEXT = [
  { value: "decision", icon: "clock" },
  { value: "call", icon: "phone" },
  { value: "meeting", icon: "users" },
  { value: "contract", icon: "checkCircle" },
];

// The form: one question at a time, top to bottom.
function SummaryForm({ a, onSaved }) {
  const { t } = useI18n();
  const [came, setCame] = useState(a.status === "attended" ? "yes" : null);
  const openCases = a.cases.filter((k) => ["consultation", "call_again"].includes(k.status));
  const firstCase = a.case || openCases[0] || a.cases[0] || null;
  const [caseId, setCaseId] = useState(firstCase ? String(firstCase.id) : "");
  const kase = a.cases.find((k) => String(k.id) === caseId) || null;
  const [topic, setTopic] = useState(a.matter || kase?.details || kase?.matter || "");
  const [advice, setAdvice] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [prospect, setProspect] = useState(null);
  const [next, setNext] = useState("decision");
  const [date, setDate] = useState(localDate(daysFromNow(3)));
  const [time, setTime] = useState("10:00");
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const operator = kase?.operator?.name || personName(a.bookedBy);

  async function noShow() {
    setBusy("noShow");
    try {
      await api.updateAppointment(a.id, { status: "no_show" });
      onSaved();
    } catch (err) {
      saveFailed(err, t);
      setBusy(null);
    }
  }

  async function save() {
    if (!conclusion.trim()) return setError(t("summary.errConclusion"));
    if (!prospect) return setError(t("summary.errProspect"));
    if (prospect === "not_potential" && !lostReason) return setError(t("clientWork.pickReason"));
    setBusy("save");
    setError("");
    const payload = {
      topic,
      advice,
      conclusion,
      prospect,
      caseId: caseId ? Number(caseId) : undefined,
      ...(prospect === "potential"
        ? { next: { kind: next, dueAt: next === "contract" ? null : combine(date, time).toISOString(), note, contactId: contactId ? Number(contactId) : null } }
        : { lostReason, lostNote }),
    };
    try {
      await api.writeSummary(a.id, payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(null);
    }
  }

  if (!a.over && a.status === "booked") {
    return (
      <Banner icon="clock">
        <strong>{t("summary.notStarted")}</strong>
      </Banner>
    );
  }

  return (
    <Card title={t("summary.writeTitle")} subtitle={t("summary.writeHint")}>
      <div className={pageStyles.formStack}>
        {a.status === "booked" && (
          <div className={pageStyles.formStack} style={{ gap: 6 }}>
            <span className={pageStyles.note}>{t("summary.didCome")}</span>
            <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
              <Button variant={came === "yes" ? "primary" : undefined} icon="checkCircle" onClick={() => setCame("yes")}>
                {t("summary.came")}
              </Button>
              {a.canMarkNoShow && (
                <Button icon="alertCircle" busy={busy === "noShow"} onClick={noShow}>
                  {t("summary.didntCome")}
                </Button>
              )}
            </div>
          </div>
        )}

        {came === "yes" && (
          <>
            <SummaryDraftBox
              appointmentId={a.id}
              onDraft={(d) => {
                if (d.topic) setTopic(d.topic);
                if (d.advice) setAdvice(d.advice);
                if (d.conclusion) setConclusion(d.conclusion);
                if (d.prospect === "potential" || d.prospect === "not_potential") setProspect(d.prospect);
                if (["decision", "call", "meeting", "contract"].includes(d.nextKind)) setNext(d.nextKind);
                if (d.nextInDays != null && d.nextInDays >= 0 && d.nextInDays <= 365) setDate(localDate(daysFromNow(d.nextInDays)));
                if (d.lostReason) setLostReason(d.lostReason);
              }}
            />
            {a.cases.length > 1 && (
              <SelectField label={t("summary.whichCase")} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                {a.cases.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.matter || t("cases.untitled")} · {t(`cases.statuses.${k.status}`)}
                  </option>
                ))}
              </SelectField>
            )}
            <TextAreaField label={t("summary.topic")} placeholder={t("summary.topicPh")} value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} />
            <TextAreaField label={t("summary.advice")} placeholder={t("summary.advicePh")} value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3} />
            <TextAreaField label={`${t("summary.conclusion")} *`} placeholder={t("summary.conclusionPh")} value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3} />

            <div className={pageStyles.formStack} style={{ gap: 6 }}>
              <span className={pageStyles.note}>
                <strong>{t("summary.isPotential")}</strong>
              </span>
              <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
                <Button variant={prospect === "potential" ? "primary" : undefined} icon="checkCircle" onClick={() => setProspect("potential")}>
                  {t("summary.prospects.potential")}
                </Button>
                <Button variant={prospect === "not_potential" ? "primary" : undefined} icon="minusCircle" onClick={() => setProspect("not_potential")}>
                  {t("summary.prospects.not_potential")}
                </Button>
              </div>
            </div>

            {prospect === "potential" && (
              <>
                <ChoiceChips label={t("summary.nextLabel")} value={next} onChange={setNext} options={NEXT.map((n) => ({ ...n, label: t(`summary.next.${n.value}`) }))} />
                {next === "contract" ? (
                  <p className={pageStyles.note}>{t("summary.contractHint")}</p>
                ) : (
                  <>
                    {next === "decision" && (
                      <ChoiceChips
                        label={t("clientWork.waitHowLong")}
                        value={WAITS.find((d) => localDate(daysFromNow(d)) === date) ?? null}
                        onChange={(d) => setDate(localDate(daysFromNow(d)))}
                        options={WAITS.map((d) => ({ value: d, label: d === 7 ? t("clientWork.week") : d === 14 ? t("clientWork.twoWeeks") : t("clientWork.days", { n: d }) }))}
                      />
                    )}
                    <div className={clientStyles.twoCol}>
                      <TextField label={t("summary.nextWhen")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      <TextField label={t("clientWork.time")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>
                    {a.contacts.length > 0 && (
                      <SelectField label={t("summary.whoDecides")} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                        <option value="">{t("summary.theClient")}</option>
                        {a.contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {t(`clientWork.relations.${c.relation}`)}
                            {c.decides ? " ★" : ""}
                          </option>
                        ))}
                      </SelectField>
                    )}
                    <TextField label={t("summary.nextNote")} placeholder={t(`summary.nextNotePh.${next}`)} value={note} onChange={(e) => setNote(e.target.value)} />
                    <Banner icon="bell">
                      {operator ? t("summary.goesTo", { name: operator }) : t("summary.goesToNobody")}
                    </Banner>
                  </>
                )}
              </>
            )}

            {prospect === "not_potential" && (
              <>
                <ChoiceChips label={t("clientWork.lostReason")} value={lostReason} onChange={setLostReason} options={LOST_REASONS.map((r) => ({ value: r, label: t(`clientWork.lost.${r}`) }))} />
                <TextField label={t("clientWork.lostNote")} value={lostNote} onChange={(e) => setLostNote(e.target.value)} />
                <p className={pageStyles.note}>{t("summary.notPotentialHint")}</p>
              </>
            )}

            {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
            <div className={pageStyles.formActions}>
              <Button variant="primary" icon="check" busy={busy === "save"} onClick={save}>
                {t("summary.save")}
              </Button>
            </div>
            {kase && (
              <p className={pageStyles.note}>
                <Badge tone="neutral">{kase.matter || t("cases.untitled")}</Badge> {t("summary.savedOnCase")}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
