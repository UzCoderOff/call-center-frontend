import { useLocation, useNavigate } from "react-router-dom";

// "Back" that returns to where the person came from (e.g. a filtered call
// list) when there is in-app history, and to a sensible page otherwise
// (a link opened directly, a fresh tab).
export function useBack(fallback) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== "default") navigate(-1);
    else navigate(fallback);
  };
}
