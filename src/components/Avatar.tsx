const COLORS = ['#5b8def', '#e86c8a', '#f0a14a', '#4fb38a', '#9b6cf0', '#3fb0c9', '#e3684f'];

/** Круглый аватар с инициалами; цвет стабилен для одного и того же чата */
export function Avatar({ seed, text, size = 48 }: { seed: string; text: string; size?: number }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <div className="avatar" style={{ width: size, height: size, background: COLORS[hash % COLORS.length], fontSize: size * 0.36 }}>
      {text}
    </div>
  );
}
