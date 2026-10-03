import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import Icon from "../ui/Icon";
import { Switch, TextField } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Settings → old consultations: a client with no contract who has had
// nothing happen for so many days goes to the archive by itself (backend:
// services/clientArchive.js). The developer changes it, the boss sees it.
export function ClientArchiveSection() {
  const { t } = useI18n();
  const state = useAsync(() => api.clientArchiveRules(), []);
  const [open, setOpen] = useState(false);

  return (
    <section>
      <ListSectionHeader>{t("rules.archive.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) => (
          <List inset={64}>
            <ListRow
              onClick={data.canEdit ? () => setOpen(true) : undefined}
              chevron={data.canEdit}
              leading={<span className={styles.tile}><Icon name="archive" size={18} /></span>}
              title={data.enabled ? t("rules.archive.on", { days: data.days }) : t("rules.archive.off")}
            />
          </List>
        )}
      </AsyncBoundary>
      {state.data && <p className={styles.footnote}>{t("rules.archive.hint", { days: state.data.days })}</p>}
      {open && state.data && (
        <ArchiveSheet
          rules={state.data}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            state.reload();
          }}
        />
      )}
    </section>
  );
}

function ArchiveSheet({ rules, onClose, onSaved }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(rules.enabled);
  const [days, setDays] = useState(String(rules.days));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveClientArchiveRules({ enabled, days: Number(days) });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || err.message || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("rules.archive.title")} onClose={onClose}>
      <form className={pageStyles.formStack} onSubmit={save}>
        <Switch label={t("rules.archive.enabled")} checked={enabled} onChange={setEnabled} />
        <TextField label={t("rules.archive.days")} type="number" min={3} max={365} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} disabled={!enabled} />
        <p className={pageStyles.note}>{t("rules.archive.hint", { days: days || "?" })}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
