import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import { AsyncBoundary } from "../ui/Misc";
import ReportForm from "./ReportForm";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// The developer fills in (or corrects) someone's report for a day they
// missed — "I forgot Monday's report, can you put it in?" (backend: PUT
// /api/reports/for/:employeeId/:date). The report then shows who entered it.
export default function EnterReportSheet({ employeeId, employeeName, date, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.reportFor(employeeId, date), [employeeId, date]);

  async function submit(answers) {
    const saved = await api.saveReportFor(employeeId, date, answers);
    onSaved(saved);
  }

  return (
    <Sheet title={t("reports.enterFor.title", { name: employeeName })} onClose={onClose}>
      <AsyncBoundary state={state}>
        {(data) => (
          <div className={pageStyles.formStack}>
            <p className={pageStyles.note}>{t("reports.enterFor.hint", { date: fmt.isoDateLong(date), form: data.template.name })}</p>
            <ReportForm
              fields={data.template.fields}
              initialAnswers={data.report?.answers}
              onSubmit={submit}
              submitLabel={data.report ? t("reports.update") : t("reports.enterFor.save")}
            />
          </div>
        )}
      </AsyncBoundary>
    </Sheet>
  );
}
