import Segmented from "../ui/Segmented";
import { useI18n } from "../../i18n";

const RANGE_KEYS = ["today", "7d", "month", "lastMonth", "90d"];

// The date-range presets that scope every number below them on a page.
// "This month" (from the 1st) is the default on Home: a new month starts
// from zero.
export default function RangePicker({ value, onChange }) {
  const { t } = useI18n();
  return (
    <Segmented
      full
      value={value}
      onChange={onChange}
      label={t("range.label")}
      options={RANGE_KEYS.map((k) => ({ value: k, label: t(`range.${k}`) }))}
    />
  );
}
