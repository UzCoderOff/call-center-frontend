import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./CallsPage.module.css";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { SearchField, SelectField } from "../components/ui/Field";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { CallList } from "../components/calls/CallRow";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

const PAGE_SIZE = 30;

// Filters live in the URL (?view=needsCallback&employeeId=3…) so the
// dashboard can link straight to "who still needs a callback", and the back
// button returns to the same filtered list.
export default function CallsPage() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const isManager = isManagerRole(user.role);
  const [params, setParams] = useSearchParams();

  const view = params.get("view") || "all";
  const type = params.get("type") || "";
  const rec = params.get("rec") || "";
  const employeeId = params.get("employeeId") || "";
  const q = params.get("q") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [search, setSearch] = useState(q);

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === "" || value == null || (key === "view" && value === "all")) next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  }

  // Keep the box in step with the URL (back button, "clear filters").
  useEffect(() => {
    setSearch(q);
  }, [q]);

  // Debounced phone search.
  useEffect(() => {
    if (search === q) return undefined;
    const timer = setTimeout(() => update({ q: search }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const employees = useAsync(() => (isManager ? api.employees() : Promise.resolve([])), [isManager]);

  const state = useAsync(
    () =>
      api.calls({
        missed: view === "missed" ? "true" : undefined,
        needsCallback: view === "needsCallback" ? "true" : undefined,
        callType: type || undefined,
        hasRecording: rec || undefined,
        employeeId: employeeId || undefined,
        phone: q || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [view, type, rec, employeeId, q, page]
  );

  const hasFilters = Boolean(type || rec || employeeId || q);

  return (
    <div>
      <PageHeader title={t("calls.title")} subtitle={isManager ? t("calls.subtitleCompany") : t("calls.subtitleSelf")} />

      <div className={styles.controls}>
        <Segmented
          full
          value={view}
          onChange={(v) => update({ view: v })}
          label={t("calls.title")}
          options={[
            { value: "all", label: t("calls.viewAll") },
            { value: "missed", label: t("calls.viewMissed") },
            { value: "needsCallback", label: t("calls.viewNeedsCallback") },
          ]}
        />

        <div className={styles.filters}>
          <SearchField
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("calls.search")}
            aria-label={t("calls.search")}
            inputMode="tel"
          />
          {view === "all" && (
            <SelectField aria-label={t("calls.type")} value={type} onChange={(e) => update({ type: e.target.value })}>
              <option value="">{t("calls.anyType")}</option>
              <option value="incoming">{t("callType.incoming")}</option>
              <option value="outgoing">{t("callType.outgoing")}</option>
            </SelectField>
          )}
          <SelectField aria-label={t("calls.recording")} value={rec} onChange={(e) => update({ rec: e.target.value })}>
            <option value="">{t("calls.anyRecording")}</option>
            <option value="true">{t("calls.withRecording")}</option>
            <option value="false">{t("calls.withoutRecording")}</option>
          </SelectField>
          {isManager && (
            <SelectField
              aria-label={t("calls.employee")}
              value={employeeId}
              onChange={(e) => update({ employeeId: e.target.value })}
            >
              <option value="">{t("calls.allEmployees")}</option>
              {(employees.data || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        {hasFilters && (
          <div>
            <Button
              variant="plain"
              size="small"
              icon="x"
              onClick={() => {
                setSearch("");
                update({ type: "", rec: "", employeeId: "", q: "" });
              }}
            >
              {t("calls.clearFilters")}
            </Button>
          </div>
        )}
      </div>

      <AsyncBoundary state={state}>
        {(data) =>
          data.calls.length === 0 ? (
            <EmptyState
              icon={view === "needsCallback" ? "checkCircle" : "search"}
              text={view === "needsCallback" && !hasFilters ? t("calls.emptyNeedsCallback") : t("calls.empty")}
            />
          ) : (
            <>
              <p className={styles.count}>{t("common.callsCount", { count: fmt.number(data.pagination.total) })}</p>
              <CallList calls={data.calls} showEmployee={isManager} showCallButton />
              {data.pagination.totalPages > 1 && (
                <div className={styles.pager}>
                  <Button icon="chevronLeft" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                    {t("common.previous")}
                  </Button>
                  <span className={styles.pageInfo}>
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
    </div>
  );
}
