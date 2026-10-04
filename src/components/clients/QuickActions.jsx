import { Link } from "react-router-dom";
import styles from "./QuickActions.module.css";
import Icon from "../ui/Icon";

// [{ icon, label, to? | onClick? }] — the row under a client's name.
export default function QuickActions({ actions }) {
  const shown = actions.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <div className={styles.row}>
      {shown.map((a) =>
        a.to ? (
          <Link key={a.label} to={a.to} className={styles.action}>
            <Icon name={a.icon} size={22} />
            <span className={styles.label}>{a.label}</span>
          </Link>
        ) : (
          <button key={a.label} type="button" className={styles.action} onClick={a.onClick}>
            <Icon name={a.icon} size={22} />
            <span className={styles.label}>{a.label}</span>
          </button>
        )
      )}
    </div>
  );
}
