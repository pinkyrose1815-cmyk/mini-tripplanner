import data from "../../data/place_details.json";

// 장소 설명 자료 (data/place_details.json) — 한국관광공사 TourAPI 소개문과 시드 한 줄 설명
type Detail = { text: string; source: string };

const details = data.details as Record<string, Detail | undefined>;

export function getPlaceDetail(id: string): string {
  return details[id]?.text ?? "";
}

const SHORT_CHARS = 120;

// AI 설명이 없을 때 화면에 보여 줄 짧은 설명 — 자료의 앞 문장을 그대로 쓴다
export function shortPlaceDetail(id: string): string {
  const text = getPlaceDetail(id);
  const firstEnd = text.search(/[.!?](\s|$)/);
  if (firstEnd >= 0 && firstEnd < SHORT_CHARS) return text.slice(0, firstEnd + 1);
  return text.length <= SHORT_CHARS ? text : `${text.slice(0, SHORT_CHARS).trim()}…`;
}
