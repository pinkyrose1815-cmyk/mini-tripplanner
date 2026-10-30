import type { Conditions } from "./conditions";
import { getPlaces, type Place } from "./places";
import { straightKm, toClock, toMinutes, travelMinutes } from "./routing";

// 조건 → 하루 코스. 규칙은 docs/PLAN.md 결정 로그를 따른다.

const START = toMinutes("10:00");
const MAX_OPEN_WAIT_MIN = 30; // 개장 전 기다릴 수 있는 최대 시간
const MIN_TRANSIT_ACCESS = 0.3;

type Meal = { start: number; end: number };

const MEALS: Meal[] = [
  { start: toMinutes("11:30"), end: toMinutes("13:30") }, // 점심
  { start: toMinutes("17:30"), end: toMinutes("19:30") }, // 저녁
];

export type PlanStop = {
  id: string;
  name: string;
  lat: number; // S02-③ 지도 마커
  lon: number;
  arrive: string; // "HH:MM"
  depart: string;
  travelMin: number; // 앞 장소에서 오는 이동 시간(추정) · 첫 장소는 0
  meal: boolean;
};

// S02-② '알아 두세요' 배지로 바뀌는 코드
export type PlanReason = "travel_estimated" | "hours_defaulted";

export type Plan = { stops: PlanStop[]; reasons: PlanReason[] };

// /api/plan 응답
export type PlanResponse = Plan & { conditions: Conditions };

type Visit = { place: Place; arrive: number; depart: number; travelMin: number; meal: boolean };

export function makePlan({ mode, hours, themes }: Conditions): Plan {
  const end = START + hours * 60;
  const usable = getPlaces().filter((p) => mode !== "transit" || p.transitAccess >= MIN_TRANSIT_ACCESS);
  // 식당은 식사로만 쓰고, 나머지는 테마로 거른다 (테마를 비우면 모두)
  const spots = usable.filter(
    (p) => p.type !== "restaurant" && (themes.length === 0 || p.themes.some((t) => (themes as string[]).includes(t))),
  );
  const restaurants = usable.filter((p) => p.type === "restaurant");
  // 여행이 식사 시간창 전체를 덮을 때만 식사를 넣는다
  const pendingMeals = MEALS.filter((m) => START <= m.start && end >= m.end);

  const used = new Set<string>();
  const visits: Visit[] = [];

  // from → place 로 가서 머물 수 있으면 방문 정보를, 아니면 null
  function tryVisit(from: Place | null, time: number, place: Place, meal?: Meal): Visit | null {
    const travelMin = from ? travelMinutes(from, place, mode) : 0;
    const reach = time + travelMin;
    const opensAt = toMinutes(place.open);
    if (!meal && opensAt - reach > MAX_OPEN_WAIT_MIN) return null;
    const arrive = Math.max(reach, opensAt, meal ? meal.start : 0);
    if (meal && arrive > meal.end) return null;
    const depart = arrive + place.stayMin;
    if (depart > toMinutes(place.close) || depart > end) return null;
    return { place, arrive, depart, travelMin, meal: Boolean(meal) };
  }

  function canStillEat(after: Visit, meal: Meal): boolean {
    return restaurants.some((r) => !used.has(r.id) && tryVisit(after.place, after.depart, r, meal) !== null);
  }

  // 가까운 순 — 같으면 id 순으로 늘 같은 결과
  function nearest(options: Visit[], from: { lat: number; lon: number }): Visit {
    return [...options].sort(
      (a, b) =>
        straightKm(from, a.place) - straightKm(from, b.place) || a.place.id.localeCompare(b.place.id),
    )[0];
  }

  // 출발지 기준점: 후보 장소들의 중심
  const center = spots.length
    ? {
        lat: spots.reduce((s, p) => s + p.lat, 0) / spots.length,
        lon: spots.reduce((s, p) => s + p.lon, 0) / spots.length,
      }
    : { lat: 0, lon: 0 };

  for (;;) {
    const last = visits.at(-1) ?? null;
    const from = last?.place ?? null;
    const time = last?.depart ?? START;
    const meal = pendingMeals[0];

    let options = spots
      .filter((p) => !used.has(p.id))
      .map((p) => tryVisit(from, time, p))
      .filter((v): v is Visit => v !== null);
    if (meal) options = options.filter((v) => canStillEat(v, meal));

    let next: Visit | null = null;
    if (meal && (time >= meal.start || options.length === 0)) {
      const mealOptions = restaurants
        .filter((r) => !used.has(r.id))
        .map((r) => tryVisit(from, time, r, meal))
        .filter((v): v is Visit => v !== null);
      if (mealOptions.length === 0) break;
      next = nearest(mealOptions, from ?? center);
      pendingMeals.shift();
    } else if (options.length > 0) {
      next = nearest(options, from ?? center);
    } else {
      break;
    }

    used.add(next.place.id);
    visits.push(next);
  }

  // 필요한 식사를 못 넣었으면 시간창 위반이므로 코스를 내지 않는다
  if (pendingMeals.length > 0 || visits.length === 0) return { stops: [], reasons: [] };

  const reasons: PlanReason[] = [];
  if (visits.length > 1) reasons.push("travel_estimated");
  if (visits.some((v) => v.place.hoursDefaulted)) reasons.push("hours_defaulted");

  return {
    stops: visits.map((v) => ({
      id: v.place.id,
      name: v.place.name.ko,
      lat: v.place.lat,
      lon: v.place.lon,
      arrive: toClock(v.arrive),
      depart: toClock(v.depart),
      travelMin: v.travelMin,
      meal: v.meal,
    })),
    reasons,
  };
}
