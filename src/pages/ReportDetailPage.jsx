import { useState } from "react";
import { useParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { TextAreaField } from "../components/ui/Field";
import { AsyncBoundary, KeyValue, PageHeader } from "../components/ui/Misc";
import ReportAnswers, { ReportStatusBadge } from "../components/reports/ReportAnswers";
import { CallStatsLine } from "./ReportsPage";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

export default function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const goBack = useBack("/reports");
  const state = useAsync(() => api.report(id), [id]);
  const isManager = isManagerRole(user.role);

  if (state.error?.status === 404) {
    return <PageHeader back={{ label: t("reports.title"), onClick: goBack }} title={t("reports.notFound")} />;
  }

  return (
    <AsyncBoundary state={state}>
      {(report) => {
        const reviewer = report.reviewedBy?.employee?.name || report.reviewedBy?.username;
        return (
          <div>
            <PageHeader
              back={{ label: t("reports.title"), onClick: goBack }}
              title={isManager ? report.employee.name : fmt.isoDateLong(report.date)}
              subtitle={isManager ? `${fmt.isoDateLong(report.date)} · ${report.template.name}` : report.template.name}
              actions={<ReportStatusBadge report={report} />}
            />
            <div className={pageStyles.split}>
              <div className={pageStyles.stack}>
                <Card title={t("reports.answers")}>
                  <CallStatsLine stats={report.callStats} title={t("reports.callsThatDay")} />
                  <ReportAnswers fields={report.fields} answers={report.answers} />
                </Card>
              </div>
              <div className={pageStyles.stack}>
                <Card>
                  {report.employee.office && <KeyValue label={t("work.office")}>{report.employee.office.name}</KeyValue>}
                  <KeyValue label={t("reports.submitted")}>{fmt.dateTime(new Date(report.updatedAt).getTime())}</KeyValue>
                  {report.reviewedAt && (
                    <KeyValue label={t("reports.reviewed")}>
                      {reviewer} · {fmt.dateTime(new Date(report.reviewedAt).getTime())}
                    </KeyValue>
                  )}
                  {report.reviewComment && <p className={pageStyles.note} style={{ marginTop: 8 }}>“{report.reviewComment}”</p>}
                </Card>
                {isManager && !report.reviewedAt && <ReviewCard report={report} onReviewed={state.setData} />}
              </div>
            </div>
          </div>
        );
      }}
    </AsyncBoundary>
  );
}

function ReviewCard({ report, onReviewed }) {
  const { t } = useI18n();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review() {
    setBusy(true);
    setError("");
    try {
      const updated = await api.reviewReport(report.id, comment);
      onReviewed((prev) => ({ ...prev, ...updated }));
    } catch {
      setError(t("reports.reviewFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("reports.review")}>
      <div className={pageStyles.formStack}>
        <TextAreaField label={t("reports.reviewComment")} value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <Button variant="primary" icon="check" busy={busy} onClick={review}>
          {t("reports.markReviewed")}
        </Button>
      </div>
    </Card>
  );
}
