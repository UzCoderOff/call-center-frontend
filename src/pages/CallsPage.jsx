import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import styles from "./CallsPage.module.css";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Segmented from "../components/ui/Segmented";
import { SearchField, SelectField } from "../components/ui/Field";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { CallList } from "../components/calls/CallRow";
import JobToggles, { useCallJobs } from "../components/calls/JobToggles";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { takesCalls } from "../lib/access";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { rangeFor } from "../lib/format";
import { useI18n } from "../i18n";
import { canCallInApp } from "../lib/appBridge";

const PAGE_SIZE = 30;
const PERIODS = ["today", "7d", "month", "lastMonth", "30d", "90d"];

// One local day, "YYYY-MM-DD" -> { from, to } in epoch ms.
function dayRange(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { from: new Date(y, m - 1, d).getTime(), to: new Date(y, m - 1, d + 1).getTime() - 1 };
}

// Filters live in the URL (?view=missed&period=7d&employeeId=3…) so the
// dashboard's tiles and chart can link straight to the calls behind a
// number, and the back button returns to the same filtered list.
//   view    all | answered | missed | needsCallback
//   period  today | 7d | month | lastMonth | 30d | 90d (none = all time), or date=YYYY-MM-DD
//   sort    longest (default: newest first)
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
  const date = params.get("date") || "";
  const period = date ? "" : PERIODS.includes(params.get("period")) ? params.get("period") : "";
  const sort = params.get("sort") === "longest" ? "longest" : "";
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
  // Whose phones (managers): the call center unless more are switched on.
  const [jobs, setJobs] = useCallJobs();
  // Someone with two jobs counts under each of them.
  const phonesByJob = (employees.data || []).filter((e) => e.active && takesCalls(e)).reduce((m, e) => {
    for (const j of e.jobs?.length ? e.jobs : [e.job || "other"]) m[j] = (m[j] || 0) + 1;
    return m;
  }, {});

  const talkMatters = view === "all" || view === "answered";
  const state = useAsync(() => {
    const range = date ? dayRange(date) : period ? rangeFor(period) : {};
    return api.calls({
      missed: view === "missed" ? "true" : view === "answered" ? "false" : undefined,
      needsCallback: view === "needsCallback" ? "true" : undefined,
      callType: talkMatters && type ? type : undefined,
      hasRecording: rec || undefined,
      employeeId: employeeId || undefined,
      jobs: isManager && !employeeId ? jobs.join(",") : undefined,
      phone: q || undefined,
      from: range.from,
      to: range.to,
      sort: talkMatters && sort ? sort : undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  }, [view, type, rec, employeeId, q, date, period, sort, page, jobs.join(",")]);

  const hasFilters = Boolean(type || rec || employeeId || q || period || date || sort);

  return (
    <div>
      <PageHeader title={t("calls.title")} subtitle={isManager ? t("calls.subtitleCompany") : t("calls.subtitleSelf")} />

      {/* Calling through Ledger's line (the app): the keypad, like a phone's dialer. */}
      {canCallInApp() && (
        <Link to="/phone" className={styles.dialButton} aria-label={t("phone.keypad")} title={t("phone.keypad")}>
          <Icon name="dialpad" size={26} />
        </Link>
      )}

      <div className={styles.controls}>
        <Segmented
          full
          wrap
          value={view}
          onChange={(v) => update({ view: v })}
          label={t("calls.title")}
          options={[
            { value: "all", label: t("calls.viewAll") },
            { value: "answered", label: t("calls.viewAnswered") },
            { value: "missed", label: t("calls.viewMissed") },
            { value: "needsCallback", label: t("calls.viewNeedsCallback") },
          ]}
        />
        {isManager && !employeeId && <JobToggles value={jobs} onChange={(next) => (setJobs(next), update({}))} counts={employees.data ? phonesByJob : null} />}

        <div className={styles.filters}>
          <SearchField
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("calls.search")}
            aria-label={t("calls.search")}
            inputMode="tel"
          />
          {view !== "needsCallback" && (
            <SelectField
              aria-label={t("calls.period")}
              value={date ? "date" : period}
              onChange={(e) => update({ period: e.target.value, date: "" })}
            >
              <option value="">{t("calls.anyTime")}</option>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`range.${p}`)}
                </option>
              ))}
              {date && <option value="date">{fmt.isoDateLong(date)}</option>}
            </SelectField>
          )}
          {talkMatters && (
            <SelectField aria-label={t("calls.sort")} value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="">{t("calls.sortNewest")}</option>
              <option value="longest">{t("calls.sortLongest")}</option>
            </SelectField>
          )}
          {talkMatters && (
            <SelectField aria-label={t("calls.type")} value={type} onChange={(e) => update({ type: e.target.value })}>
              <option value="">{t("calls.anyType")}</option>
              <option value="incoming">{t("callType.incoming")}</option>
              <option value="outgoing">{t("callType.outgoing")}</option>
            </SelectField>
          )}
          {view !== "missed" && view !== "needsCallback" && (
            <SelectField aria-label={t("calls.recording")} value={rec} onChange={(e) => update({ rec: e.target.value })}>
              <option value="">{t("calls.anyRecording")}</option>
              <option value="true">{t("calls.withRecording")}</option>
              <option value="false">{t("calls.withoutRecording")}</option>
            </SelectField>
          )}
          {isManager && (
            <SelectField
              aria-label={t("calls.employee")}
              value={employeeId}
              onChange={(e) => update({ employeeId: e.target.value })}
            >
              <option value="">{t("calls.allEmployees")}</option>
              {(employees.data || [])
                .filter((e) => e.collectCalls || e.active)
                .map((e) => (
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
                update({ type: "", rec: "", employeeId: "", q: "", period: "", date: "", sort: "" });
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
              <p className={styles.count}>
                {t("common.callsCount", { count: fmt.number(data.pagination.total) })}
                {talkMatters && data.summary?.talkSeconds > 0 && ` · ${t("calls.talkTotal", { time: fmt.duration(data.summary.talkSeconds) })}`}
              </p>
              <CallList calls={data.calls} showEmployee={isManager} showCallButton grouped={!(talkMatters && sort)} />
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
