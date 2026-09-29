import styles from "./Materials.module.css";
import Icon from "../ui/Icon";
import { parseBlocks, parseInline } from "../../lib/richText";
import { useI18n } from "../../i18n";

// A material's text, from the simple formatting in lib/richText.js. Built
// from React elements only — text people typed can never become HTML.
function Inline({ text }) {
  return parseInline(text).map((part, i) => {
    if (part.type === "bold") return <strong key={i}>{part.text}</strong>;
    if (part.type === "link") {
      return (
        <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
          {part.text}
        </a>
      );
    }
    return <span key={i}>{part.text}</span>;
  });
}

function Lines({ lines }) {
  return lines.map((line, i) => (
    <p key={i}>
      <Inline text={line} />
    </p>
  ));
}

export default function RichText({ text }) {
  const { t } = useI18n();
  return (
    <div className={styles.rich}>
      {parseBlocks(text).map((block, i) => {
        switch (block.type) {
          case "h1":
            return (
              <h2 key={i}>
                <Inline text={block.text} />
              </h2>
            );
          case "h2":
            return (
              <h3 key={i}>
                <Inline text={block.text} />
              </h3>
            );
          case "say":
            return (
              <div key={i} className={styles.say}>
                <Icon name="phone" size={17} className={styles.sayIcon} />
                <div>
                  <span className={styles.sayLabel}>{t("materials.sayThis")}</span>
                  <Lines lines={block.lines} />
                </div>
              </div>
            );
          case "note":
            return (
              <div key={i} className={styles.note}>
                <span className={styles.noteLabel}>{t("materials.important")}</span>
                <Lines lines={block.lines} />
              </div>
            );
          case "ul":
          case "ol": {
            const List = block.type === "ul" ? "ul" : "ol";
            return (
              <List key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          }
          default:
            return (
              <p key={i}>
                {block.lines.map((line, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    <Inline text={line} />
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
