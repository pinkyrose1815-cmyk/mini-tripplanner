import type { Conditions } from "./conditions";
import { getPlaces, type Place } from "./places";
import { straightKm, toClock, toMinutes, travelMinutes } from "./routing";

// 조건 → 하루 코스. 규칙은 docs/PLAN.md 결정 로그를 따른다.

const START = toMinutes("10:00");
const MAX_OPEN_WAIT_MIN = 30; // 개장 전 기다릴 수 있는 최대 시간
const MIN_TRANSIT_ACCESS = 0.3;
const MIN_SIGHT_STAY_MIN = 90; // 명소·문화시설을 둘러보는 최소 시간
const SHORT_STAY_MIN = 45; // 데이터 체류 시간이 이보다 짧으면 작은 장소로 본다
const MEAL_MIN = 60; // 식사 시간
const MAX_SIGHTS: Record<Conditions["hours"], number> = { 3: 2, 6: 3, 9: 4 }; // 식사·카페를 뺀 장소 수 상한

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
  stayMin: number; // 머무는 시간 — 화면은 계산하지 않고 이 값을 보여 준다
  waitMin: number; // 도착 후 개장·식사 시간까지 남는 여유
  meal: boolean;
};

// S02-② '알아 두세요' 배지로 바뀌는 코드
export type PlanReason = "travel_estimated" | "hours_defaulted" | "themes_relaxed";

export type Plan = { stops: PlanStop[]; reasons: PlanReason[] };

// /api/plan 응답
export type PlanResponse = Plan & { conditions: Conditions };

type Visit = { place: Place; arrive: number; depart: number; travelMin: number; meal: boolean };

// 머무는 시간 — 데이터 값이 짧아도 둘러볼 시간과 식사 시간은 보장한다. 카페는 데이터 값 그대로.
function stayFor(place: Place): number {
  if (place.type === "cafe") return place.stayMin;
  return Math.max(place.stayMin, place.type === "restaurant" ? MEAL_MIN : MIN_SIGHT_STAY_MIN);
}

export function makePlan({ mode, hours, themes }: Conditions): Plan {
  const end = START + hours * 60;
  const usable = getPlaces().filter((p) => mode !== "transit" || p.transitAccess >= MIN_TRANSIT_ACCESS);
  // 식당은 식사로만 쓰고, 나머지는 테마로 거른다 (테마를 비우면 모두)
  const sights = usable.filter((p) => p.type !== "restaurant");
  const spots = sights.filter(
    (p) => themes.length === 0 || p.themes.some((t) => (themes as string[]).includes(t)),
  );
  // 고른 테마만으로 일정을 못 채울 때 쓰는 나머지 장소 (카페는 고른 경우에만)
  const others = sights.filter((p) => !spots.includes(p) && p.type !== "cafe");
  const restaurants = usable.filter((p) => p.type === "restaurant");
  // 시간창 시작 후 식사 시간이 여행 시간 안에 들어가면 식사를 넣는다
  const pendingMeals = MEALS.filter((m) => START <= m.start && end >= m.start + MEAL_MIN);
  const wantsCafe = (themes as string[]).includes("cafe");

  const used = new Set<string>();
  const visits: Visit[] = [];
  let themesRelaxed = false;

  // from → place 로 가서 머물 수 있으면 방문 정보를, 아니면 null
  function tryVisit(from: Place | null, time: number, place: Place, meal?: Meal): Visit | null {
    const travelMin = from ? travelMinutes(from, place, mode) : 0;
    const reach = time + travelMin;
    const opensAt = toMinutes(place.open);
    if (!meal && opensAt - reach > MAX_OPEN_WAIT_MIN) return null;
    const arrive = Math.max(reach, opensAt, meal ? meal.start : 0);
    if (meal && arrive > meal.end) return null;
    const depart = arrive + stayFor(place);
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

  // 관광 고르기: 명소 → 문화시설 → 카페 순. 카페를 고른 사람은 식사 직후 한 번 카페부터.
  function pickSight(options: Visit[], from: { lat: number; lon: number }, afterMeal: boolean): Visit {
    const rank = (v: Visit) => {
      if (v.place.type === "cafe") return wantsCafe && afterMeal ? -1 : 2;
      // 데이터 체류 시간이 아주 짧은 곳은 둘러볼 거리가 적으니 뒤로 미룬다
      if (v.place.stayMin < SHORT_STAY_MIN) return 1.5;
      return v.place.type === "spot" ? 0 : 1;
    };
    const best = Math.min(...options.map(rank));
    return nearest(options.filter((v) => rank(v) === best), from);
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

    const cafeUsed = visits.some((v) => v.place.type === "cafe");
    const sightCount = visits.filter((v) => !v.meal && v.place.type !== "cafe").length;
    const candidates = (pool: Place[]) =>
      pool
        .filter((p) => !used.has(p.id) && !(p.type === "cafe" && cafeUsed)) // 카페는 코스당 1곳
        .map((p) => tryVisit(from, time, p))
        .filter((v): v is Visit => v !== null)
        .filter((v) => !meal || canStillEat(v, meal));

    let options: Visit[] = [];
    let relaxed = false;
    if (sightCount < MAX_SIGHTS[hours]) {
      options = candidates(spots);
      if (options.length === 0) {
        options = candidates(others);
        relaxed = options.length > 0;
      }
    }

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
      next = pickSight(options, from ?? center, last?.meal ?? false);
      if (relaxed) themesRelaxed = true;
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
  if (themesRelaxed) reasons.push("themes_relaxed");

  return {
    stops: visits.map((v, i) => ({
      id: v.place.id,
      name: v.place.name.ko,
      lat: v.place.lat,
      lon: v.place.lon,
      arrive: toClock(v.arrive),
      depart: toClock(v.depart),
      travelMin: v.travelMin,
      stayMin: v.depart - v.arrive,
      waitMin: v.arrive - (i > 0 ? visits[i - 1].depart : START) - v.travelMin,
      meal: v.meal,
    })),
    reasons,
  };
}
