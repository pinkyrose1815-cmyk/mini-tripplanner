// S01에서 고르고 주소(URL)로 넘기는 조건 값 — docs/SCREENS.md

// hint = 버튼 아래 보조 문구 (docs/PLAN.md 결정 로그의 규칙과 맞춘다)
export const MODES = [
  { value: "car", label: "자가용", hint: "주차 포함" },
  { value: "transit", label: "도보·대중교통", hint: "원도심 위주" },
] as const;

export const HOURS = [3, 6, 9] as const;

export const HOUR_HINTS: Record<(typeof HOURS)[number], string> = {
  3: "반나절",
  6: "하루",
  9: "알찬 하루",
};

// data/places.json 의 테마 값. `rest`는 숨긴다 (docs/PLAN.md 결정 로그)
export const THEMES = [
  { value: "history", label: "역사" },
  { value: "nature", label: "자연" },
  { value: "food", label: "먹거리" },
  { value: "activity", label: "체험" },
  { value: "cafe", label: "카페" },
] as const;

export type Mode = (typeof MODES)[number]["value"];
export type Hours = (typeof HOURS)[number];
export type Theme = (typeof THEMES)[number]["value"];

export type Conditions = {
  mode: Mode;
  hours: Hours;
  themes: Theme[]; // 비우면 모든 테마
};

// 주소의 조건을 읽는다. 목록에 없는 값이 하나라도 있으면 null
export function parseConditions(params: URLSearchParams): Conditions | null {
  const mode = MODES.find((m) => m.value === params.get("mode"))?.value;
  const hours = HOURS.find((h) => String(h) === params.get("hours"));
  if (!mode || !hours) return null;

  const rawThemes = (params.get("themes") ?? "").split(",").filter(Boolean);
  const themes = THEMES.map((t) => t.value).filter((v) => rawThemes.includes(v));
  if (new Set(rawThemes).size !== themes.length) return null; // 모르는 테마(`rest` 포함)

  return { mode, hours, themes };
}

// 예: /plan?mode=car&hours=6&themes=history,food · 테마가 없으면 themes를 뺀다
export function toPlanUrl({ mode, hours, themes }: Conditions): string {
  const params = new URLSearchParams({ mode, hours: String(hours) });
  if (themes.length > 0) {
    // 고른 순서와 상관없이 THEMES 순서로 담는다
    const ordered = THEMES.map((t) => t.value).filter((v) => themes.includes(v));
    params.set("themes", ordered.join(","));
  }
  // URLSearchParams는 쉼표를 %2C로 바꾸므로 읽기 쉽게 되돌린다
  return `/plan?${params.toString().replace(/%2C/g, ",")}`;
}
