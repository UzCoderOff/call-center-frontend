import { useEffect, useMemo, useState } from "react";
import styles from "./Cases.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { SearchField } from "../ui/Field";
import { Banner } from "../ui/Misc";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Court hearings from sud.uz (services/courts/sync.js on the server):
//   - CourtPicker: which court on sud.uz a case is in (the case form). Most
//     of the time it needn't be picked — a number written as the court
//     writes it (2-1001-2607/59591) says which court it began in
//   - CourtFindBanner: "is this our client?" — one tap, yes or no
//   - SudLine: the court the case is followed in, and "check now"

const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Every court, read once a visit.
let courtsOnce = null;
function useCourts() {
  const [courts, setCourts] = useState(null);
  useEffect(() => {
    let alive = true;
    courtsOnce = courtsOnce || api.courts().then((r) => r.courts).catch((err) => ((courtsOnce = null), Promise.reject(err)));
    courtsOnce.then((list) => alive && setCourts(list)).catch(() => alive && setCourts([]));
    return () => {
      alive = false;
    };
  }, []);
  return courts;
}

// For matching what's typed: lowercase, no apostrophes, x = h.
const plain = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/h/g, "x");

function courtLabel(court, t) {
  if (!court) return "";
  return `${court.name} (${t(`courts.types.${court.type}`)})`;
}

// `value`: the court's key or null; onChange(court | null).
export function CourtPicker({ value, onChange }) {
  const { t } = useI18n();
  const courts = useCourts();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = useMemo(() => (courts || []).find((c) => c.key === value) || null, [courts, value]);
  const found = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    if (!courts || words.length === 0) return [];
    return courts
      .filter((c) => {
        const hay = plain(`${c.name} ${t(`courts.types.${c.type}`)} ${c.region ? t(`courts.regions.${c.region}`) : ""}`);
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 8);
  }, [courts, query, t]);

  return (
    <div className={styles.courtPicker}>
      <span className={styles.courtPickerLabel}>{t("courts.pickerLabel")}</span>
      {current && !open ? (
        <div className={styles.courtChosen}>
          <Icon name="briefcase" size={15} />
          <span>{courtLabel(current, t)}</span>
          <button type="button" className={styles.courtLink} onClick={() => setOpen(true)}>
            {t("courts.change")}
          </button>
          <button type="button" className={styles.courtLink} onClick={() => onChange(null)}>
            {t("courts.clear")}
          </button>
        </div>
      ) : open ? (
        <div>
          <SearchField autoFocus value={query} placeholder={t("courts.searchPlaceholder")} onChange={(e) => setQuery(e.target.value)} />
          {courts == null && <p className={pageStyles.note}>{t("common.loading")}</p>}
          {found.length > 0 && (
            <ul className={styles.courtResults}>
              {found.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <strong>{c.name}</strong>
                    <span>{[t(`courts.types.${c.type}`), c.region ? t(`courts.regions.${c.region}`) : null].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query && courts && found.length === 0 && <p className={pageStyles.note}>{t("courts.nothingFound")}</p>}
          <button type="button" className={styles.courtLink} onClick={() => (setOpen(false), setQuery(""))}>
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button type="button" className={styles.courtLink} onClick={() => setOpen(true)}>
          {t("courts.pick")}
        </button>
      )}
      <p className={pageStyles.note}>{t("courts.pickerHint")}</p>
    </div>
  );
}

// "Sud.uz: is this our client?" on the case — Yes / No.
export function CourtFindBanner({ find, onAnswered }) {
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(null);
  async function reply(ours) {
    setBusy(ours ? "yes" : "no");
    try {
      await api.answerCourtFind(find.id, ours);
      onAnswered();
    } catch (err) {
      saveFailed(err, t);
      setBusy(null);
    }
  }
  const sides = find.parties || {};
  return (
    <div className={styles.ask}>
      <Banner
        tone="accent"
        icon="search"
        action={
          <span className={styles.courtAnswers}>
            <Button size="small" variant="primary" busy={busy === "yes"} disabled={Boolean(busy)} onClick={() => reply(true)}>
              {t("courts.yes")}
            </Button>
            <Button size="small" busy={busy === "no"} disabled={Boolean(busy)} onClick={() => reply(false)}>
              {t("courts.no")}
            </Button>
          </span>
        }
      >
        <strong>{t("courts.askTitle")}</strong>
        <div className={pageStyles.bannerDetail}>
          {[courtLabel(find.court, t), `№ ${find.number}`, `${fmt.isoDateLong(find.date)}${find.time != null ? `, ${clock(find.time)}` : ""}`, find.stage ? t(`cases.stages.${find.stage}`) : null].filter(Boolean).join(" · ")}
        </div>
        {find.category && <div className={pageStyles.bannerDetail}>{find.category}</div>}
        {(sides.claimant?.length > 0 || sides.defendant?.length > 0) && (
          <div className={pageStyles.bannerDetail}>
            {sides.claimant?.length > 0 && (
              <span className={find.side === "claimant" ? styles.courtSideMine : undefined}>
                {t("courts.claimant")}: {sides.claimant.join(", ")}
              </span>
            )}
            {sides.claimant?.length > 0 && sides.defendant?.length > 0 && " · "}
            {sides.defendant?.length > 0 && (
              <span className={find.side === "defendant" ? styles.courtSideMine : undefined}>
                {t("courts.defendant")}: {sides.defendant.join(", ")}
              </span>
            )}
          </div>
        )}
        {find.judge && <div className={pageStyles.bannerDetail}>{t("courts.judge", { name: find.judge })}</div>}
        <div className={pageStyles.bannerDetail}>{t("courts.askHint")}</div>
      </Banner>
    </div>
  );
}

// Under the case's title: the court it's followed in on sud.uz, and "check now".
export function SudLine({ item, onChecked }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const followed = Boolean(item.sudCourt && item.number);
  async function check() {
    setBusy(true);
    setSaid("");
    try {
      const r = await api.checkCourts(item.id);
      const news = (r.added || 0) + (r.moved || 0) + (r.changed || 0) + (r.asked || 0) + (r.stages || 0);
      if (r.running) setSaid(t("courts.stillChecking"));
      else if (r.paused || (r.read === 0 && r.failed > 0)) setSaid(t("courts.checkFailed"));
      else setSaid(news ? t("courts.checkNews", { count: news }) : t("courts.checkNothing"));
      if (news) onChecked();
    } catch (err) {
      setSaid(err.code === "too_soon" ? t("courts.tooSoon") : err.code === "busy" ? t("courts.busy") : t("courts.checkFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <p className={styles.sudLine}>
      <Icon name="briefcase" size={14} />
      <span>{followed ? t("courts.followed", { court: courtLabel(item.sudCourt, t) }) : item.number ? t("courts.numberOnly") : t("courts.byName")}</span>
      <button type="button" className={styles.courtLink} onClick={check} disabled={busy}>
        {busy ? t("courts.checking") : t("courts.checkNow")}
      </button>
      {said && <span className={styles.sudSaid}>{said}</span>}
    </p>
  );
}
