import { useEffect, useState } from "react";
import fieldStyles from "../ui/Field.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Icon from "../ui/Icon";
import { useAuth, isManagerRole } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// "Who took the cash?" — asked whenever a payment is cash, because whoever
// records it isn't always who has the money: an operator records the fee,
// the client pays the lawyer or the boss in the office. Kassa counts the
// cash with the person picked here (server: services/cash.js).
//
// value: null (not answered yet), "me" (whoever recorded it — `recorder`
// when correcting someone else's payment) or a user id. `first`: a user id
// to offer first (the lawyer whose consultation it is).

let holders = null; // the boss and the lawyers — they rarely change
function useHolders() {
  const [people, setPeople] = useState(holders);
  useEffect(() => {
    if (holders) return undefined;
    let alive = true;
    api
      .cashHolders()
      .then((d) => {
        holders = d.people;
        if (alive) setPeople(d.people);
      })
      .catch(() => alive && setPeople([]));
    return () => {
      alive = false;
    };
  }, []);
  return people;
}

// A new payment: managers usually record the cash they took themselves;
// anyone else answers each time.
export function cashWithDefault(user) {
  return isManagerRole(user.role) ? "me" : null;
}

// The value as stored: who has a payment's cash ("me" when it's whoever
// recorded it).
export const cashWithOf = (payment) => (payment?.cashHolder ? payment.cashHolder.id : "me");

export default function CashWith({ value, onChange, first = null, recorder = null }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const people = useHolders();
  // "me": the person who recorded it — me, or (correcting their payment) them.
  const recorderId = recorder?.id ?? user.id;
  const others = (people || []).filter((p) => p.id !== recorderId);
  const sorted = first ? [...others.filter((p) => p.id === first), ...others.filter((p) => p.id !== first)] : others;
  const options = [
    { value: "me", label: recorderId === user.id ? t("cashWith.me") : recorder.name, hint: recorderId === user.id ? null : t("cashWith.recorded") },
    ...sorted.map((p) => ({ value: p.id, label: p.name, hint: p.role === "BOSS" ? t("cashWith.boss") : p.role === "LAWYER" ? t("cashWith.lawyer") : null })),
  ];
  return (
    <div className={pageStyles.formStack} style={{ gap: 6 }}>
      <span className={pageStyles.note}>
        <strong>{t("cashWith.question")}</strong>
        {value == null ? ` — ${t("cashWith.choose")}` : ""}
      </span>
      <div className={fieldStyles.chips} role="radiogroup" aria-label={t("cashWith.question")}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} className={`${fieldStyles.chip} ${on ? fieldStyles.chipOn : ""}`} onClick={() => onChange(o.value)}>
              {on && <Icon name="check" size={14} strokeWidth={2.4} />}
              {o.label}
              {o.hint && <span style={{ opacity: 0.75, fontWeight: 400 }}>· {o.hint}</span>}
            </button>
          );
        })}
      </div>
      <span className={pageStyles.note}>{t("cashWith.why")}</span>
    </div>
  );
}
