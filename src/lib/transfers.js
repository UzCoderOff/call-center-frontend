// A client's call passed on to a colleague on Ledger's line (the app's
// "Ulash"): whom it went to last — "Ulandi: Aziza" — or that they didn't answer.
export function transferText(call, t) {
  const transfers = call.pbxDetail?.transfers;
  if (!Array.isArray(transfers) || transfers.length === 0) return null;
  const last = transfers.filter((x) => x.answered).pop();
  if (last) return t("calls.transferredTo", { name: last.name || "—" });
  return t("calls.transferMissed", { name: transfers[transfers.length - 1].name || "—" });
}
