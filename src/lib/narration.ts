import type { Conditions } from "./conditions";
import { shortPlaceDetail } from "./placeDetails";
import type { PlanStop } from "./planner";

// S02-⑤ 코스 설명의 모양 · 답 검사 · 기본 설명. AI를 부르는 코드는 gemini.ts 에만 둔다.

export type NarrationStop = { placeId: string; why: string };

export type NarrationValue = {
  summary: string;
  stops: NarrationStop[]; // 장소마다 설명 — 기본 설명이면 자료의 앞 문장
  cautions: string[];
};

// reason 이 null 이면 AI 설명, 아니면 기본 설명 (CLAUDE.md 규칙 4)
export type Narration = { value: NarrationValue; reason: "ai_narrate_template" | null };

// AI 없이 코스 표만으로 만드는 기본 설명
export function basicNarration(conditions: Conditions, stops: PlanStop[]): NarrationValue {
  if (stops.length === 0) return { summary: "", stops: [], cautions: [] };
  const first = stops[0];
  const last = stops[stops.length - 1];
  const meals = stops.filter((s) => s.meal).map((s) => `${s.arrive}에 ${s.name}`);
  const sightCount = stops.length - meals.length;
  const sentences = [`${first.name}에서 시작해 ${sightCount}곳을 둘러보는 ${conditions.hours}시간 코스예요.`];
  if (meals.length > 0) sentences.push(`식사는 ${meals.join(", ")}에서 해요.`);
  sentences.push(`${last.name}에서 ${last.depart}에 일정을 마쳐요.`);
  const details = stops
    .map((s) => ({ placeId: s.id, why: shortPlaceDetail(s.id) }))
    .filter((s) => s.why.length > 0);
  return { summary: sentences.join(" "), stops: details, cautions: [] };
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// AI 답을 서버에서 다시 검사한다. 틀이 다르면 null, 코스 밖 장소는 버린다.
export function parseNarration(text: string, courseIds: string[]): NarrationValue | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { summary, stops, cautions } = data as Record<string, unknown>;
  if (!isText(summary) || !Array.isArray(stops) || !Array.isArray(cautions)) return null;

  const seen = new Set<string>();
  const kept: NarrationStop[] = [];
  for (const stop of stops) {
    const { placeId, why } = (stop ?? {}) as Record<string, unknown>;
    if (!isText(why) || typeof placeId !== "string") continue;
    if (!courseIds.includes(placeId) || seen.has(placeId)) continue;
    seen.add(placeId);
    kept.push({ placeId, why: why.trim() });
  }

  return { summary: summary.trim(), stops: kept, cautions: cautions.filter(isText).map((c) => c.trim()) };
}
