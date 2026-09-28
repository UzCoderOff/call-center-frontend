import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "../components/clients/Clients.module.css";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Segmented from "../components/ui/Segmented";
import { SearchField, SelectField } from "../components/ui/Field";
import { List, ListRow } from "../components/ui/List";
import { AsyncBoundary, Avatar, EmptyState, PageHeader } from "../components/ui/Misc";
import { STATUSES, StatusBadge } from "../components/clients/parts";
import { TargetsCard } from "../components/clients/ClientCards";
import { BulkSheet, ClientSheet } from "../components/clients/ClientSheets";
import Icon from "../components/ui/Icon";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { canManageClients, isLawyer } from "../lib/access";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

const FILTERS = ["all", "callToday", "debt", "active"];
// Managers also see old consultations that went nowhere (to close them in one
// go) and archived clients (hidden everywhere else, kept, restorable).
const MANAGER_FILTERS = [...FILTERS, "stale", "archived"];
// A lawyer: their own clients, all of them or the open cases.
const LAWYER_FILTERS = ["all", "active", "debt"];

// The clients database: search by name / phone / case number (either
// script), quick filters, and a row per client with where their case stands.
// URL: ?q=&filter=&status=&operatorId=&page= — plus ?new=1&phone=&name= to
// open "new client" filled in (from a call's page).
export default function ClientsPage() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const manager = canManageClients(user);
  const lawyer = isLawyer(user);
  const [params, setParams] = useSearchParams();

  const q = params.get("q") || "";
  const filters = manager ? MANAGER_FILTERS : lawyer ? LAWYER_FILTERS : FILTERS;
  const filter = filters.includes(params.get("filter")) ? params.get("filter") : "all";
  const status = params.get("status") || "";
  const operatorId = params.get("operatorId") || "";
  const lawyerId = params.get("lawyerId") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  // The current filters, for the list and for the Excel export.
  const query = (extra = {}) => ({
    q: q || undefined,
    filter: filter === "all" ? undefined : filter,
    status: status || undefined,
    operatorId: operatorId || undefined,
    lawyerId: lawyerId || undefined,
    ...extra,
  });
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(params.get("new") === "1");
  // Selecting many (managers): ticked ids, or every client the filters match.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [bulk, setBulk] = useState(null); // "operator" | "lawyer" | "declined"
  const [bulkDone, setBulkDone] = useState("");
  const [now] = useState(() => Date.now());
  const [endOfToday] = useState(() => new Date().setHours(23, 59, 59, 999));

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === "" || value == null || (key === "filter" && value === "all")) next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  }

  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return undefined;
    const timer = setTimeout(() => update({ q: search }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // A different list: start the selection over.
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [q, filter, status, operatorId, lawyerId]);

  function toggle(id) {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setBulkDone("");
    setSelecting(false);
    setSelected(new Set());
    setAllMatching(false);
  }

  async function applyBulk(set) {
    const result = await api.bulkClients(allMatching ? { query: query(), set } : { ids: [...selected], set });
    setBulk(null);
    setSelected(new Set());
    setAllMatching(false);
    setBulkDone(t("bulk.doneMessage", { clients: result.clients, cases: result.cases }));
    state.reload();
  }

  const employees = useAsync(() => (manager ? api.employees() : Promise.resolve([])), [manager]);
  const lawyers = useAsync(() => (manager ? api.clientLawyers() : Promise.resolve(null)), [manager]);
  const state = useAsync(() => api.clients(query({ page })), [q, filter, status, operatorId, lawyerId, page]);

  return (
    <div>
      <PageHeader
        title={lawyer ? t("lawyer.myClients") : t("clients.title")}
        subtitle={state.data ? t("clients.count", { count: fmt.number(state.data.pagination.total) }) : undefined}
        actions={
          <>
            {manager && (
              <>
                <Button icon="checkCircle" onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                  {selecting ? t("bulk.stop") : t("bulk.select")}
                </Button>
                <Button icon="upload" to="/clients/import">
                  {t("clients.import")}
                </Button>
                <Button icon="note" href={api.clientsExportUrl(query())} download>
                  {t("clients.export")}
                </Button>
              </>
            )}
            {!lawyer && (
              <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                {t("clients.add")}
              </Button>
            )}
          </>
        }
      />

      <div className={styles.toolbar}>
        {!lawyer && <TargetsCard manager={manager} />}
        <SearchField value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("clients.search")} aria-label={t("clients.search")} />
        <Segmented
          full
          wrap
          value={filter}
          onChange={(v) => update({ filter: v })}
          label={t("clients.title")}
          options={filters.map((f) => ({ value: f, label: t(`clients.filters.${f}`) }))}
        />
        <div className={styles.filters}>
          <SelectField aria-label={t("cases.status")} value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">{t("clients.anyStatus")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`cases.statuses.${s}`)}
              </option>
            ))}
          </SelectField>
          {manager && (
            <SelectField aria-label={t("cases.operator")} value={operatorId} onChange={(e) => update({ operatorId: e.target.value })}>
              <option value="">{t("clients.anyOperator")}</option>
              <option value="none">{t("clients.noOperatorFilter")}</option>
              {(employees.data || [])
                .filter((e) => e.active && e.collectCalls)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </SelectField>
          )}
          {manager && (
            <SelectField aria-label={t("cases.lawyer")} value={lawyerId} onChange={(e) => update({ lawyerId: e.target.value })}>
              <option value="">{t("lawyer.anyLawyer")}</option>
              <option value="none">{t("lawyer.unassigned")}</option>
              {(lawyers.data?.accounts || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </div>

      {bulkDone && <p className={styles.count}>{bulkDone}</p>}
      <AsyncBoundary state={state}>
        {(data) =>
          data.clients.length === 0 ? (
            <EmptyState
              icon="contact"
              text={q || filter !== "all" || status || operatorId || lawyerId ? t("clients.emptyFiltered") : lawyer ? t("lawyer.noCases") : t("clients.empty")}
            />
          ) : (
            <>
              {selecting && (
                <div className={styles.bulkBar}>
                  <span className={styles.bulkCount}>
                    {allMatching ? t("bulk.allCount", { count: data.pagination.total }) : t("bulk.count", { count: selected.size })}
                  </span>
                  <Button size="small" variant="plain" onClick={() => setSelected(new Set(data.clients.map((c) => c.id)))}>
                    {t("bulk.selectPage")}
                  </Button>
                  {data.pagination.total > data.clients.length && !allMatching && (
                    <Button size="small" variant="plain" onClick={() => setAllMatching(true)}>
                      {t("bulk.selectAll", { count: data.pagination.total })}
                    </Button>
                  )}
                  {(selected.size > 0 || allMatching) && (
                    <Button
                      size="small"
                      variant="plain"
                      onClick={() => {
                        setSelected(new Set());
                        setAllMatching(false);
                      }}
                    >
                      {t("bulk.clear")}
                    </Button>
                  )}
                  <div className={styles.bulkActions}>
                    {["operator", "lawyer", "declined"].map((kind) => (
                      <Button
                        key={kind}
                        size="small"
                        icon={kind === "operator" ? "user" : kind === "lawyer" ? "briefcase" : "minusCircle"}
                        disabled={!allMatching && selected.size === 0}
                        onClick={() => setBulk(kind)}
                      >
                        {t(`bulk.${kind}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <List>
                {data.clients.map((c) => {
                  const k = c.latestCase;
                  const callAt = c.nextCallAt ? new Date(c.nextCallAt).getTime() : null;
                  const dueToday = callAt && callAt < endOfToday;
                  const on = allMatching || selected.has(c.id);
                  return (
                    <ListRow
                      key={c.id}
                      to={selecting ? undefined : `/clients/${c.id}`}
                      onClick={selecting ? () => toggle(c.id) : undefined}
                      leading={
                        selecting ? (
                          <span className={`${styles.selectMark} ${on ? styles.selectMarkOn : ""}`} role="checkbox" aria-checked={on} aria-label={c.name}>
                            {on && <Icon name="check" size={16} />}
                          </span>
                        ) : (
                          <Avatar name={c.name} size={40} />
                        )
                      }
                      title={c.name}
                      subtitle={[c.phone && fmt.phone(c.phone), k?.lawyer, c.caseCount > 1 && t("clients.cases", { count: c.caseCount })].filter(Boolean).join(" · ")}
                      footer={
                        <span className={styles.rowBadges}>
                          <StatusBadge status={k?.status} />
                          {k?.legalStage && <Badge tone="neutral">{t(`cases.stages.${k.legalStage}`)}</Badge>}
                          {dueToday && (
                            <Badge tone={callAt < now ? "critical" : "warning"} icon="phone">
                              {callAt < now ? t("clients.overdue") : t("clients.callAt", { time: fmt.time(callAt) })}
                            </Badge>
                          )}
                          {c.debt > 0 && <Badge tone="warning">{t("clients.debt", { amount: fmt.money(c.debt) })}</Badge>}
                        </span>
                      }
                    />
                  );
                })}
              </List>
              {data.pagination.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 20 }}>
                  <Button icon="chevronLeft" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                    {t("common.previous")}
                  </Button>
                  <span className={styles.count} style={{ alignSelf: "center", margin: 0 }}>
                    {t("common.pageOf", { page: data.pagination.page, total: data.pagination.totalPages })}
                  </span>
                  <Button disabled={page >= data.pagination.totalPages} onClick={() => update({ page: page + 1 })}>
                    {t("common.next")}
                  </Button>
                </div>
              )}
            </>
          )
        }
      </AsyncBoundary>

      {bulk && (
        <BulkSheet
          kind={bulk}
          count={allMatching ? state.data?.pagination.total ?? 0 : selected.size}
          operators={(employees.data || []).filter((e) => e.active && (e.collectCalls || e.calendarAccess === "book"))}
          lawyers={lawyers.data?.accounts || []}
          onApply={applyBulk}
          onClose={() => setBulk(null)}
        />
      )}

      {creating && (
        <ClientSheet
          prefill={{ phone: params.get("phone") || "", name: params.get("name") || "" }}
          onClose={() => {
            setCreating(false);
            update({ new: null, phone: null, name: null });
          }}
          onSaved={(client) => navigate(`/clients/${client.id}`)}
        />
      )}
    </div>
  );
}
