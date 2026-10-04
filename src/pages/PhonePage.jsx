import { useEffect, useRef, useState } from "react";
import styles from "./PhonePage.module.css";
import pageStyles from "./Pages.module.css";
import Icon from "../components/ui/Icon";
import Segmented from "../components/ui/Segmented";
import { SearchField } from "../components/ui/Field";
import { List, ListRow } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { CallTypeIcon } from "../components/calls/CallRow";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { callBridge } from "../lib/appBridge";
import { canSeeClients } from "../lib/access";
import { readPref, writePref } from "../lib/prefs";
import { useI18n } from "../i18n";

// Telefon — only inside the Ledger app, for people who call through the
// firm's line: a keypad (a client's number or a colleague's phone ID), the
// recent calls and the clients, each one tap from a call. The call itself is
// the app's (window.LedgerApp.call — recorded on the server).

const KEYS = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""],
];

const dial = (number) => callBridge("call", number);

export default function PhonePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const clients = canSeeClients(user);
  const [tab, setTab] = useState(() => readPref("phoneTab", "keypad"));
  const choose = (value) => {
    setTab(value);
    writePref("phoneTab", value);
  };
  const shown = tab === "clients" && !clients ? "keypad" : tab;

  return (
    <div>
      <PageHeader title={t("phone.title")} />
      <div className={pageStyles.stack}>
        <Segmented
          full
          value={shown}
          onChange={choose}
          label={t("phone.title")}
          options={[
            { value: "keypad", label: t("phone.keypad") },
            { value: "recent", label: t("phone.recent") },
            ...(clients ? [{ value: "clients", label: t("phone.clients") }] : []),
          ]}
        />
        {shown === "keypad" && <Keypad />}
        {shown === "recent" && <Recent />}
        {shown === "clients" && <Clients />}
      </div>
    </div>
  );
}

function Keypad() {
  const { t } = useI18n();
  const [number, setNumber] = useState("");
  const [match, setMatch] = useState(null);
  const hold = useRef(null);
  const digits = number.replace(/[^\d]/g, "");
  const colleague = /^[2-8]\d\d$/.test(number);
  const shownMatch = digits.length >= 9 ? match : null;

  // Whose number it is, once it's long enough to be one.
  useEffect(() => {
    if (digits.length < 9) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      api
        .clientLookup(number)
        .then((rows) => live && setMatch(rows[0] || null))
        .catch(() => live && setMatch(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [number, digits.length]);

  function press(key) {
    if (navigator.vibrate) navigator.vibrate(10);
    setNumber((n) => (n + key).slice(0, 20));
  }

  // A long press on 0 gives "+" (international form), like a phone's keypad.
  function startHold(key) {
    if (key !== "0") return;
    hold.current = setTimeout(() => {
      hold.current = "done";
      setNumber((n) => `${n}+`.slice(0, 20));
    }, 500);
  }
  function endHold(key) {
    if (hold.current === "done") {
      hold.current = null;
      return;
    }
    clearTimeout(hold.current);
    hold.current = null;
    press(key);
  }

  return (
    <div className={styles.dialer}>
      <input
        className={styles.display}
        value={number}
        onChange={(e) => setNumber(e.target.value.replace(/[^\d+*#]/g, "").slice(0, 20))}
        inputMode="tel"
        aria-label={t("phone.number")}
        placeholder=" "
      />
      <div className={`${styles.match} ${shownMatch?.restricted ? styles.matchMuted : ""}`}>
        {colleague ? t("phone.colleague") : shownMatch ? (shownMatch.restricted ? t("phone.otherClient") : shownMatch.name) : ""}
      </div>
      <div className={styles.keys}>
        {KEYS.map(([key, letters]) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            onPointerDown={() => startHold(key)}
            onPointerUp={() => endHold(key)}
            onPointerLeave={() => {
              if (hold.current && hold.current !== "done") clearTimeout(hold.current);
              hold.current = null;
            }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={key}
          >
            <span className={styles.digit}>{key}</span>
            <span className={styles.letters}>{letters || " "}</span>
          </button>
        ))}
      </div>
      <div className={styles.bottomRow}>
        <span />
        <button type="button" className={styles.callButton} disabled={!number} onClick={() => dial(number)} aria-label={t("common.call")}>
          <Icon name="phone" size={30} strokeWidth={2} />
        </button>
        {number ? (
          <button
            type="button"
            className={styles.erase}
            onClick={() => setNumber((n) => n.slice(0, -1))}
            onContextMenu={(e) => {
              e.preventDefault();
              setNumber("");
            }}
            aria-label={t("phone.erase")}
          >
            <Icon name="backspace" size={26} />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function CallButton({ number }) {
  const { t, fmt } = useI18n();
  return (
    <button type="button" className={styles.rowCall} onClick={() => dial(number)} aria-label={`${t("common.call")}: ${fmt.phone(number)}`}>
      <Icon name="phone" size={17} strokeWidth={2} />
    </button>
  );
}

// My recent calls, newest first; a tap calls back.
function Recent() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.calls({ pageSize: 60, sort: "newest" }), []);
  return (
    <AsyncBoundary state={state}>
      {({ calls }) =>
        calls.length === 0 ? (
          <List>
            <EmptyState icon="phone" title={t("phone.noRecent")} />
          </List>
        ) : (
          <List inset={64}>
            {calls.map((c) => {
              const client = c.client?.restricted ? null : c.client;
              return (
                <ListRow
                  key={c.id}
                  leading={<CallTypeIcon call={c} />}
                  title={client?.name || fmt.phone(c.phoneNumber) || t("phone.hidden")}
                  subtitle={[client ? fmt.phone(c.phoneNumber) : t(`callType.${c.callType}`), fmt.relative(Number(c.callTimestampMs))].filter(Boolean).join(" · ")}
                  chevron={false}
                  actions={c.phoneNumber ? <CallButton number={c.phoneNumber} /> : undefined}
                />
              );
            })}
          </List>
        )
      }
    </AsyncBoundary>
  );
}

// The clients this person may see, by name or number.
function Clients() {
  const { t, fmt } = useI18n();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const state = useAsync(() => api.clients({ q: query || undefined, page: 1 }), [query]);
  return (
    <>
      <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("phone.searchClients")} />
      <AsyncBoundary state={state}>
        {({ clients }) =>
          clients.length === 0 ? (
            <List>
              <EmptyState icon="contact" title={t("phone.noClients")} />
            </List>
          ) : (
            <List inset={16}>
              {clients.map((c) => (
                <ListRow
                  key={c.id}
                  to={`/clients/${c.id}`}
                  title={c.name}
                  subtitle={c.phone ? fmt.phone(c.phone) : t("phone.noNumber")}
                  chevron={false}
                  actions={c.phone ? <CallButton number={c.phone} /> : undefined}
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
    </>
  );
}
