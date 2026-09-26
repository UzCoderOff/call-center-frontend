import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Loads data for a page and tracks { data, error, loading }.
//
// While re-fetching (filter change, retry) the previous data is kept, so the
// page holds its layout and dims instead of flashing to a spinner.
// `setData` lets a page apply a mutation's result without a reload.
export function useAsync(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  // Always the latest loader (it closes over the current filters). Updated in
  // a layout effect, which runs before the loading effect below.
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (next) => setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next })),
    []
  );

  return { ...state, reload, setData };
}

// Width of an element, kept current as it resizes — for charts that lay out
// in real pixels (so rounded corners and 2px gaps stay crisp at any width).
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
