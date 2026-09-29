import { useMemo, useRef, useState } from "react";
import styles from "../components/clients/Clients.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { SelectField, TextField } from "../components/ui/Field";
import { PageHeader, StatTile } from "../components/ui/Misc";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { readSpreadsheet } from "../lib/sheets";
import { FIELDS, findHeader, guessField, guessLawyer, guessMapping, searchable, toClientRow } from "../lib/clientImport";
import { useI18n } from "../i18n";
import { useAuth } from "../hooks/useAuth";
import { canSeeFinance } from "../lib/access";

const BATCH = 200;

// Which operator a sheet belongs to, from its name: "Нодира шартнома"
// (a first name) or "НТ август" (initials).
function guessOperator(sheetName, employees) {
  const name = searchable(sheetName);
  const initial = (word) => searchable(word).charAt(0);
  const codes = sheetName
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 3 && w === w.toUpperCase() && /\p{L}/u.test(w))
    .map((w) => [...w].map(initial).join(""));
  for (const e of employees) {
    const words = e.name.split(/\s+/).filter(Boolean);
    const first = searchable(words[0] || "");
    const initials = words.slice(0, 2).map(initial).join("");
    const reversed = words.slice(0, 2).reverse().map(initial).join("");
    if ((first.length >= 3 && name.includes(first)) || codes.includes(initials) || codes.includes(reversed)) return String(e.id);
  }
  return "";
}

