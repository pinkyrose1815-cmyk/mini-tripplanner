// 사용자 장소 목록 병합: node scripts/merge_hotplaces.mjs <csv 경로>
// 이름이 겹치고 500m 이내인 장소는 중복으로 보고 건너뛴다. 다시 실행해도 같은 장소를 두 번 넣지 않는다.
// CSV 에 없는 값은 지어내지 않는다 — 비우거나 기본값으로 두고 sources 에 표시한다.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("CSV 경로를 지정하세요: node scripts/merge_hotplaces.mjs <csv 경로>");
  process.exit(1);
}

const DUPLICATE_KM = 0.5;
const REGIONS = { 원도심: "wondosim", 계룡: "gyeryong", 마곡: "magok", 기타: "other" };
// 종류별 값 — 체류 시간은 기존 데이터의 중앙값. 떡집처럼 끼니가 아닌 디저트는 카페로 본다.
const CATEGORIES = {
  식당: { type: "restaurant", themes: ["food"], stayMin: 60 },
  카페: { type: "cafe", themes: ["food", "cafe"], stayMin: 45 },
  "카페/베이커리": { type: "cafe", themes: ["food", "cafe"], stayMin: 45 },
  "식당/디저트": { type: "cafe", themes: ["food", "cafe"], stayMin: 45 },
};

function parseLine(line) {
  const cells = [];
  for (const m of line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)) {
    cells.push(m[2] ?? m[1]);
    if (m[3] === "") break;
  }
  return cells;
}

const lines = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const header = parseLine(lines[0]);
const rows = lines.slice(1).map((line) => {
  const cells = parseLine(line);
  return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
});

const normalize = (name) => name.replace(/[\s()·]/g, "");
function km(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const placesFile = JSON.parse(readFileSync("data/places.json", "utf8"));
const detailsFile = JSON.parse(readFileSync("data/place_details.json", "utf8"));
const original = [...placesFile.places];
const added = [];
const skipped = [];

for (const row of rows) {
  const point = { lat: Number(row.lat), lon: Number(row.lon) };
  const name = normalize(row.name);
  const same = placesFile.places.find((p) => {
    const other = normalize(p.name.ko);
    return (other === name || other.includes(name) || name.includes(other)) && km(point, p) <= DUPLICATE_KM;
  });
  if (same) {
    skipped.push(`${row.name} = ${same.name.ko}`);
    continue;
  }
  const category = CATEGORIES[row.category];
  const region = REGIONS[row.region];
  if (!category || !region) {
    console.error(`알 수 없는 값: ${row.name} (${row.category}, ${row.region})`);
    process.exit(1);
  }
  // 대중교통 접근성은 가장 가까운 기존 장소의 추정값을 쓴다
  const nearest = [...original].sort((a, b) => km(point, a) - km(point, b))[0];
  const place = {
    id: row.id,
    contentId: null,
    name: { ko: row.name, en: row.name, ja: row.name, zh: row.name },
    type: category.type,
    themes: category.themes,
    lat: point.lat,
    lon: point.lon,
    region,
    stayMin: category.stayMin,
    open: null,
    close: null,
    closedDays: [],
    indoor: true,
    cost: null,
    parking: null,
    star: null,
    reviews: 0,
    adjStar: 4.3,
    transitAccess: nearest.transitAccess,
    sources: {
      star: "placeholder",
      hours: "missing",
      transitAccess: "estimated",
      place: "user_csv",
      stayMin: "default",
      name: "ko_only",
    },
  };
  placesFile.places.push(place);
  detailsFile.details[row.id] = { text: row.description, source: "user_csv" };
  added.push(`${row.id} ${row.name} (${category.type}, ${region})`);
}

placesFile.meta.count = placesFile.places.length;
detailsFile.meta.user_csv = "사용자 제공 목록 data/seed/hotplaces.csv 의 한 줄 설명";
writeFileSync("data/places.json", JSON.stringify(placesFile, null, 2) + "\n");
writeFileSync("data/place_details.json", JSON.stringify(detailsFile, null, 2) + "\n");
mkdirSync("data/seed", { recursive: true });
copyFileSync(csvPath, "data/seed/hotplaces.csv");

console.log(`추가 ${added.length}곳\n  ${added.join("\n  ")}`);
console.log(`중복 제외 ${skipped.length}곳\n  ${skipped.join("\n  ")}`);
console.log(`전체 ${placesFile.places.length}곳`);
