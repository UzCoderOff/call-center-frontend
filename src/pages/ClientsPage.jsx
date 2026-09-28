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
import { ClientSheet } from "../components/clients/ClientSheets";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { canManageClients, isLawyer } from "../lib/access";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

const FILTERS = ["all", "callToday", "debt", "active"];
// Managers also see archived clients (hidden everywhere else, kept, restorable).
const MANAGER_FILTERS = [...FILTERS, "archived"];
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
              {(lawyers.data?.accounts || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </div>

      <AsyncBoundary state={state}>
        {(data) =>
          data.clients.length === 0 ? (
            <EmptyState
              icon="contact"
              text={q || filter !== "all" || status || operatorId || lawyerId ? t("clients.emptyFiltered") : lawyer ? t("lawyer.noCases") : t("clients.empty")}
            />
          ) : (
            <>
              <List>
                {data.clients.map((c) => {
                  const k = c.latestCase;
                  const callAt = c.nextCallAt ? new Date(c.nextCallAt).getTime() : null;
                  const dueToday = callAt && callAt < endOfToday;
                  return (
                    <ListRow
                      key={c.id}
                      to={`/clients/${c.id}`}
                      leading={<Avatar name={c.name} size={40} />}
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