// Import clients from a spreadsheet: pick a file (or a Google Sheets link),
// check how each sheet's columns were understood, import. Existing clients
// (same phone, or same name) are filled in rather than duplicated, so the
// same file can be imported again safely.
export default function ClientImportPage() {
  const { user } = useAuth();
  // Contract amounts and payments in the sheet are imported only by people
  // who see money; for anyone else the server leaves them out.
  const money = canSeeFinance(user);
  const { t, fmt } = useI18n();
  const goBack = useBack("/clients");
  const fileInput = useRef(null);
  const employees = useAsync(() => api.employees(), []);
  // Whose sheet it is: people who work with clients (take calls or book).
  const operators = (employees.data || []).filter((e) => e.active && (e.collectCalls || e.calendarAccess === "book"));
  const lawyerList = useAsync(() => api.clientLawyers(), []);
  const accounts = useMemo(() => lawyerList.data?.accounts || [], [lawyerList.data]);
  // Which account each lawyer name in the file means: an account id, or ""
  // for "just the name". Names not chosen yet use the best guess.
  const [lawyerChoice, setLawyerChoice] = useState({});

  const [fileName, setFileName] = useState("");
  const [link, setLink] = useState("");
  const [sheets, setSheets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSheet, setOpenSheet] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null);

  function load(buffer, name) {
    try {
      const read = readSpreadsheet(buffer, name);
      setSheets(
        read.map((s) => {
          const header = findHeader(s.rows);
          return {
            name: s.name,
            rows: s.rows,
            header,
            mapping: header >= 0 ? guessMapping(s.rows[header], s.rows.slice(header + 1)) : [],
            include: header >= 0,
            operatorId: guessOperator(s.name, operators),
          };
        })
      );
      setFileName(name);
      setLawyerChoice({});
      setResult(null);
      setError("");
    } catch (err) {
      setError(errorText(err.message));
    }
  }

  async function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    load(await file.arrayBuffer(), file.name);
    setLoading(false);
    e.target.value = "";
  }

  async function loadLink() {
    setLoading(true);
    setError("");
    try {
      load(await api.googleSheet(link.trim()), "Google Sheets");
    } catch (err) {
      setError(errorText(err.code));
    } finally {
      setLoading(false);
    }
  }

  // A known problem in plain words, or a general "couldn't read it".
  function errorText(code) {
    const key = `import.errors.${code}`;
    const text = t(key);
    return text === key ? t("import.errors.generic") : text;
  }

  const update = (i, patch) => setSheets((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // Every row of the included sheets, as read.
  const sheetRows = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap((s) =>
      s.include && s.header >= 0
        ? s.rows
            .slice(s.header + 1)
            .map((cells, i) =>
              toClientRow(cells, s.mapping, s.rows[s.header], {
                sheet: s.name,
                row: s.header + 2 + i,
                operatorId: s.operatorId ? Number(s.operatorId) : null,
              })
            )
            .filter(Boolean)
        : []
    );
  }, [sheets]);

  // The lawyer names in the file (most rows first), each with the account
  // it goes to: the importer's choice, else the best guess.
  const lawyers = useMemo(() => {
    const counts = new Map();
    for (const r of sheetRows) if (r.lawyer?.trim()) counts.set(r.lawyer.trim(), (counts.get(r.lawyer.trim()) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, accountId: name in lawyerChoice ? lawyerChoice[name] : String(guessLawyer(name, accounts)?.id ?? "") }));
  }, [sheetRows, lawyerChoice, accounts]);

  // …and every row as it will be sent, with its lawyer's account settled.
  const rows = useMemo(() => {
    const chosen = new Map(lawyers.map((l) => [l.name, l.accountId]));
    return sheetRows.map((r) => (r.lawyer?.trim() ? { ...r, lawyerId: chosen.get(r.lawyer.trim()) ? Number(chosen.get(r.lawyer.trim())) : null } : r));
  }, [sheetRows, lawyers]);

  async function run() {
    const total = rows.length;
    const sum = { created: 0, updated: 0, skipped: 0, problems: [] };
    setProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i += BATCH) {
        const r = await api.importClients(rows.slice(i, i + BATCH));
        sum.created += r.created;
        sum.updated += r.updated;
        sum.skipped += r.skipped;
        sum.problems.push(...r.problems);
        setProgress({ done: Math.min(total, i + BATCH), total });
      }
      setResult(sum);
    } catch (err) {
      setError(t("import.failed", { reason: err.code || "?" }));
      setResult(sum);
    } finally {
      setProgress(null);
    }
  }

  const fieldLabel = (key) => t(`import.fields.${key || "ignore"}`);

  return (
    <div>
      <PageHeader back={{ label: t("clients.title"), onClick: goBack }} title={t("import.title")} subtitle={t("import.subtitle")} />
      <div className={styles.steps}>
        <Card title={t("import.step1")}>
          <div className={styles.source}>
            <p className={pageStyles.note}>{t("import.intro")}</p>
            <button type="button" className={styles.fileDrop} onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={26} />
              <strong>{fileName || t("import.pickFile")}</strong>
              <span>.xlsx, .csv</span>
            </button>
            <input ref={fileInput} type="file" accept=".xlsx,.csv" hidden onChange={pickFile} />
            <div className={styles.orLine}>{t("import.or")}</div>
            <div className={styles.linkRow}>
              <TextField label={t("import.googleLink")} hint={t("import.googleHint")} placeholder="https://docs.google.com/spreadsheets/d/…" value={link} onChange={(e) => setLink(e.target.value)} />
              <Button busy={loading} disabled={!link.trim()} onClick={loadLink}>
                {t("import.load")}
              </Button>
            </div>
            {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
          </div>
        </Card>

        {sheets && !result && (
          <Card title={t("import.step2")} subtitle={t("import.step2Hint")}>
            {sheets.map((s, i) => {
              const count = s.header >= 0 ? s.rows.slice(s.header + 1).filter((r) => toClientRow(r, s.mapping, s.rows[s.header])).length : 0;
              return (
                <div key={`${s.name}-${i}`} className={styles.sheet}>
                  <label className={styles.sheetHead}>
                    <input type="checkbox" checked={s.include} disabled={s.header < 0} onChange={(e) => update(i, { include: e.target.checked })} />
                    <span className={styles.sheetName}>{s.name}</span>
                    <span className={styles.sheetInfo}>{s.header < 0 ? t("import.noTable") : t("import.rows", { count })}</span>
                  </label>
                  {s.include && (
                    <>
                      <SelectField label={t("import.operator")} value={s.operatorId} onChange={(e) => update(i, { operatorId: e.target.value })}>
                        <option value="">{t("import.noOperator")}</option>
                        {operators.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </SelectField>
                      {!s.operatorId && <p className={pageStyles.note}>{t("import.noOperatorWarning")}</p>}
                      {/* An email column used for something else is read as that. */}
                      {s.rows[s.header].map((title, col) =>
                        guessField(title) === "email" && s.mapping[col] !== "email" ? (
                          <p key={col} className={pageStyles.note}>
                            {t("import.emailRemapped", { title: String(title).trim(), field: fieldLabel(s.mapping[col]) })}
                          </p>
                        ) : null
                      )}
                      <div>
                        <Button size="small" variant="plain" icon={openSheet === i ? "chevronDown" : "chevronRight"} onClick={() => setOpenSheet(openSheet === i ? null : i)}>
                          {t("import.columns", { count: s.mapping.filter(Boolean).length })}
                        </Button>
                      </div>
                      {openSheet === i && (
                        <div className={styles.mapping}>
                          {s.rows[s.header].map((title, col) =>
                            String(title).trim() ? (
                              <div key={col} className={styles.mapItem}>
                                <span className={styles.mapTitle} title={title}>
                                  {title}
                                </span>
                                <select
                                  aria-label={title}
                                  value={s.mapping[col] || ""}
                                  onChange={(e) => update(i, { mapping: Object.assign([...s.mapping], { [col]: e.target.value }) })}
                                >
                                  <option value="">{fieldLabel("")}</option>
                                  {FIELDS.map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {fieldLabel(f.key)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {sheets && !result && (
          <Card title={t("import.lawyersStep")} subtitle={lawyers.length > 0 ? t("import.lawyersHint") : undefined}>
            {lawyers.length === 0 ? (
              <p className={pageStyles.note}>{t("import.noLawyers")}</p>
            ) : (
              <>
                <div className={styles.mapping}>
                  {lawyers.map((l) => (
                    <div key={l.name} className={styles.mapItem}>
                      <span className={styles.mapTitle} title={l.name}>
                        {l.name} · {t("import.lawyerRows", { count: l.count })}
                      </span>
                      <select aria-label={l.name} value={l.accountId} onChange={(e) => setLawyerChoice((c) => ({ ...c, [l.name]: e.target.value }))}>
                        <option value="">{t("import.lawyerNameOnly")}</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {lawyers.some((l) => !l.accountId) && <p className={pageStyles.note}>{t("import.lawyersUnmatched")}</p>}
              </>
            )}
          </Card>
        )}

        {sheets && !result && (
          <Card title={t("import.step3")}>
            {rows.length === 0 ? (
              <p className={pageStyles.note}>{t("import.noRows")}</p>
            ) : (
              <>
                {!money && <p className={pageStyles.note} style={{ marginBottom: 10 }}>{t("finance.importSkipped")}</p>}
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{fieldLabel("name")}</th>
                        <th>{fieldLabel("phones")}</th>
                        <th>{t("cases.status")}</th>
                        <th>{fieldLabel("lawyer")}</th>
                        {money && <th>{fieldLabel("contractAmount")}</th>}
                        {money && <th>{fieldLabel("paid")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((r) => (
                        <tr key={`${r.sheet}-${r.row}`}>
                          <td>{r.name}</td>
                          <td>{r.phones.join(", ") || "—"}</td>
                          <td>
                            {r.status ? t(`cases.statuses.${r.status}`) : "—"}
                            {r.legalStage ? ` · ${t(`cases.stages.${r.legalStage}`)}` : ""}
                          </td>
                          <td>{r.lawyerId ? accounts.find((a) => a.id === r.lawyerId)?.name : r.lawyer || "—"}</td>
                          {money && <td>{r.contractAmount ? fmt.money(r.contractAmount) : "—"}</td>}
                          {money && <td>{r.paid ? fmt.money(r.paid) : "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {progress ? (
                  <div className={pageStyles.formStack} style={{ marginTop: 14 }}>
                    <p className={pageStyles.note}>{t("import.running", { done: progress.done, total: progress.total })}</p>
                    <div className={styles.progress}>
                      <div className={styles.progressFill} style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className={pageStyles.actionsRow}>
                    <Button variant="primary" icon="upload" onClick={run}>
                      {t("import.start", { count: rows.length })}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {result && (
          <Card title={t("import.done")}>
            <div className={styles.resultNumbers}>
              <StatTile label={t("import.created")} value={fmt.number(result.created)} />
              <StatTile label={t("import.updated")} value={fmt.number(result.updated)} />
              <StatTile label={t("import.skipped")} value={fmt.number(result.skipped)} />
            </div>
            {result.problems.length > 0 && (
              <>
                <p className={pageStyles.note} style={{ marginTop: 14 }}>
                  {t("import.problems")}
                </p>
                <ul style={{ margin: "6px 0 0 18px", fontSize: 13 }}>
                  {result.problems.slice(0, 20).map((p, i) => (
                    <li key={i}>
                      {p.sheet} · {p.row}: {p.error}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className={pageStyles.actionsRow}>
              <Button variant="primary" to="/clients">
                {t("import.openClients")}
              </Button>
              <Button
                onClick={() => {
                  setResult(null);
                  setSheets(null);
                  setFileName("");
                }}
              >
                {t("import.again")}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
