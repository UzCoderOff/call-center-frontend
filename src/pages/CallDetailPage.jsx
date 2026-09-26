import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import styles from "./CallDetailPage.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { List } from "../components/ui/List";
import { FollowUpBadge } from "../components/ui/Badge";
import { AsyncBoundary, EmptyState, KeyValue, PageHeader } from "../components/ui/Misc";
import CallRow, { CallTypeIcon } from "../components/calls/CallRow";
import AudioPlayer from "../components/calls/AudioPlayer";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { CallerAppointmentsCard } from "../components/calendar/CalendarCards";
import { canBookAppointments, canSeeCalendar } from "../lib/access";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { telHref } from "../lib/format";
import { useI18n } from "../i18n";

export default function CallDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const goBack = useBack("/calls");
  const state = useAsync(() => api.call(id), [id]);

  if (state.error?.status === 404) {
    return (
      <div>
        <PageHeader back={{ label: t("callDetail.back"), onClick: goBack }} title={t("callDetail.notFound")} />
      </div>
    );
  }

  return (
    <AsyncBoundary state={state}>
      {(call) => {
        const tel = telHref(call.phoneNumber);
        return (
          <div>
            <PageHeader
              back={{ label: t("callDetail.back"), onClick: goBack }}
              title={fmt.phone(call.phoneNumber)}
              subtitle={`${t(`callType.${call.callType}`)} · ${fmt.dateTime(call.callTimestampMs)}`}
              actions={
                tel && (
                  <Button variant="primary" icon="phone" href={tel}>
                    {t("common.call")}
                  </Button>
                )
              }
            />

            <div className={pageStyles.split}>
              <div className={pageStyles.stack}>
                {call.missed && <FollowUpCard call={call} onChange={state.setData} />}
                {call.resolvesMissed?.length > 0 && <ResolvesCard call={call} />}
                {!call.missed && (
                  <Card title={t("callDetail.recording")}>
                    {call.recordingPath ? (
                      <AudioPlayer src={api.recordingUrl(call.id)} />
                    ) : (
                      <p className={pageStyles.note}>{t("callDetail.noRecording")}</p>
                    )}
                  </Card>
                )}
                <AiCards call={call} />
              </div>

              <div className={pageStyles.stack}>
                <Card title={t("callDetail.details")}>
                  <div className={styles.headIcon}>
                    <CallTypeIcon call={call} size={44} />
                    <span>{t(`callType.${call.callType}`)}</span>
                  </div>
                  <KeyValue label={t("callDetail.employee")}>{call.employee?.name || "—"}</KeyValue>
                  <KeyValue label={t("callDetail.when")}>{fmt.dateTime(call.callTimestampMs)}</KeyValue>
                  <KeyValue label={t("callDetail.duration")}>
                    {call.missed ? "—" : fmt.duration(call.durationSeconds)}
                  </KeyValue>
                  <KeyValue label={t("callDetail.number")}>{fmt.phone(call.phoneNumber)}</KeyValue>
                </Card>
                {canSeeCalendar(user) && <CallerAppointmentsCard call={call} canBook={canBookAppointments(user)} />}
                <HistoryCard call={call} />
              </div>
            </div>
          </div>
        );
      }}
    </AsyncBoundary>
  );
}

