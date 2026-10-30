import type { Mode } from "./conditions";

// 거리·시간 계산은 이 파일에서만 한다 (CLAUDE.md 규칙 2).
// 이동 시간은 모두 추정값이다 — 기준은 docs/PLAN.md 결정 로그.

type Point = { lat: number; lon: number };

const DETOUR = 1.3; // 직선거리 → 도로 거리
const CAR_KMH = 30;
const CAR_PARKING_MIN = 5;
const WALK_KMH = 4.5;
const WALK_MAX_KM = 1.5;
const BUS_KMH = 15;
const BUS_WAIT_MIN = 10;

// 두 좌표 사이 직선거리(km) — 하버사인 공식
export function straightKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// a → b 이동 시간(분, 올림)
export function travelMinutes(a: Point, b: Point, mode: Mode): number {
  const km = straightKm(a, b) * DETOUR;
  if (km === 0) return 0;
  if (mode === "car") return Math.ceil((km / CAR_KMH) * 60) + CAR_PARKING_MIN;
  if (km <= WALK_MAX_KM) return Math.ceil((km / WALK_KMH) * 60);
  return Math.ceil((km / BUS_KMH) * 60) + BUS_WAIT_MIN;
}

// "HH:MM" ↔ 자정부터 분
export function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}

export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
