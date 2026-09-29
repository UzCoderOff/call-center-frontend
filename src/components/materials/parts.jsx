import styles from "./Materials.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import { List, ListRow } from "../ui/List";
import { api } from "../../lib/api";
import { hasBridge, inApp } from "../../lib/appBridge";
import { useAsync } from "../../hooks/useAsync";
import { useI18n } from "../../i18n";

// What a material mostly is, for its icon: text, a PDF, audio, video…
const KIND_ICON = { pdf: "file", document: "file", image: "image", audio: "music", video: "video" };
export function materialIcon(material) {
  if (material.hasText || material.body) return "book";
  const first = material.files?.[0];
  if (first) return KIND_ICON[first.kind] || "file";
  return material.hasLink || material.linkUrl ? "link" : "book";
}

export function KindTile({ material }) {
  return (
    <span className={`${styles.kindTile} ${material.read ? styles.done : ""}`}>
      <Icon name={material.read ? "check" : materialIcon(material)} size={19} strokeWidth={material.read ? 2.4 : 1.8} />
    </span>
  );
}

// Words, not just colours: "Majburiy", "Yangi", "Oʻqilgan", "Qoralama".
export function MaterialBadges({ material, manager = false }) {
  const { t } = useI18n();
  const badges = [];
  if (manager && !material.published) badges.push(<Badge key="draft">{t("materials.draft")}</Badge>);
  if (material.required) {
    badges.push(
      <Badge key="req" tone={material.read || manager ? "neutral" : "warning"} icon="alertCircle">
        {t("materials.required")}
      </Badge>
    );
  }
  if (manager) {
    if (material.audienceCount > 0) {
      badges.push(
        <Badge key="count" tone={material.readCount >= material.audienceCount ? "good" : "neutral"} icon="eye">
          {t("materials.readCount", { read: material.readCount, total: material.audienceCount })}
        </Badge>
      );
    }
  } else if (material.read) {
    badges.push(
      <Badge key="read" tone="good" icon="check">
        {t("materials.readBadge")}
      </Badge>
    );
  } else if (!material.required) {
    badges.push(
      <Badge key="new" tone="accent">
        {t("materials.new")}
      </Badge>
    );
  }
  return badges.length ? <span className={styles.rowBadges}>{badges}</span> : null;
}

export function MaterialRow({ material, manager }) {
  const { t, fmt } = useI18n();
  const files = material.files?.length || 0;
  const bits = [
    material.hasText ? t("materials.kindText") : null,
    files ? t("materials.filesCount", { count: files }) : null,
    material.hasLink ? t("materials.kindLink") : null,
  ].filter(Boolean);
  return (
    <ListRow
      to={`/materials/${material.id}`}
      leading={<KindTile material={manager ? { ...material, read: false } : material} />}
      title={material.title}
      subtitle={[bits.join(" · "), fmt.date(new Date(material.updatedAt).getTime())].filter(Boolean).join(" · ")}
      footer={<MaterialBadges material={material} manager={manager} />}
    />
  );
}

// The required materials this person hasn't read yet — a new employee's
// "read these first" list. Shown on the home page until they're all read.
export function ToReadCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.materials(), []);
  const required = (state.data || []).filter((m) => m.required);
  const unread = required.filter((m) => !m.read);
  if (unread.length === 0) return null;
  const done = required.length - unread.length;
  return (
    <Card
      title={t("materials.toReadTitle")}
      subtitle={t("materials.toReadSubtitle")}
      action={
        <Button size="small" variant="plain" to="/materials">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <div className={pageStyles.progressTrack} aria-hidden="true">
        <span className={pageStyles.progressFill} style={{ width: `${(done / required.length) * 100}%` }} />
      </div>
      <p className={styles.progressLine}>{t("materials.progress", { done, total: required.length })}</p>
      <List plain inset={58}>
        {unread.slice(0, 5).map((m) => (
          <ListRow key={m.id} to={`/materials/${m.id}`} leading={<KindTile material={m} />} title={m.title} subtitle={m.category || undefined} />
        ))}
      </List>
    </Card>
  );
}

// ------------------------------------------------------------------ files

// Opening a PDF or a Word file: in a browser, a new tab; inside the Android
// app, the app downloads it and the phone opens it (older app versions
// can't — they're told to update).
function FileRow({ file, onDelete }) {
  const { t } = useI18n();
  const canOpen = !inApp || hasBridge("canDownload");
  const url = api.materialFileUrl(file.id, { download: inApp });
  return (
    <ListRow
      leading={<Icon name={KIND_ICON[file.kind] || "file"} size={20} />}
      title={file.name}
      subtitle={canOpen ? formatSize(file.size) : t("materials.updateAppToOpen")}
      actions={
        <span className={styles.fileActions}>
          {canOpen && (
            <Button size="small" icon={inApp ? "download" : "externalLink"} href={url} target={inApp ? undefined : "_blank"} rel="noopener noreferrer">
              {t("materials.open")}
            </Button>
          )}
          {onDelete && <Button size="small" variant="plain" icon="trash" onClick={() => onDelete(file)} aria-label={t("materials.removeFile")} />}
        </span>
      }
    />
  );
}

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Pictures, audio and video play right on the page; everything else is a
// row with an "Open" button.
export function FileBlock({ files, onDelete }) {
  const { t } = useI18n();
  const media = files.filter((f) => ["image", "audio", "video"].includes(f.kind));
  const others = files.filter((f) => !media.includes(f));
  return (
    <div className={styles.media}>
      {media.map((f) => (
        <figure key={f.id}>
          {f.kind === "image" && <img className={styles.picture} src={api.materialFileUrl(f.id)} alt={f.name} loading="lazy" />}
          {f.kind === "audio" && <audio className={styles.player} src={api.materialFileUrl(f.id)} controls preload="none" />}
          {f.kind === "video" && <video className={styles.player} src={api.materialFileUrl(f.id)} controls preload="metadata" playsInline />}
          <figcaption className={styles.mediaCaption}>
            {f.name}
            {onDelete && <Button size="small" variant="plain" icon="trash" onClick={() => onDelete(f)} aria-label={t("materials.removeFile")} />}
          </figcaption>
        </figure>
      ))}
      {others.length > 0 && (
        <List inset={52}>
          {others.map((f) => (
            <FileRow key={f.id} file={f} onDelete={onDelete} />
          ))}
        </List>
      )}
    </div>
  );
}
