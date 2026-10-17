import { Link } from "react-router-dom";
import styles from "./Clients.module.css";
import Icon from "../ui/Icon";
import Badge from "../ui/Badge";
import { useI18n } from "../../i18n";

// The timeline's pieces, shared by the client's page and a case's page: the
// icon and the words for each kind of entry — recorded changes, notes, typed
// history entries (a hearing, a decision… — services/caseEntries.js), case
// tasks — and the list itself.

export const CALL_ICON ={ incoming: "phoneIncoming", outgoing: "phoneOutgoing" };
export const EVENT_ICON = {
  import: "upload",
  note: "note",
  archive: "minusCircle",
  keep: "clock",
  restore: "refresh",
  merge: "link",
  status: "checkCircle",
  stage: "briefcase",
  stage_row: "briefcase",
  date_row: "calendar",
  assign: "users",
  case_edit: "edit",
  case: "plus",
  follow_up: "bell",
  contact: "user",
  file: "file",
  lost: "minusCircle",
  consult_summary: "note",
  task: "checkCircle",
  schedule: "calendar",
};
// How a talk happened, when it wasn't a call in Ledger.
export const CHANNEL_ICON = { telegram: "send", meeting: "users", phone: "smartphone", sms: "note" };
// A history entry's kind.
export const ENTRY_TYPES = ["hearing", "filed", "decision", "meeting", "call", "other"];
export const ENTRY_ICON = { hearing: "briefcase", filed: "upload", decision: "file", meeting: "users", call: "phone", other: "note" };

export function entryIcon(e) {
  if (e.kind === "note" && e.data?.type) return ENTRY_ICON[e.data.type] || "note";
  if (e.kind === "note" && e.data?.channel) return CHANNEL_ICON[e.data.channel];
  return EVENT_ICON[e.kind] || "briefcase";
}

const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// A typed entry in words: "Sud majlisi · Keyinga qoldirildi: … — keyingi:
// 20-okt, 10:00".
export function entryText(e, t, fmt) {
  const d = e.data || {};
  const head = [t(`entries.types.${d.type}`), d.result ? t(`entries.results.${d.type}.${d.result}`) : null].filter(Boolean).join(" · ");
  const extra = [
    d.what,
    d.with ? t("entries.with", { who: d.with }) : null,
    d.place,
    d.on ? fmt.isoDateLong(d.on) : null,
    d.next ? t("entries.next", { when: `${fmt.isoDay(d.next.date)}${d.next.time != null ? `, ${clock(d.next.time)}` : ""}` }) : null,
    d.deadline ? t("entries.deadline", { title: d.deadline.title, date: fmt.isoDateLong(d.deadline.date) }) : null,
  ].filter(Boolean);
  return `${head}${e.text ? `: ${e.text}` : ""}${extra.length ? ` — ${extra.join(" · ")}` : ""}`;
}

