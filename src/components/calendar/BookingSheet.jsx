import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Segmented from "../ui/Segmented";
import { MoneyField, SelectField, Switch, TextAreaField, TextField } from "../ui/Field";
import { useAuth } from "../../hooks/useAuth";
import { isLawyer } from "../../lib/access";
import { KeyValue } from "../ui/Misc";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

const ERRORS = {
  slot_taken: "calendar.slotTaken",
  not_free_time: "calendar.notFree",
  in_the_past: "calendar.inPast",
  not_published: "calendar.notPublishedError",
  phone_required_for_fee: "calendar.feeNeedsPhone",
};

// The firm's usual consultation fee (the server has the same default).
export const CONSULTATION_FEE = 450000;
export const FEE_METHODS = ["cash", "card", "transfer"];

// Booking a client into a free slot. Immediate — the lawyer already
// approved this time by publishing the week. `prefill` comes from a call
// ("book from this call"): the caller's number, linked to the call.
export default function BookingSheet({ calendar, slot, free, prefill, onClose, onBooked }) {
  const { t, fmt } = useI18n();
  const slotMinutes = calendar.slotMinutes;
  // A double-length appointment only when the next slot is free too.
  const nextFree = free.some((s) => s.date === slot.date && s.start === slot.start + slotMinutes);
  const [duration, setDuration] = useState(slotMinutes);
  const [clientName, setClientName] = useState(prefill?.name || "");
  const [clientPhone, setClientPhone] = useState(prefill?.phone || "");
  const [matter, setMatter] = useState("");
  const [notes, setNotes] = useState("");
  // In the office, or an online (video/phone) consultation.
  const [format, setFormat] = useState("office");
  // "Fee received": the consultation fee was paid now — it's recorded on the
  // client with the booking. Lawyers don't record payments.
  const { user } = useAuth();
  const canTakeFee = !isLawyer(user);
  const [feeReceived, setFeeReceived] = useState(false);
  const [feeAmount, setFeeAmount] = useState(String(CONSULTATION_FEE));
  const [feeMethod, setFeeMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (feeReceived && !clientPhone.trim() && !prefill?.clientId) return setError(t("calendar.feeNeedsPhone"));
    if (feeReceived && !Number(feeAmount)) return setError(t("payments.amountRequired"));
    setBusy(true);
    setError("");
    try {
      const appointment = await api.bookAppointment(calendar.id, {
        date: slot.date,
        start: slot.start,
        duration,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || null,
        matter: matter.trim() || null,
        notes: notes.trim() || null,
        format,
        callLogId: prefill?.callId || undefined,
        clientId: prefill?.clientId || undefined,
        ...(feeReceived ? { feeReceived: true, feeAmount: Number(feeAmount), feeMethod } : {}),
      });
      onBooked(appointment);
    } catch (err) {
      setError(t(ERRORS[err.code] || "calendar.bookFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("calendar.book")} onClose={onClose}>
      <form onSubmit={submit} className={pageStyles.formStack}>
        <div>
          <KeyValue label={t("calendar.when")}>
            {fmt.isoDay(slot.date)}, {fmt.minutes(slot.start)}–{fmt.minutes(slot.start + duration)}
          </KeyValue>
          <KeyValue label={calendar.name ? t("calendar.title") : ""}>{calendar.name}</KeyValue>
        </div>
        {nextFree && (
          <div className={pageStyles.formStack} style={{ gap: 6 }}>
            <span className={pageStyles.note}>{t("calendar.duration")}</span>
            <Segmented
              full
              value={duration}
              onChange={setDuration}
              label={t("calendar.duration")}
              options={[
                { value: slotMinutes, label: t("calendar.minutes", { n: slotMinutes }) },
                { value: slotMinutes * 2, label: t("calendar.minutes", { n: slotMinutes * 2 }) },
              ]}
            />
          </div>
        )}
        <div className={pageStyles.formStack} style={{ gap: 6 }}>
          <span className={pageStyles.note}>{t("calendar.format.label")}</span>
          <Segmented
            full
            value={format}
            onChange={setFormat}
            label={t("calendar.format.label")}
            options={[
              { value: "office", label: t("calendar.format.office") },
              { value: "online", label: t("calendar.format.online") },
            ]}
          />
        </div>
        <TextField label={t("calendar.clientName")} value={clientName} onChange={(e) => setClientName(e.target.value)} required />
        <TextField
          label={t("calendar.clientPhone")}
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="+998 90 123 45 67"
        />
        <TextField
          label={t("calendar.matter")}
          placeholder={t("calendar.matterPlaceholder")}
          value={matter}
          onChange={(e) => setMatter(e.target.value)}
        />
        <TextAreaField label={t("calendar.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        {canTakeFee && (
          <Switch label={t("calendar.feeReceived")} hint={t("calendar.feeReceivedHint")} checked={feeReceived} onChange={setFeeReceived} />
        )}
        {feeReceived && (
          <div className={pageStyles.formStack} style={{ gap: 10 }}>
            <MoneyField label={t("payments.amount")} value={feeAmount} onChange={setFeeAmount} />
            <SelectField label={t("payments.method")} value={feeMethod} onChange={(e) => setFeeMethod(e.target.value)}>
              {FEE_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`payments.methods.${m}`)}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!clientName.trim()}>
            {t("calendar.confirmBook")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
