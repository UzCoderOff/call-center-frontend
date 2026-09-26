import styles from "./Spinner.module.css";

export default function Spinner({ size = 20, label }) {
  return (
    <span className={styles.spinner} style={{ width: size, height: size }} role={label ? "status" : undefined}>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
