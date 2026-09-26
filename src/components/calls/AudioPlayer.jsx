import { useEffect, useRef, useState } from "react";
import styles from "./AudioPlayer.module.css";
import Icon from "../ui/Icon";
import Spinner from "../ui/Spinner";
import { useI18n } from "../../i18n";

const SPEEDS = [1, 1.5, 2];

// Call-recording player. The server streams with Range support, so seeking
// works; the first play of an AMR recording waits a moment while the server
// converts it to MP3 (cached after that).
export default function AudioPlayer({ src }) {
  const { t, fmt } = useI18n();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setWaiting(true);
      try {
        await audio.play();
      } catch {
        // play() rejects on a load error; onError below shows the message.
      } finally {
        setWaiting(false);
      }
    } else {
      audio.pause();
    }
  }

  function seek(e) {
    const audio = audioRef.current;
    const value = Number(e.target.value);
    if (audio && Number.isFinite(value)) {
      audio.currentTime = value;
      setCurrent(value);
    }
  }

  if (failed) {
    return (
      <div className={styles.error}>
        <Icon name="alertTriangle" size={18} />
        <span>{t("callDetail.playbackError")}</span>
      </div>
    );
  }

  const knownDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progress = knownDuration ? (current / knownDuration) * 100 : 0;

  return (
    <div className={styles.player}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        className={styles.play}
        onClick={toggle}
        aria-label={playing ? t("player.pause") : t("player.play")}
      >
        {waiting ? <Spinner size={18} /> : <Icon name={playing ? "pause" : "play"} size={20} />}
      </button>

      <div className={styles.track}>
        <input
          type="range"
          min={0}
          max={knownDuration || 0}
          step={0.1}
          value={Math.min(current, knownDuration || current)}
          onChange={seek}
          disabled={!knownDuration}
          aria-label={t("player.seek")}
          className={styles.range}
          style={{ "--progress": `${progress}%` }}
        />
        <div className={styles.times}>
          <span>{fmt.clock(current)}</span>
          <span>{knownDuration ? fmt.clock(knownDuration) : "–:––"}</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.speed}
        onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
        aria-label={`${t("player.speed")}: ${speed}×`}
      >
        {speed}×
      </button>
    </div>
  );
}
