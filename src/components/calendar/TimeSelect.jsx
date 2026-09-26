import { SelectField } from "../ui/Field";
import { STEP } from "../../lib/calendarDays";
import { useI18n } from "../../i18n";

const FIRST = 6 * 60;
const LAST = 22 * 60;

// A time of day in 15-minute steps (06:00–22:00, plus the current value if
// it's outside that). A native select: phones show their own easy picker.
export default function TimeSelect({ label, value, onChange }) {
  const { fmt } = useI18n();
  const options = [];
  for (let m = FIRST; m <= LAST; m += STEP) options.push(m);
  if (!options.includes(value)) options.push(value);
  options.sort((a, b) => a - b);
  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map((m) => (
        <option key={m} value={m}>
          {fmt.minutes(m)}
        </option>
      ))}
    </SelectField>
  );
}
