import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/materials/Materials.module.css";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { List, ListRow } from "../components/ui/List";
import { AsyncBoundary, Avatar, Banner, EmptyState, PageHeader } from "../components/ui/Misc";
import RichText from "../components/materials/RichText";
import { FileBlock, MaterialBadges } from "../components/materials/parts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

export default function MaterialPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const manager = isManagerRole(user.role);
  const state = useAsync(() => api.material(id), [id]);

  return (
    <div>
      <AsyncBoundary state={state}>
        {(m) => (
          <>
            <PageHeader
              back={{ to: "/materials", label: t("materials.title") }}
              title={m.title}
              subtitle={m.category || undefined}
              actions={
                manager && (
                  <Button icon="edit" to={`/materials/${m.id}/edit`}>
                    {t("materials.edit")}
                  </Button>
                )
              }
            />
            <div className={`${pageStyles.stack} ${styles.reading}`}>
              {manager && <MaterialBadges material={{ ...m, audienceCount: 0 }} manager />}
              {m.archivedAt && <Banner icon="archive">{t("materials.archivedBanner")}</Banner>}
              {!manager && m.readOlderVersion && (
                <Banner tone="warning" icon="refresh">
                  {t("materials.updatedBanner")}
                </Banner>
              )}
              {m.body && (
                <Card>
                  <RichText text={m.body} />
                </Card>
              )}
              {m.linkUrl && (
                <Button size="large" block icon="externalLink" href={m.linkUrl} target="_blank" rel="noopener noreferrer">
                  {t("materials.openLink")}
                </Button>
              )}
              {m.files.length > 0 && <FileBlock files={m.files} />}
              {!m.body && !m.linkUrl && m.files.length === 0 && (
                <List>
                  <EmptyState icon="book" text={t("materials.emptyMaterial")} />
                </List>
              )}
              {!manager && <ReadButton material={m} onRead={(read) => state.setData({ ...m, ...read, readOlderVersion: false })} />}
              {manager && <ManagerTools material={m} onChange={state.reload} />}
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

// The big "I've read it" button at the end. Once pressed, the boss sees it
// and the material leaves the person's to-read list.
function ReadButton({ material, onRead }) {
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (material.read) {
    return (
      <div className={styles.readDone}>
        <Icon name="checkCircle" size={20} />
        {t("materials.readOn", { date: fmt.date(new Date(material.readAt).getTime()) })}
      </div>
    );
  }
  async function markRead() {
    setBusy(true);
    setError(false);
    try {
      onRead(await api.markMaterialRead(material.id));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.readBar}>
      <Button variant="primary" size="large" block icon="check" busy={busy} onClick={markRead}>
        {t("materials.markRead")}
      </Button>
      <p className={pageStyles.note} style={{ textAlign: "center" }}>
        {error ? <span className={pageStyles.messageError}>{t("materials.saveFailed")}</span> : t("materials.markReadHint")}
      </p>
    </div>
  );
}

// For the boss and the developer: who it's for and who has read it, and
// archiving.
function ManagerTools({ material, onChange }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const readers = useAsync(() => api.materialReaders(material.id), [material.id, material.version]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(kind, fn) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch {
      setError(t("materials.saveFailed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Card
        flush
        title={t("materials.readersTitle")}
        subtitle={readers.data ? t("materials.readCount", { read: readers.data.people.filter((p) => p.read).length, total: readers.data.people.length }) : undefined}
      >
        <AsyncBoundary state={readers}>
          {(data) =>
            data.people.length === 0 ? (
              <EmptyState icon="users" text={material.published ? t("materials.noReaders") : t("materials.draftNoReaders")} />
            ) : (
              <List plain inset={62}>
                {data.people.map((p) => (
                  <ListRow
                    key={p.userId}
                    leading={<Avatar name={p.name} size={34} />}
                    title={p.name}
                    subtitle={p.position || t(`roles.${p.role}`)}
                    trailing={
                      p.read ? (
                        <Badge tone="good" icon="check">
                          {fmt.date(new Date(p.readAt).getTime())}
                        </Badge>
                      ) : (
                        <Badge tone={p.readOlderVersion ? "neutral" : "warning"}>{p.readOlderVersion ? t("materials.readOld") : t("materials.notRead")}</Badge>
                      )
                    }
                  />
                ))}
              </List>
            )
          }
        </AsyncBoundary>
      </Card>
      <div className={pageStyles.actionsRow}>
        {material.archivedAt ? (
          <>
            <Button icon="refresh" busy={busy === "restore"} onClick={() => act("restore", async () => { await api.restoreMaterial(material.id); onChange(); })}>
              {t("materials.restore")}
            </Button>
            <Button
              variant="destructive"
              icon="trash"
              busy={busy === "delete"}
              onClick={() =>
                window.confirm(t("materials.deleteConfirm")) &&
                act("delete", async () => {
                  await api.deleteMaterialForever(material.id);
                  navigate("/materials", { replace: true });
                })
              }
            >
              {t("materials.deleteForever")}
            </Button>
          </>
        ) : (
          <Button
            variant="destructive"
            icon="archive"
            busy={busy === "archive"}
            onClick={() =>
              window.confirm(t("materials.archiveConfirm")) &&
              act("archive", async () => {
                await api.archiveMaterial(material.id);
                navigate("/materials", { replace: true });
              })
            }
          >
            {t("materials.archive")}
          </Button>
        )}
      </div>
      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
    </>
  );
}