function FollowUpCard({ call, onChange }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const linked = call.followUpCall;
  const delay = call.followUpDelaySec != null ? fmt.duration(call.followUpDelaySec) : "";
  const markedByName = call.followUpMarkedBy?.employee?.name || call.followUpMarkedBy?.username;
  const canUnmark = isManagerRole(user.role) || call.followUpMarkedBy?.id === user.id;
  const tel = telHref(call.phoneNumber);

  async function setHandled(handled) {
    setBusy(true);
    setError("");
    try {
      onChange(await api.setFollowUpHandled(call.id, handled));
    } catch {
      setError(t("callDetail.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  let text;
  switch (call.followUp) {
    case "called_back":
      text = t("callDetail.calledBackBy", { name: linked?.employee?.name || "—", delay });
      break;
    case "client_called_again":
      text = t("callDetail.clientCalledAgain", { delay });
      break;
    case "attempted":
      text = t("callDetail.attemptedBy", { name: linked?.employee?.name || "—", delay });
      break;
    case "handled":
      text = t("callDetail.handledBy", { name: markedByName || "—" });
      break;
    case "no_number":
      text = t("callDetail.noNumber");
      break;
    default:
      text = t("callDetail.pending");
  }

  const needsCallback = call.followUp === "pending" || call.followUp === "attempted";

  return (
    <Card title={t("callDetail.followUp")} action={<FollowUpBadge status={call.followUp} />}>
      <p className={styles.followText}>{text}</p>

      {linked && (
        <Link to={`/calls/${linked.id}`} className={styles.linkedCall}>
          <CallTypeIcon call={{ ...linked, missed: false }} size={32} />
          <span className={styles.linkedText}>
            <span>{t(`callType.${linked.callType}`)}</span>
            <span className={styles.linkedSub}>
              {fmt.dateTime(linked.callTimestampMs)}
              {linked.durationSeconds > 0 ? ` · ${fmt.duration(linked.durationSeconds)}` : ""}
            </span>
          </span>
          <Icon name="chevronRight" size={16} />
        </Link>
      )}

      {needsCallback && (
        <>
          <div className={pageStyles.actionsRow}>
            {tel && (
              <Button variant="primary" icon="phone" href={tel}>
                {t("common.call")}
              </Button>
            )}
            <Button icon="check" busy={busy} onClick={() => setHandled(true)}>
              {t("callDetail.markHandled")}
            </Button>
          </div>
          <p className={`${pageStyles.note} ${styles.hint}`}>{t("callDetail.markHandledHint")}</p>
        </>
      )}

      {call.followUp === "handled" && canUnmark && (
        <div className={pageStyles.actionsRow}>
          <Button variant="plain" size="small" busy={busy} onClick={() => setHandled(false)}>
            {t("callDetail.unmarkHandled")}
          </Button>
        </div>
      )}

      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
    </Card>
  );
}

function ResolvesCard({ call }) {
  const { t, fmt } = useI18n();
  return (
    <Card title={t("callDetail.resolves", { count: call.resolvesMissed.length })}>
      <div className={styles.resolvesList}>
        {call.resolvesMissed.map((m) => (
          <Link key={m.id} to={`/calls/${m.id}`} className={styles.linkedCall}>
            <CallTypeIcon call={{ callType: "missed", missed: true }} size={32} />
            <span className={styles.linkedText}>
              <span>{t("callType.missed")}</span>
              <span className={styles.linkedSub}>
                {fmt.dateTime(m.callTimestampMs)} · {m.employee?.name}
              </span>
            </span>
            <Icon name="chevronRight" size={16} />
          </Link>
        ))}
      </div>
    </Card>
  );
}

// Rendered only once the AI pipeline starts filling Transcript/CallAnalysis
// — no empty placeholders for a feature that isn't live yet.
function AiCards({ call }) {
  const { t } = useI18n();
  const a = call.analysis;
  const hasAnalysis = a && (a.summary || a.whatWentWrong || a.improvementAreas || a.score != null);
  return (
    <>
      {hasAnalysis && (
        <Card title={t("callDetail.analysis")} action={a.score != null && <span className={styles.score}>{t("callDetail.score", { score: a.score })}</span>}>
          <div className={styles.analysis}>
            {a.summary && (
              <section>
                <h3>{t("callDetail.summary")}</h3>
                <p>{a.summary}</p>
              </section>
            )}
            {a.whatWentWrong && (
              <section>
                <h3>{t("callDetail.whatWentWrong")}</h3>
                <p>{a.whatWentWrong}</p>
              </section>
            )}
            {a.improvementAreas && (
              <section>
                <h3>{t("callDetail.improvementAreas")}</h3>
                <p>{a.improvementAreas}</p>
              </section>
            )}
          </div>
        </Card>
      )}
      {call.transcript?.text && (
        <Card title={t("callDetail.transcript")}>
          <p className={styles.transcript}>{call.transcript.text}</p>
        </Card>
      )}
    </>
  );
}

function HistoryCard({ call }) {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <Card flush title={t("callDetail.history")}>
      {call.history.length === 0 ? (
        <EmptyState icon="phone" text={t("callDetail.historyEmpty")} />
      ) : (
        <List plain>
          {call.history.map((h) => (
            <CallRow key={h.id} call={h} showEmployee={isManagerRole(user.role)} dateStyle="dateTime" compact />
          ))}
        </List>
      )}
    </Card>
  );
}
