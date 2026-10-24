import { useEffect, useState } from "react";
import styles from "./LiveCalls.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { ListRow } from "../ui/List";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Client calls going on right now on Ledger's line — who's talking with whom —
// and listening to one live. Only for the developer and accounts with
// "listens to calls" (backend services/pbx/live.js); refreshed every few
// seconds while the page is open. Listening is silent: nobody on the call
// can tell.
export default function LiveCalls() {
  const { t, fmt } = useI18n();
  const [data, setData] = useState({ calls: null, at: 0 });
  const [now, setNow] = useState(Date.now());
  const [listening, setListening] = useState(null); // { id, url }
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let timer;
    const load = async () => {
      try {
        const res = await api.liveCalls();
        if (alive) setData({ calls: res.calls, at: Date.now() });
      } catch {
        if (alive) setData((d) => ({ calls: d.calls ?? [], at: d.at }));
      }
      if (alive) timer = setTimeout(load, document.hidden ? 10000 : 3000);
    };
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, []);

  const calls = data.calls;
  // The call ended (or was taken in): stop listening.
  const listeningTo = listening && calls?.some((c) => c.id === listening.id) ? listening : null;

  async function listen(call) {
    setError("");
    try {
      const { url } = await api.listenCall(call.id);
      setListening({ id: call.id, url });
    } catch {
      setError(t("live.listenFailed"));
    }
  }

  if (!calls) return null;
  const elapsed = Math.max(0, Math.round((now - data.at) / 1000));
  const status = (c) => {
    const people = c.people.map((p) => p.name).join(", ");
    if (c.state === "talking") return t("live.talking", { people });
    if (c.state === "ringing") return t("live.ringing", { people });
    return t("live.waiting");
  };

  return (
    <Card title={t("live.title")} subtitle={calls.length ? null : t("live.none")} className={styles.card}>
      {error && <p className={styles.error}>{error}</p>}
      {calls.map((c) => (
        <div key={c.id}>
          <ListRow
            to={c.client ? `/clients/${c.client.id}` : undefined}
            chevron={false}
            leading={<span className={`${styles.dot} ${styles[c.state]}`} aria-hidden="true" />}
            title={c.client?.name || fmt.phone(c.number)}
            subtitle={[c.direction === "out" ? t("live.out") : t("live.in"), c.client ? fmt.phone(c.number) : null, status(c)].filter(Boolean).join(" · ")}
            trailing={<span className="tabular">{fmt.clock(c.seconds + elapsed)}</span>}
            actions={
              c.canListen &&
              (listeningTo?.id === c.id ? (
                <Button size="small" variant="secondary" onClick={() => setListening(null)}>
                  {t("live.stop")}
                </Button>
              ) : (
                <Button size="small" variant="primary" onClick={() => listen(c)}>
                  {t("live.listen")}
                </Button>
              ))
            }
          />
          {listeningTo?.id === c.id && (
            <div className={styles.player}>
              <audio src={listeningTo.url} autoPlay controls className={styles.audio} />
              <span className={styles.note}>{t("live.listenNote")}</span>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
