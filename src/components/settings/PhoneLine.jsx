import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Sheet from "../ui/Sheet";
import Icon from "../ui/Icon";
import { Switch, TextField } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary, KeyValue } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Settings → Ledger's own phone line (backend: routes/pbx.js, pbx/README.md):
// whether it runs, the company number, everyone on it and whether their
// phone is connected now. The developer can make a one-time test sign-in
// for a softphone (MicroSIP, Zoiper) on someone's phone ID.
export function PhoneLineSection({ canEdit }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.pbxStatus(), []);
  const [editing, setEditing] = useState(false);
  const [signIn, setSignIn] = useState(null);
  const [error, setError] = useState("");

  async function testSignIn(person) {
    if (!confirm(t("pbx.confirmTestSignIn", { name: person.name }))) return;
    setError("");
    try {
      setSignIn({ name: person.name, ...(await api.pbxSoftphone(person.employeeId)) });
      state.reload();
    } catch (err) {
      setError(t("pbx.signInFailed", { reason: err.code || "?" }));
    }
  }

  const phoneStatus = (p) => {
    if (p.restingUntil) return t("pbx.resting", { time: fmt.time(p.restingUntil) });
    if (!p.signedIn) return t("pbx.notSignedIn");
    if (p.online === true) return t("pbx.online");
    return p.viaApp ? t("pbx.viaApp") : t("pbx.viaSoftphone");
  };

  return (
    <section>
      <ListSectionHeader>{t("pbx.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) =>
          !data.enabled ? (
            <List inset={64}>
              <ListRow leading={<span className={styles.tile}><Icon name="phone" size={18} /></span>} title={t("pbx.off")} subtitle={t("pbx.offHint")} />
            </List>
          ) : (
            <List inset={64}>
              <ListRow
                onClick={canEdit ? () => setEditing(true) : undefined}
                chevron={canEdit}
                leading={<span className={styles.tile}><Icon name="phone" size={18} /></span>}
                title={data.connected ? t("pbx.running") : t("pbx.notConnected")}
                subtitle={[data.settings.companyNumber ? fmt.phone(data.settings.companyNumber) : t("pbx.noNumber"), data.settings.trunkEnabled ? t("pbx.trunkOn") : t("pbx.trunkOff")].join(" · ")}
              />
              {data.people.map((p) => (
                <ListRow
                  key={p.ext}
                  title={`${p.ext} · ${p.name}`}
                  subtitle={[p.callCenter ? t("pbx.answersLine") : null, p.canCallOut ? null : t("pbx.colleaguesOnly"), phoneStatus(p)].filter(Boolean).join(" · ")}
                  trailing={
                    canEdit && data.canIssue ? (
                      <Button size="small" variant="plain" onClick={() => testSignIn(p)}>
                        {t("pbx.testSignIn")}
                      </Button>
                    ) : p.online ? (
                      <Badge tone="good">{t("pbx.online")}</Badge>
                    ) : null
                  }
                />
              ))}
              {data.people.length === 0 && <ListRow title={t("pbx.nobody")} subtitle={t("pbx.nobodyHint")} />}
            </List>
          )
        }
      </AsyncBoundary>
      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
      <p className={styles.footnote}>{t("pbx.hint")}</p>
      {editing && state.data && (
        <PhoneLineSettings
          settings={state.data.settings}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            state.reload();
          }}
        />
      )}
      {signIn && <TestSignIn signIn={signIn} onClose={() => setSignIn(null)} />}
    </section>
  );
}

// The company number and whether the outside line is connected (only then
// can staff call clients).
function PhoneLineSettings({ settings, onClose, onSaved }) {
  const { t } = useI18n();
  const [companyNumber, setCompanyNumber] = useState(settings.companyNumber || "");
  const [trunkEnabled, setTrunkEnabled] = useState(Boolean(settings.trunkEnabled));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.savePbxSettings({ companyNumber, trunkEnabled });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || err.message || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("pbx.title")} onClose={onClose}>
      <form className={pageStyles.formStack} onSubmit={save}>
        <TextField label={t("pbx.companyNumber")} hint={t("pbx.companyNumberHint")} inputMode="tel" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="+998 78 113 00 00" />
        <Switch label={t("pbx.trunk")} hint={t("pbx.trunkHint")} checked={trunkEnabled} onChange={setTrunkEnabled} />
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

// A test sign-in, shown once.
function TestSignIn({ signIn, onClose }) {
  const { t } = useI18n();
  const server = `${signIn.domain}:${signIn.port}`;
  return (
    <Sheet title={t("pbx.testSignInTitle", { name: signIn.name })} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("pbx.testSignInHint")}</p>
        <KeyValue label={t("pbx.server")} mono>{server}</KeyValue>
        <KeyValue label={t("pbx.username")} mono>{signIn.ext}</KeyValue>
        <KeyValue label={t("pbx.password")} mono>{signIn.password}</KeyValue>
        <KeyValue label={t("pbx.transport")}>{t("pbx.transportValue")}</KeyValue>
        <div className={pageStyles.formActions}>
          <Button variant="primary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
