import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App.jsx";
import { I18nProvider } from "./i18n";
import { applyTheme, readPref } from "./lib/prefs";

// Apply the saved theme before the first paint so there's no light flash
// for someone who picked dark.
applyTheme(readPref("theme", "auto"));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);
