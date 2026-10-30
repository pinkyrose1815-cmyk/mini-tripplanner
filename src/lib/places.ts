import data from "../../data/places.json";

// data/places.json 의 장소 한 곳. 필드 이름은 데이터 그대로 쓴다.
export type Place = {
  id: string;
  contentId: string;
  name: { ko: string; en: string; ja: string; zh: string };
  type: "spot" | "culture" | "restaurant" | "cafe";
  themes: string[];
  lat: number;
  lon: number;
  region: string;
  stayMin: number;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  closedDays: number[]; // 2회차에는 쓰지 않음 (docs/PLAN.md 결정 로그)
  indoor: boolean;
  cost: number;
  parking: boolean;
  star: number | null;
  reviews: number;
  adjStar: number;
  transitAccess: number;
  hoursDefaulted: boolean; // 영업시간이 없어 기본 시간을 채웠으면 true → S02-② 배지
};

type RawPlace = Omit<Place, "open" | "close" | "hoursDefaulted"> & {
  open: string | null;
  close: string | null;
};

// 영업시간이 없는 장소의 기본 시간 (docs/PLAN.md 결정 로그)
const DEFAULT_HOURS = {
  restaurant: { open: "11:00", close: "20:00" },
  other: { open: "09:00", close: "18:00" },
};

function withHours(raw: RawPlace): Place {
  if (raw.open && raw.close) {
    return { ...raw, open: raw.open, close: raw.close, hoursDefaulted: false };
  }
  const hours = raw.type === "restaurant" ? DEFAULT_HOURS.restaurant : DEFAULT_HOURS.other;
  return { ...raw, ...hours, hoursDefaulted: true };
}

const places: Place[] = (data.places as RawPlace[]).map(withHours);

export function getPlaces(): Place[] {
  return places;
}
