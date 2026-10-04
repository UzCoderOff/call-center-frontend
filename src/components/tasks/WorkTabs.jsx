import { useNavigate } from "react-router-dom";
import Segmented from "../ui/Segmented";
import { useI18n } from "../../i18n";

// Vazifalar and Eslatmalar: one place in the menu, two tabs.
export default function WorkTabs({ value }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Segmented
      full
      value={value}
      onChange={(next) => navigate(next === "reminders" ? "/tasks/reminders" : "/tasks")}
      label={t("nav.tasks")}
      options={[
        { value: "tasks", label: t("tasks.title") },
        { value: "reminders", label: t("reminders.title") },
      ]}
    />
  );
}
