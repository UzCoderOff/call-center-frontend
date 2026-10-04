import { useState } from "react";
import Button from "./ui/Button";
import { Banner } from "./ui/Misc";
import { enableWebPush, webPushPermission } from "../lib/webPush";
import { readPref, writePref } from "../lib/prefs";
import { useI18n } from "../i18n";

// Home page, in a browser that hasn't been asked yet: switch on Ledger's
// notifications here (chat, reminders, missed calls…). "Later" hides it.
export default function WebPushBanner({ className }) {
  const { t } = useI18n();
  const [state, setState] = useState(() => webPushPermission());
  const [later, setLater] = useState(() => readPref("webPushLater", false));
  const [busy, setBusy] = useState(false);
  if (state !== "default" || later) return null;

  async function enable() {
    setBusy(true);
    try {
      setState(await enableWebPush());
    } catch {
      setState(webPushPermission());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Banner
        icon="bell"
        action={
          <>
            <Button size="small" variant="primary" busy={busy} onClick={enable}>
              {t("webPush.enable")}
            </Button>
            <Button
              size="small"
              variant="plain"
              onClick={() => {
                writePref("webPushLater", true);
                setLater(true);
              }}
            >
              {t("webPush.later")}
            </Button>
          </>
        }
      >
        <strong>{t("webPush.title")}</strong>
        <div>{t("webPush.text")}</div>
      </Banner>
    </div>
  );
}

// Profile: how notifications stand in this browser, and switching them on.
export function WebPushStatus() {
  const { t } = useI18n();
  const [state, setState] = useState(() => webPushPermission());
  const [busy, setBusy] = useState(false);
  if (state === "unsupported") return <p style={{ margin: 0 }}>{t("webPush.unsupported")}</p>;
  if (state === "granted") return <p style={{ margin: 0 }}>{t("webPush.on")}</p>;
  if (state === "denied") return <p style={{ margin: 0 }}>{t("webPush.blocked")}</p>;
  return (
    <Button
      variant="primary"
      icon="bell"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          setState(await enableWebPush());
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("webPush.enable")}
    </Button>
  );
}
