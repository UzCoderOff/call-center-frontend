import { Link } from "react-router-dom";
import styles from "./Chat.module.css";
import Icon from "../ui/Icon";
import { ConvIcon } from "./ChatParts";
import { unreadShown, useReadMarks } from "../../hooks/useChatUnread";
import { useI18n } from "../../i18n";

// The chats, newest first (the Everyone chat on top): picture, name, the
// last message and how many are unread.
export default function ChatList({ list, activeId }) {
  const { t, fmt } = useI18n();
  useReadMarks();
  if (list.length === 0) return <div className={styles.placeholder}>{t("chat.empty")}</div>;
  return list.map((conv) => {
    const last = conv.lastMessage;
    const who = last ? (last.mine ? `${t("chat.you")}: ` : conv.kind !== "direct" && last.author ? `${last.author.split(" ")[0]}: ` : "") : "";
    // Ledger AI's **bold** shows as plain text here.
    const preview = last ? `${who}${last.eventTitle ? `📅 ${last.eventTitle}` : String(last.text || "").replace(/\*\*/g, "")}` : t("chat.noMessages");
    const at = last ? new Date(last.createdAt).getTime() : null;
    const unread = unreadShown(conv);
    return (
      <Link key={conv.id} to={`/chat/${conv.id}`} className={`${styles.conv} ${conv.id === activeId ? styles.convActive : ""}`}>
        <ConvIcon conv={conv} />
        <span className={styles.convBody}>
          <span className={styles.convTop}>
            <span className={styles.convName}>{conv.kind === "everyone" ? t("chat.everyone") : conv.title}</span>
            {at && <span className={styles.convTime}>{sameDay(at) ? fmt.time(at) : fmt.date(at)}</span>}
          </span>
          <span className={styles.convBottom}>
            <span className={styles.convPreview}>{preview}</span>
            {conv.muted && unread === 0 && <Icon name="bellOff" size={14} />}
            {unread > 0 && <span className={`${styles.unread} ${conv.muted ? styles.unreadMuted : ""}`}>{unread > 99 ? "99+" : unread}</span>}
          </span>
        </span>
      </Link>
    );
  });
}

const sameDay = (ms) => new Date(ms).toDateString() === new Date().toDateString();
