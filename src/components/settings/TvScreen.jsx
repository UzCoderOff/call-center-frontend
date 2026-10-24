import { useState } from "react";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary, CopyButton } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Settings → the office TV (pages/WallboardPage.jsx): the link to open once
// on the TV's browser. It needs no login, so it's a long secret — a new one
// stops the old, "Oʻchirish" stops it altogether.
export function TvScreenSection() {
  const { t } = useI18n();
  const state = useAsync(() => api.wallboardLink(), []);
  const [busy, setBusy] = useState(false);
  const url = state.data?.link ? `${window.location.origin}/tv/${state.data.link.token}` : null;

  async function change(fn) {
    setBusy(true);
    try {
      state.setData(await fn());
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <ListSectionHeader>{t("tv.settingsTitle")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {() => (
          <List inset={64}>
            <ListRow
              leading={
                <span className={styles.tile}>
                  <Icon name="barChart" size={18} />
                </span>
              }
              title={url ? t("tv.linkOn") : t("tv.linkOff")}
              subtitle={url ? <span style={{ wordBreak: "break-all" }}>{url}</span> : t("tv.linkOffHint")}
              trailing={url ? <CopyButton value={url} /> : null}
            />
          </List>
        )}
      </AsyncBoundary>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <Button size="small" icon="refresh" busy={busy} onClick={() => change(() => api.newWallboardLink())}>
          {url ? t("tv.newLink") : t("tv.makeLink")}
        </Button>
        {url && (
          <>
            <Button size="small" icon="externalLink" href={url} target="_blank" rel="noreferrer">
              {t("tv.open")}
            </Button>
            <Button size="small" icon="x" disabled={busy} onClick={() => change(() => api.stopWallboardLink())}>
              {t("tv.stop")}
            </Button>
          </>
        )}
      </div>
      <p className={styles.footnote}>{t("tv.hint")}</p>
    </section>
  );
}
