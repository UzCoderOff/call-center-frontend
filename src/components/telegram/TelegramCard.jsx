import { useCallback, useEffect, useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Switch } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary, Avatar, Banner, EmptyState, KeyValue } from "../ui/Misc";
import { useAuth, isManagerRole } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Profile -> Telegram: connect your Telegram to get work notifications from
// the firm's bot, and choose which ones. Connecting is one tap: the button
// opens the bot in Telegram with a one-time code; pressing Start there
// connects it, and this card notices by itself.
const LINK_REFRESH_MS = 10 * 60 * 1000; // the code lasts 15 minutes

export default function TelegramCard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const state = useAsync(() => api.telegramMe(), []);
  const data = state.data;

  if (!data) return null;
  if (!data.bot.configured) {
    return isManagerRole(user.role) ? (
      <Card title={t("telegram.title")}>
        <p className={pageStyles.note}>{t("telegram.notConfigured")}</p>
      </Card>
    ) : null;
  }
  return data.connected ? (
    <Connected data={data} onChange={state.setData} />
  ) : (
    <NotConnected ready={data.bot.ready} onConnected={state.setData} />
  );
}

function NotConnected({ ready, onConnected }) {
  const { t } = useI18n();
  const [link, setLink] = useState(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState(false);

  const fetchLink = useCallback(() => {
    api
      .telegramLink()
      .then((l) => {
        setLink(l.url);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  // A fresh link ready before the tap (opening Telegram must happen right
  // on the tap, or phones block it), renewed before it expires.
  useEffect(() => {
    if (!ready) return undefined;
    fetchLink();
    const timer = setInterval(fetchLink, LINK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [ready, fetchLink]);

  // After the tap, look for the connection whenever they come back from
  // Telegram, and every few seconds meanwhile.
  useEffect(() => {
    if (!opened) return undefined;
    let stop = false;
    const check = () =>
      api
        .telegramMe()
        .then((me) => {
          if (!stop && me.connected) onConnected(me);
        })
        .catch(() => {});
    const timer = setInterval(check, 4000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const give_up = setTimeout(() => clearInterval(timer), 15 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(timer);
      clearTimeout(give_up);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [opened, onConnected]);

  return (
    <Card title={t("telegram.title")} subtitle={t("telegram.pitch")}>
      <div className={pageStyles.formStack}>
        <ol className={pageStyles.note} style={{ paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>{t("telegram.step1")}</li>
          <li>{t("telegram.step2")}</li>
          <li>{t("telegram.step3")}</li>
        </ol>
        {!ready ? (
          <p className={pageStyles.note}>{t("telegram.botStarting")}</p>
        ) : (
          <Button
            variant="primary"
            size="large"
            block
            icon="send"
            href={link || undefined}
            target="_blank"
            rel="noopener noreferrer"
            disabled={!link}
            onClick={() => setOpened(true)}
          >
            {t("telegram.connect")}
          </Button>
        )}
        {opened && <p className={pageStyles.note}>{t("telegram.waiting")}</p>}
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{t("telegram.linkFailed")}</p>}
      </div>
    </Card>
  );
}

function Connected({ data, onChange }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  async function toggle(key, on) {
    setMessage(null);
    const previous = data;
    onChange({ ...data, kinds: data.kinds.map((k) => (k.key === key ? { ...k, on } : k)) });
    try {
      onChange(await api.telegramPrefs({ [key]: on }));
    } catch {
      onChange(previous);
      setMessage({ error: true, text: t("telegram.saveFailed") });
    }
  }

  async function run(kind, fn, okText) {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
      if (okText) setMessage({ error: false, text: okText });
    } catch {
      setMessage({ error: true, text: t("telegram.saveFailed") });
    } finally {
      setBusy("");
    }
  }

  return (
    <Card title={t("telegram.title")} action={<Badge tone="good" icon="check">{t("telegram.connected")}</Badge>}>
      <div className={pageStyles.formStack}>
        {data.telegramName && <KeyValue label={t("telegram.account")}>{data.telegramName}</KeyValue>}
        <p className={pageStyles.note}>{t("telegram.chooseKinds")}</p>
        {data.kinds.map((k) => (
          <Switch key={k.key} label={t(`telegram.kinds.${k.key}`)} hint={t(`telegram.kindHints.${k.key}`)} checked={k.on} onChange={(on) => toggle(k.key, on)} />
        ))}
        {message && <p className={`${pageStyles.message} ${message.error ? pageStyles.messageError : pageStyles.messageSuccess}`}>{message.text}</p>}
        <div className={pageStyles.actionsRow}>
          <Button icon="send" busy={busy === "test"} onClick={() => run("test", () => api.telegramTest(), t("telegram.testSent"))}>
            {t("telegram.test")}
          </Button>
          <Button
            variant="destructive"
            busy={busy === "off"}
            onClick={() =>
              window.confirm(t("telegram.disconnectConfirm")) &&
              run("off", async () => {
                await api.telegramDisconnect();
                onChange(await api.telegramMe());
              })
            }
          >
            {t("telegram.disconnect")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Settings (boss, developer): is the bot running, and who hasn't connected
// yet — to help everyone get set up.
export function TelegramOverview() {
  const { t } = useI18n();
  const state = useAsync(() => api.telegramOverview(), []);
  return (
    <section>
      <ListSectionHeader>{t("telegram.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {({ bot, people }) => {
          const connected = people.filter((p) => p.connected).length;
          return (
            <div className={pageStyles.stack}>
              {!bot.configured ? (
                <Banner icon="alertCircle">{t("telegram.notConfigured")}</Banner>
              ) : bot.status === "error" ? (
                <Banner tone="warning" icon="alertTriangle">
                  {t(`telegram.errors.${bot.error}`)}
                </Banner>
              ) : (
                <Banner icon="send">{t("telegram.running", { bot: bot.username ? `@${bot.username}` : "…", connected, total: people.length })}</Banner>
              )}
              {people.length === 0 ? (
                <List>
                  <EmptyState icon="users" text={t("telegram.nobody")} />
                </List>
              ) : (
                <List inset={62}>
                  {people.map((p) => (
                    <ListRow
                      key={p.userId}
                      leading={<Avatar name={p.name} size={34} />}
                      title={p.name}
                      subtitle={p.position || t(`roles.${p.role}`)}
                      trailing={
                        p.connected ? (
                          <Badge tone="good" icon="check">
                            {p.telegramName || t("telegram.connected")}
                          </Badge>
                        ) : (
                          <Badge>{t("telegram.notConnected")}</Badge>
                        )
                      }
                    />
                  ))}
                </List>
              )}
            </div>
          );
        }}
      </AsyncBoundary>
    </section>
  );
}
