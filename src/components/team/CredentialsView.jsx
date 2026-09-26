import styles from "./CredentialsView.module.css";
import { CopyButton } from "../ui/Misc";

// One-time credentials (temporary password, device ID) shown right after an
// account is created or a password is reset. Each value is copyable.
export default function CredentialsView({ note, items }) {
  return (
    <div className={styles.wrap}>
      {note && <p className={styles.note}>{note}</p>}
      <div className={styles.list}>
        {items.map((item) => (
          <div key={item.label} className={styles.item}>
            <div className={styles.label}>{item.label}</div>
            <div className={styles.valueRow}>
              <code className={styles.value}>{item.value}</code>
              <CopyButton value={item.value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
