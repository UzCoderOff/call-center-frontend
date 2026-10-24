import { useEffect, useRef, useState } from "react";
import pageStyles from "./Pages.module.css";
import styles from "../components/notices/Notices.module.css";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { List, ListRow, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { noticeIcon } from "../components/notices/NoticeBell";
import { clearNoticeUnread } from "../hooks/useNoticeUnread";
import { useAsync } from "../hooks/useAsync";
import { useLive } from "../hooks/useLive";
import { api } from "../lib/api";
import { saveFailed } from "../lib/saveFailed";
import { useI18n } from "../i18n";

// Bildirishnomalar: everything Ledger told me — on Telegram, in the app,
// in the browser — newest first, by day (chat messages are in the chat).
// Opening the list counts as seeing it; the new ones stay marked for this
// visit, so it's clear which they were.
export default function NotificationsPage() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.notices(), []);
  const [older, setOlder] = useState([]);
  const [more, setMore] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const seenUpTo = useRef(0);
  useLive(state.reload);

  // Seen up to the newest one on screen.
  const newest = state.data?.items?.[0]?.id || 0;
  useEffect(() => {
    if (!newest || newest <= seenUpTo.current) return;
    seenUpTo.current = newest;
    clearNoticeUnread();
    api.noticesSeen({ upTo: newest }).catch(() => {
      // Not through: it shows as new again next time — no harm.
    });
  }, [newest]);

  async function loadMore(items) {
    setLoadingMore(true);
    try {
      const page = await api.notices({ before: items[items.length - 1].id });
      setOlder((rows) => [...rows, ...page.items]);
      setMore(page.more);
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("notices.title")} subtitle={t("notices.subtitle")} back={{ to: "/", label: t("nav.home") }} />
      <AsyncBoundary state={state}>
        {(data) => {
          const items = [...data.items, ...older.filter((o) => !data.items.some((i) => i.id === o.id))];
          if (items.length === 0) return <EmptyState icon="bell" title={t("notices.empty")} text={t("notices.emptyText")} />;
          const days = [];
          for (const n of items) {
            const ms = new Date(n.createdAt).getTime();
            const day = fmt.dayHeader(ms);
            if (days[days.length - 1]?.day !== day) days.push({ day, rows: [] });
            days[days.length - 1].rows.push({ ...n, ms });
          }
          const hasMore = more ?? data.more;
          return (
            <div className={pageStyles.stack}>
              {days.map(({ day, rows }) => (
                <div key={day}>
                  <ListSectionHeader>{day}</ListSectionHeader>
                  <List inset={64}>
                    {rows.map((n) => (
                      <ListRow
                        key={n.id}
                        to={n.link || undefined}
                        className={n.readAt ? undefined : styles.new}
                        leading={
                          <span className={styles.icon}>
                            <Icon name={noticeIcon(n.kind)} size={18} />
                          </span>
                        }
                        title={<span className={styles.title}>{n.title}</span>}
                        subtitle={n.body ? <span className={styles.body}>{n.body}</span> : null}
                        trailing={
                          <span className={styles.time}>
                            {!n.readAt && <span className={styles.dot} aria-label={t("notices.new")} />}
                            {fmt.time(n.ms)}
                          </span>
                        }
                      />
                    ))}
                  </List>
                </div>
              ))}
              {hasMore && (
                <div className={styles.more}>
                  <Button onClick={() => loadMore(items)} disabled={loadingMore}>
                    {t("notices.more")}
                  </Button>
                </div>
              )}
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
