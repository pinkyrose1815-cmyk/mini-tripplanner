"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HOURS, MODES, THEMES, toPlanUrl, type Hours, type Mode, type Theme } from "@/lib/conditions";

// S01 ②~⑥ — docs/SCREENS.md
export default function ConditionsForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [hours, setHours] = useState<Hours | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);

  const ready = mode !== null && hours !== null;

  function toggleTheme(theme: Theme) {
    setThemes((prev) => (prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]));
  }

  function makeCourse() {
    if (!ready) return;
    router.push(toPlanUrl({ mode, hours, themes }));
  }

  let guide = "이동수단과 시간을 골라 주세요";
  if (ready) {
    guide = themes.length > 0 ? "좋아요!" : "좋아요! 테마를 안 고르면 모든 테마로 만들어요";
  }

  return (
    <>
      {/* S01-② */}
      <section className="field">
        <h2>이동수단 <small>필수 · 하나만</small></h2>
        <div className="options segmented">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className="option"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* S01-③ */}
      <section className="field">
        <h2>여행 시간 <small>필수 · 하나만</small></h2>
        <div className="options segmented">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              className="option"
              aria-pressed={hours === h}
              onClick={() => setHours(h)}
            >
              {h}시간
            </button>
          ))}
        </div>
      </section>

      {/* S01-④ */}
      <section className="field">
        <h2>관심 테마 <small>선택 · 여러 개</small></h2>
        <div className="options">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              className="option chip"
              aria-pressed={themes.includes(t.value)}
              onClick={() => toggleTheme(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* S01-⑤ */}
      <button type="button" className="primary" disabled={!ready} onClick={makeCourse}>
        코스 만들기 <span aria-hidden="true">→</span>
      </button>

      {/* S01-⑥ */}
      <p className="guide" aria-live="polite">
        {guide}
      </p>
    </>
  );
}