// Where an entry sits in time: a history entry written later about an
// earlier day ("on") goes on that day (at noon), so the timeline reads in the
// order things happened; anything else, when it was recorded.
export function entryTime(e) {
  const recorded = new Date(e.createdAt);
  const on = e.kind === "note" ? e.data?.on : null;
  if (!on) return recorded.getTime();
  const ymd = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, "0")}-${String(recorded.getDate()).padStart(2, "0")}`;
  if (on === ymd) return recorded.getTime();
  const [y, m, d] = on.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

// A typed entry for the list: its kind in bold, the result as a label, the
// words, and small tags — the day, where, with whom, the next date, the
// deadline, the document. `files`: the client's (for the document's name).
const RESULT_TONE = { postponed: "warning", heard: "accent", decided: "good", not_held: "critical", won: "good", partly: "warning", lost: "critical" };
export function entryParts(e, t, fmt, files) {
  const d = e.data || {};
  if (e.kind !== "note" || !d.type) return null;
  const tags = [
    d.on ? { icon: "calendar", text: fmt.isoDateLong(d.on) } : null,
    d.what ? { icon: "file", text: d.what } : null,
    d.with ? { icon: "users", text: t("entries.with", { who: d.with }) } : null,
    d.place ? { icon: "briefcase", text: d.place } : null,
    d.next ? { icon: "arrowRight", text: t("entries.next", { when: `${fmt.isoDay(d.next.date)}${d.next.time != null ? `, ${clock(d.next.time)}` : ""}` }), tone: "accent" } : null,
    d.deadline ? { icon: "clock", text: t("entries.deadline", { title: d.deadline.title, date: fmt.isoDateLong(d.deadline.date) }), tone: "warning" } : null,
    entryFile(e, files) ? { icon: "file", text: entryFile(e, files).replace(/^📎 /, "") } : null,
  ].filter(Boolean);
  return {
    title: t(`entries.types.${d.type}`),
    badge: d.result ? { text: t(`entries.results.${d.type}.${d.result}`), tone: RESULT_TONE[d.result] || "neutral" } : null,
    text: e.text || null,
    tags,
  };
}

// "📎 qaror.pdf" — the document an entry points at, when it's still there.
export function entryFile(e, files) {
  const id = e.data?.fileId;
  if (!id) return null;
  const f = (files || []).find((x) => x.id === id);
  return f ? `📎 ${f.title || f.name}` : null;
}

// One line of the timeline for a recorded change, in words.
export function useEventText() {
  const { t, fmt } = useI18n();
  return (e) => {
    const d = e.data || {};
    const [from, to] = (e.text || "").split(">");
    switch (e.kind) {
      case "status":
        return t("clients.events.status", { from: from ? t(`cases.statuses.${from}`) : "—", to: to ? t(`cases.statuses.${to}`) : "—" });
      case "stage":
        return t("clients.events.stage", { from: from ? t(`cases.stages.${from}`) : "—", to: to ? t(`cases.stages.${to}`) : "—" });
      case "stage_row":
        if (d.action === "clear") return t("caseWork.events.stageClear");
        return t(`caseWork.events.stage_${d.action}`, { stage: d.stage ? t(`cases.stages.${d.stage}`) : "—", date: d.date ? fmt.isoDateLong(d.date) : "—" });
      case "date_row":
        return t(`caseWork.events.date_${d.action}`, { title: d.title || t(`caseWork.kinds.${d.kind || "other"}`), date: d.date ? fmt.isoDateLong(d.date) : "—", outcome: d.outcome || "" });
      case "assign":
        return d.to ? t("caseWork.events.assign", { role: t(`cases.${d.role}`), name: d.to }) : t("caseWork.events.unassign", { role: t(`cases.${d.role}`), name: d.from || "—" });
      case "case_edit":
        return t("caseWork.events.edit", {
          fields: (d.changes || []).map((c) => `${t(`caseWork.fields.${c.field}`)}: ${showValue(c.from, fmt)} → ${showValue(c.to, fmt)}`).join("; "),
        });
      case "case":
        return t("clients.events.case", { text: e.text || "—" });
      case "archive":
        return d.auto ? t("clients.events.archiveAuto", { days: d.days }) : t("clients.events.archive");
      case "keep":
        return d.until ? t("clients.events.keep", { date: fmt.isoDateLong(d.until) }) : t("clients.events.keepOff");
      case "restore":
        return t("clients.events.restore");
      case "merge":
        return t("clients.events.merge", { name: e.text });
      case "follow_up": {
        const what = t(`clientWork.kinds.${d.kind || "other"}`);
        const who = d.contact ? ` — ${d.contact.name} (${t(`clientWork.relations.${d.contact.relation}`)})` : "";
        const when = d.dueAt ? fmt.dateTime(new Date(d.dueAt).getTime()) : "";
        if (d.action === "done") return `${t("clientWork.events.done", { what, when })}${who}${d.outcome ? ` — ${t(`clientWork.outcomes.${d.outcome}`)}` : ""}${d.outcomeNote ? `: ${d.outcomeNote}` : ""}`;
        if (d.action === "cancel") return t("clientWork.events.cancel", { what, when });
        if (d.action === "move") return t("clientWork.events.move", { what, when });
        return `${t("clientWork.events.add", { what, when })}${who}${d.note ? ` — ${d.note}` : ""}`;
      }
      case "contact":
        return t(`clientWork.events.contact_${d.action || "add"}`, { name: d.name || "—", relation: d.relation ? t(`clientWork.relations.${d.relation}`) : "" });
      case "file":
        return t(`clientWork.events.file_${d.action || "add"}`, { name: d.name || "—", kind: d.kind ? t(`clientWork.fileKinds.${d.kind}`) : "" });
      case "lost":
        return t("clientWork.events.lost", { reason: d.reason ? t(`clientWork.lost.${d.reason}`) : "—" }) + (d.note ? `: ${d.note}` : "");
      case "note": {
        if (d.type) return entryText(e, t, fmt);
        return d.channel ? `${t(`clientWork.channels.${d.channel}`)}: ${e.text}` : e.text;
      }
      case "schedule":
        // Older ones carry only their words.
        if (d.count == null) return e.text;
        return d.count ? t("caseWork.events.schedule", { count: d.count }) : t("caseWork.events.scheduleCleared");
      case "task":
        if (d.action === "checklist") return t("caseTasks.events.checklist", { name: d.title || "—", count: d.count || 0, who: d.assignee || "—" });
        return t(`caseTasks.events.${d.action === "done" ? "done" : "add"}`, { title: d.title || "—", who: d.assignee || "—" }) + (d.answer ? ` — «${d.answer}»` : "");
      case "consult_summary": {
        const parts = [t(`summary.prospects.${d.prospect || "potential"}`), d.next ? t(`summary.next.${d.next.kind}`) : null, d.next?.dueAt ? fmt.dateTime(new Date(d.next.dueAt).getTime()) : null, d.lostReason ? t(`clientWork.lost.${d.lostReason}`) : null];
        return `${t("summary.event", { what: parts.filter(Boolean).join(" · ") })}: ${e.text}`;
      }
      default:
        return e.text;
    }
  };
}

const showValue = (v, fmt) => (v == null || v === "" ? "—" : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmt.isoDateLong(v) : v);

export function TimelineList({ items, renderExtra, editing, editor }) {
  return (
    <div className={styles.timeline}>
      {items.map((item) => {
        const body = (
          <>
            <span className={styles.itemIcon}>
              <Icon name={item.icon} size={16} />
            </span>
            <span className={styles.itemMain}>
              <span className={styles.itemTitle} style={item.note || item.entry ? { whiteSpace: "pre-wrap", fontWeight: 500 } : undefined}>
                {item.entry ? <strong>{item.entry.title}</strong> : item.title}
                {item.entry?.badge && (
                  <span className={styles.itemBadge}>
                    <Badge tone={item.entry.badge.tone}>{item.entry.badge.text}</Badge>
                  </span>
                )}
              </span>
              {item.entry?.text && <span className={styles.itemText}>{item.entry.text}</span>}
              {item.entry?.tags.length > 0 && (
                <span className={styles.itemTags}>
                  {item.entry.tags.map((tag, i) => (
                    <span key={i} className={`${styles.itemTag} ${tag.tone ? styles[`itemTag_${tag.tone}`] : ""}`}>
                      <Icon name={tag.icon} size={12} />
                      {tag.text}
                    </span>
                  ))}
                </span>
              )}
              <span className={styles.itemSub} style={{ display: "block" }}>
                {item.sub}
              </span>
            </span>
          </>
        );
        if (item.to) {
          return (
            <Link key={item.key} to={item.to} className={styles.item}>
              {body}
            </Link>
          );
        }
        if (editing && item.note && editing.id === item.note.id) {
          return (
            <div key={item.key} className={styles.item}>
              {editor}
            </div>
          );
        }
        return (
          <div key={item.key} className={styles.item}>
            {body}
            {renderExtra ? renderExtra(item) : null}
          </div>
        );
      })}
    </div>
  );
}
