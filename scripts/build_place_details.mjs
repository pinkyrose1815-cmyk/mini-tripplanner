// 장소 설명 자료 만들기: node scripts/build_place_details.mjs <원본 앱 폴더>
// 원본 앱의 TourAPI 캐시(data/raw/tourapi/ko)와 시드(data/seed/spots_clean.csv)에서 설명만 뽑아
// data/place_details.json 을 만든다. 외부 호출 없음 · data/places.json 은 고치지 않는다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root || !existsSync(join(root, "data/raw/tourapi/ko"))) {
  console.error("원본 앱 폴더를 지정하세요: node scripts/build_place_details.mjs <폴더>");
  process.exit(1);
}

const MAX_CHARS = 600; // AI 에게 넘기는 양을 줄인다 — 문장 끝에서 자른다

function clean(text) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text) {
  if (text.length <= MAX_CHARS) return text;
  const head = text.slice(0, MAX_CHARS);
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\""), head.lastIndexOf("다."));
  return end > 0 ? head.slice(0, end + 2).trim() : head.trim();
}

function overviewOf(contentId) {
  const file = join(root, "data/raw/tourapi/ko", `detailCommon2_${contentId}.json`);
  if (!existsSync(file)) return "";
  const json = JSON.parse(readFileSync(file, "utf8"));
  const items = json?.response?.body?.items?.item ?? json?.items?.item ?? json?.item ?? json;
  return clean((Array.isArray(items) ? items[0] : items)?.overview);
}

function parseCsvLine(line) {
  const cells = [];
  for (const match of line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)) {
    cells.push(match[2] ?? match[1]);
    if (match[3] === "") break;
  }
  return cells;
}

const seedLines = readFileSync(join(root, "data/seed/spots_clean.csv"), "utf8")
  .replace(/^﻿/, "")
  .split(/\r?\n/)
  .filter(Boolean);
const header = parseCsvLine(seedLines[0]);
const nameCol = header.indexOf("name");
const descCol = header.indexOf("description");
const seed = new Map(
  seedLines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return [cells[nameCol], clean(cells[descCol])];
  }),
);

const { places } = JSON.parse(readFileSync("data/places.json", "utf8"));
const details = {};
const count = { tourapi: 0, seed: 0, none: 0 };
for (const place of places) {
  const overview = overviewOf(place.contentId);
  const short = seed.get(place.name.ko);
  if (overview) {
    details[place.id] = { text: shorten(overview), source: "tourapi" };
    count.tourapi++;
  } else if (short) {
    details[place.id] = { text: short, source: "seed" };
    count.seed++;
  } else {
    count.none++;
  }
}

// 사용자 장소 목록(scripts/merge_hotplaces.mjs 로 병합)의 설명을 유지한다
const userCsv = "data/seed/hotplaces.csv";
if (existsSync(userCsv)) {
  const [head, ...rows] = readFileSync(userCsv, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const keys = parseCsvLine(head);
  for (const row of rows) {
    const cells = parseCsvLine(row);
    const id = cells[keys.indexOf("id")];
    if (!details[id] && places.some((p) => p.id === id)) {
      details[id] = { text: cells[keys.indexOf("description")], source: "user_csv" };
    }
  }
}

writeFileSync(
  "data/place_details.json",
  JSON.stringify(
    {
      meta: {
        note: "scripts/build_place_details.mjs 로 생성 — 직접 고치지 않는다",
        tourapi: "한국관광공사 TourAPI detailCommon2 overview (2026-09 수집)",
        seed: "강사 원본 앱 data/seed/spots_clean.csv 한 줄 설명",
        user_csv: "사용자 제공 목록 data/seed/hotplaces.csv 의 한 줄 설명",
      },
      details,
    },
    null,
    2,
  ) + "\n",
);
console.log(count);
