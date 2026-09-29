import { useState } from "react";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { List, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { MaterialRow, ToReadCard } from "../components/materials/parts";
import { SearchField } from "../components/ui/Field";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Training materials: scripts, how to work with clients, rules. Staff see
// what's meant for them, grouped by topic, with what they still have to
// read on top. The boss and the developer write them and see who has read
// what.
export default function MaterialsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const manager = isManagerRole(user.role);
  const [view, setView] = useState("active");
  const [q, setQ] = useState("");
  const state = useAsync(() => api.materials(view === "archived" ? { archived: "true" } : undefined), [view]);

  return (
    <div>
      <PageHeader
        title={t("materials.title")}
        subtitle={manager ? t("materials.subtitleManager") : t("materials.subtitle")}
        actions={
          manager && (
            <Button variant="primary" icon="plus" to="/materials/new">
              {t("materials.add")}
            </Button>
          )
        }
      />
      <div className={pageStyles.stack}>
        {!manager && <ToReadCard />}
        {manager && (
          <Segmented
            value={view}
            onChange={setView}
            label={t("materials.title")}
            options={[
              { value: "active", label: t("materials.viewActive") },
              { value: "archived", label: t("materials.viewArchived") },
            ]}
          />
        )}
        <AsyncBoundary state={state}>
          {(rows) => {
            if (rows.length === 0) {
              return (
                <List>
                  <EmptyState
                    icon="book"
                    title={view === "archived" ? t("materials.archiveEmpty") : manager ? t("materials.emptyManagerTitle") : t("materials.empty")}
                    text={manager && view === "active" ? t("materials.emptyManagerText") : undefined}
                    action={
                      manager &&
                      view === "active" && (
                        <Button variant="primary" icon="plus" to="/materials/new">
                          {t("materials.add")}
                        </Button>
                      )
                    }
                  />
                </List>
              );
            }
            const needle = q.trim().toLowerCase();
            const shown = needle ? rows.filter((m) => `${m.title} ${m.category || ""}`.toLowerCase().includes(needle)) : rows;
            // One section per topic, in the order topics first appear
            // (required and recently changed first — the server's order).
            const groups = new Map();
            for (const m of shown) {
              const key = m.category || t("materials.noCategory");
              groups.set(key, [...(groups.get(key) || []), m]);
            }
            return (
              <div>
                {rows.length > 8 && (
                  <div className={pageStyles.bannerSpace}>
                    <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("materials.search")} aria-label={t("materials.search")} />
                  </div>
                )}
                {shown.length === 0 && (
                  <List>
                    <EmptyState icon="search" text={t("materials.nothingFound")} />
                  </List>
                )}
                {[...groups.entries()].map(([category, items]) => (
                  <section key={category}>
                    <ListSectionHeader>{category}</ListSectionHeader>
                    <List inset={66}>
                      {items.map((m) => (
                        <MaterialRow key={m.id} material={m} manager={manager} />
                      ))}
                    </List>
                  </section>
                ))}
              </div>
            );
          }}
        </AsyncBoundary>
      </div>
    </div>
  );
}
