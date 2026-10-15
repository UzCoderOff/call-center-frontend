import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import clientStyles from "../clients/Clients.module.css";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { List, ListRow } from "../ui/List";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { isLawyer, isManager } from "../../lib/access";
import { saveFailed } from "../../lib/saveFailed";
import { shiftIso, todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// "Yoʻqligimda kim qaraydi?" — a lawyer away (leave, sick, a long trial
// elsewhere) and the colleague who looks after their cases meanwhile
// (routes/covers.js): for those days the colleague is on each of their open
// cases, sees them and their dates. The boss sets one for any lawyer.

export function useCovers() {
  return useAsync(() => api.covers(), []);
}

export default function Covers({ state }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const covers = state.data?.covers || [];
  const mayAdd = isLawyer(user) || isManager(user);
  if (!mayAdd && covers.length === 0) return null;

  async function end(c) {
    if (!confirm(t("covers.endConfirm"))) return;
    try {
      await api.updateCover(c.id, { end: true });
      state.reload();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <Card
      flush
      title={t("covers.title")}
      subtitle={covers.length ? undefined : t("covers.hint")}
      action={
        mayAdd && (
          <Button size="small" icon="users" onClick={() => setAdding(true)}>
            {t("covers.add")}
          </Button>
        )
      }
    >
      {covers.length > 0 && (
        <List plain inset={16}>
          {covers.map((c) => (
            <ListRow
              key={c.id}
              title={
                c.cover.id === user.id
                  ? t("covers.youCover", { name: c.lawyer.name })
                  : c.lawyer.id === user.id
                    ? t("covers.coversYou", { name: c.cover.name })
                    : t("covers.covers", { cover: c.cover.name, lawyer: c.lawyer.name })
              }
              subtitle={[`${fmt.isoDateLong(c.from)} — ${fmt.isoDateLong(c.to)}`, c.running ? t("covers.running", { count: c.cases }) : t("covers.ahead"), c.note].filter(Boolean).join(" · ")}
              trailing={
                <Button size="small" variant="plain" onClick={() => end(c)}>
                  {t("covers.end")}
                </Button>
              }
            />
          ))}
        </List>
      )}
      {adding && <CoverSheet onClose={() => setAdding(false)} onSaved={() => (setAdding(false), state.reload())} />}
    </Card>
  );
}

function CoverSheet({ onClose, onSaved }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const lawyers = useAsync(() => api.coverLawyers(), []);
  const manager = isManager(user);
  const [lawyerId, setLawyerId] = useState(isLawyer(user) || user.role === "BOSS" ? String(user.id) : "");
  const [coverId, setCoverId] = useState("");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(shiftIso(todayIso(), 6));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!lawyerId || !coverId) return setError(t("covers.pickBoth"));
    if (lawyerId === coverId) return setError(t("covers.notSelf"));
    if (!to || to < from) return setError(t("covers.badDates"));
    setBusy(true);
    setError("");
    try {
      await api.addCover({ lawyerId: Number(lawyerId), coverId: Number(coverId), from, to, note: note.trim() || null });
      onSaved();
    } catch (err) {
      setError(err.code === "overlaps" ? t("covers.overlaps") : err.code === "too long" ? t("covers.tooLong") : err.code === "already over" ? t("covers.badDates") : t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  const list = lawyers.data || [];
  return (
    <Sheet title={t("covers.add")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("covers.explain")}</p>
        {manager && (
          <SelectField label={t("covers.away")} value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
            <option value="">{t("covers.pick")}</option>
            {list.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id === user.id ? t("personal.me") : l.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label={t("covers.who")} value={coverId} onChange={(e) => setCoverId(e.target.value)}>
          <option value="">{t("covers.pick")}</option>
          {list
            .filter((l) => String(l.id) !== lawyerId)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </SelectField>
        <div className={clientStyles.twoCol}>
          <TextField label={t("covers.from")} type="date" value={from} min={todayIso()} onChange={(e) => setFrom(e.target.value)} />
          <TextField label={t("covers.to")} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <TextField label={t("covers.note")} placeholder={t("covers.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
