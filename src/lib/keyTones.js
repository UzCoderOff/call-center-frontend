// The keypad's sound: each key's own pair of tones (DTMF), like a phone's
// dialer. Quiet and short; nothing if the browser can't play sound.
const TONES = {
  1: [697, 1209],
  2: [697, 1336],
  3: [697, 1477],
  4: [770, 1209],
  5: [770, 1336],
  6: [770, 1477],
  7: [852, 1209],
  8: [852, 1336],
  9: [852, 1477],
  "*": [941, 1209],
  0: [941, 1336],
  "+": [941, 1336],
  "#": [941, 1477],
};

let audio = null;

export function playKeyTone(key, ms = 130) {
  const pair = TONES[key];
  if (!pair) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const volume = audio.createGain();
    volume.gain.setValueAtTime(0.14, now);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
    volume.connect(audio.destination);
    for (const hz of pair) {
      const tone = audio.createOscillator();
      tone.frequency.value = hz;
      tone.connect(volume);
      tone.start(now);
      tone.stop(now + ms / 1000);
    }
  } catch {
    // No sound here — the key still works.
  }
}
