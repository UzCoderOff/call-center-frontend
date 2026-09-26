import { Link } from "react-router-dom";
import styles from "./Button.module.css";
import Icon from "./Icon";
import Spinner from "./Spinner";

// variant: primary | secondary | plain | destructive
// size:    small | medium | large
// Renders a <Link> for `to`, an <a> for `href`, otherwise a <button>.
export default function Button({
  variant = "secondary",
  size = "medium",
  block = false,
  icon,
  busy = false,
  to,
  href,
  className = "",
  children,
  ...rest
}) {
  const cls = [styles.button, styles[variant], styles[size], block ? styles.block : "", className].join(" ");
  const content = (
    <>
      {busy ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === "large" ? 20 : 17} /> : null}
      {children && <span>{children}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest} disabled={busy || rest.disabled}>
      {content}
    </button>
  );
}
