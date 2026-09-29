import { useState } from "react";
import { Link } from "react-router-dom";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import { MoneyField, SelectField, TextAreaField } from "../ui/Field";
import Badge from "../ui/Badge";
import { CONSULTATION_FEE, FEE_METHODS } from "./BookingSheet";
import { canBookAppointments, isLawyer } from "../../lib/access";
import { KeyValue } from "../ui/Misc";
import { AppointmentStatusBadge } from "./Appointment";
import { useAuth, isManagerRole } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import { telHref } from "../../lib/format";
import { useI18n } from "../../i18n";

// One appointment: details, a call button, and what the viewer may do —
// the lawyer marks attended / no-show; whoever booked it (or a manager) can
// cancel it before it happens.
export default function AppointmentSheet({ appointment, canManage, today, onClose, onChanged }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  // Recording the consultation fee after booking.
  const [takingFee, setTakingFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState(String(CONSULTATION_FEE));
  const [feeMethod, setFeeMethod] = useState("cash");
  const a = appointment;
  const fee = a.payments?.[0] || null;
  const mayTakeFee = !fee && a.status !== "cancelled" && !isLawyer(user) && canBookAppointments(user);

  async function recordFee() {
    if (!Number(feeAmount)) return setError(t("payments.amountRequired"));
    setBusy("fee");
    setError("");
    try {
      onChanged(await api.appointmentFee(a.id, { feeAmount: Number(feeAmount), feeMethod }));
      setTakingFee(false);
    } catch (err) {
      setError(err.code === "phone_required_for_fee" ? t("calendar.feeNeedsPhone") : t("calendar.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = a.date > today || (a.date === today && a.start > nowMinutes);
  const started = !upcoming;
  const mayCancel =
    a.status === "booked" && upcoming && (canManage || a.bookedBy?.id === user.id || isManagerRole(user.role));
  const booker = a.bookedBy?.employee?.name || a.bookedBy?.username;
  const tel = telHref(a.clientPhone);

  async function setStatus(status, extra = {}) {
    setBusy(status);
    setError("");
    try {
      onChanged(await api.updateAppointment(a.id, { status, ...extra }));
    } catch {
      setError(t("calendar.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={a.clientName} onClose={onClose}>
      <div>
        <KeyValue label={t("calendar.status")}>
          <AppointmentStatusBadge status={a.status} />
        </KeyValue>
        <KeyValue label={t("calendar.when")}>
          {fmt.isoDay(a.date)}, {fmt.minutes(a.start)}–{fmt.minutes(a.end)}
        </KeyValue>
        {a.clientPhone && <KeyValue label={t("calendar.phone")}>{fmt.phone(a.clientPhone)}</KeyValue>}
        {a.matter && <KeyValue label={t("calendar.matter")}>{a.matter}</KeyValue>}
        {a.notes && <KeyValue label={t("calendar.notes")}>{a.notes}</KeyValue>}
        {booker && <KeyValue label={t("calendar.bookedBy")}>{booker}</KeyValue>}
        <KeyValue label={t("calendar.fee")}>
          {fee ? (
            <Badge tone="good" icon="check">
              {`${fmt.money(fee.amount)} · ${t(`payments.methods.${fee.method || "cash"}`)}`}
            </Badge>
          ) : (
            <Badge tone="warning">{t("calendar.feeNotPaid")}</Badge>
          )}
        </KeyValue>
        {a.cancelReason && <KeyValue label={t("calendar.cancelReason")}>{a.cancelReason}</KeyValue>}
        {a.callLogId && (
          <KeyValue label={t("calendar.call")}>
            <Link to={`/calls/${a.callLogId}`} onClick={onClose}>
              {t("calendar.openCall")}
            </Link>
          </KeyValue>
        )}
      </div>

      {tel && (
        <Button variant="primary" icon="phone" href={tel} block>
          {t("common.call")}
        </Button>
      )}

      {mayTakeFee &&
        (takingFee ? (
          <div className={pageStyles.formStack}>
            <MoneyField label={t("payments.amount")} value={feeAmount} onChange={setFeeAmount} />
            <SelectField label={t("payments.method")} value={feeMethod} onChange={(e) => setFeeMethod(e.target.value)}>
              {FEE_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`payments.methods.${m}`)}
                </option>
              ))}
            </SelectField>
            <div className={pageStyles.formActions}>
              <Button onClick={() => setTakingFee(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" icon="cash" busy={busy === "fee"} onClick={recordFee}>
                {t("calendar.saveFee")}
              </Button>
            </div>
          </div>
        ) : (
          <Button icon="cash" block onClick={() => setTakingFee(true)}>
            {t("calendar.takeFee")}
          </Button>
        ))}

      {canManage && started && a.status !== "cancelled" && (
        <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
          <Button icon="checkCircle" busy={busy === "attended"} disabled={a.status === "attended"} onClick={() => setStatus("attended")}>
            {t("calendar.markAttended")}
          </Button>
          <Button icon="alertCircle" busy={busy === "no_show"} disabled={a.status === "no_show"} onClick={() => setStatus("no_show")}>
            {t("calendar.markNoShow")}
          </Button>
        </div>
      )}

      {mayCancel &&
        (cancelling ? (
          <div className={pageStyles.formStack}>
            <TextAreaField label={t("calendar.cancelReason")} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            <div className={pageStyles.formActions}>
              <Button onClick={() => setCancelling(false)}>{t("common.cancel")}</Button>
              <Button variant="destructive" busy={busy === "cancelled"} onClick={() => setStatus("cancelled", { cancelReason: reason })}>
                {t("calendar.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive" block onClick={() => setCancelling(true)}>
            {t("calendar.cancel")}
          </Button>
        ))}

      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
    </Sheet>
  );
}
