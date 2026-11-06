// 코스 규칙 자동 검사 — 조건 192개(이동수단 2 × 시간 3 × 테마 조합 32)를 /api/plan 에 물어본다.
// 먼저 창 ①에서 npm run dev 를 켠다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";

const BASE = "http://localhost:3000";
const THEMES = ["history", "nature", "food", "activity", "cafe"];
const LUNCH = ["11:30", "13:30"];
const DINNER = ["17:30", "19:30"];

const { places } = JSON.parse(readFileSync(new URL("../data/places.json", import.meta.url), "utf8"));
const byId = new Map(places.map((p) => [p.id, p]));

const conditions = [];
for (const mode of ["car", "transit"]) {
  for (const hours of [3, 6, 9]) {
    for (let bits = 0; bits < 32; bits++) {
      conditions.push({ mode, hours, themes: THEMES.filter((_, i) => bits & (1 << i)) });
    }
  }
}

const label = (c) => `${c.mode} ${c.hours}시간 ${c.themes.join("+") || "모든 테마"}`;
const courses = [];

before(async () => {
  for (const c of conditions) {
    const params = new URLSearchParams({ mode: c.mode, hours: String(c.hours) });
    if (c.themes.length > 0) params.set("themes", c.themes.join(","));
    let res;
    try {
      res = await fetch(`${BASE}/api/plan?${params}`);
    } catch {
      assert.fail("개발 서버에 연결할 수 없습니다 — 창 ①에서 npm run dev 를 켜 주세요");
    }
    assert.equal(res.status, 200, `${label(c)}: /api/plan 응답 ${res.status}`);
    courses.push({ condition: c, stops: (await res.json()).stops });
  }
});

function report(problems) {
  const shown = problems.slice(0, 10).join("\n");
  assert.equal(problems.length, 0, `위반 ${problems.length}건\n${shown}`);
}

test("① 코스의 모든 장소 id 가 data/places.json 에 있다", () => {
  const problems = [];
  for (const { condition, stops } of courses) {
    for (const stop of stops) {
      if (!byId.has(stop.id)) problems.push(`${label(condition)}: 없는 id ${stop.id}`);
    }
  }
  report(problems);
});

test("② 식당은 점심 · 저녁마다 1곳까지", () => {
  const problems = [];
  for (const { condition, stops } of courses) {
    const restaurants = stops.filter((s) => byId.get(s.id)?.type === "restaurant");
    for (const [name, [from, to]] of [["점심", LUNCH], ["저녁", DINNER]]) {
      const inMeal = restaurants.filter((s) => s.arrive >= from && s.arrive <= to);
      if (inMeal.length > 1) {
        problems.push(`${label(condition)}: ${name}에 식당 ${inMeal.length}곳 — ${inMeal.map((s) => `${s.name} ${s.arrive}`).join(" → ")}`);
      }
    }
  }
  report(problems);
});

test("③ 6·9시간 코스에 고른 테마마다 식사가 아닌 장소가 1곳 이상 있다", () => {
  const problems = [];
  for (const { condition, stops } of courses) {
    if (condition.hours < 6) continue; // 3시간은 관광지가 1곳이라 제외 (docs/PLAN.md 결정 로그)
    const sights = stops.filter((s) => !s.meal);
    const missing = condition.themes.filter((theme) => !sights.some((s) => byId.get(s.id)?.themes.includes(theme)));
    if (missing.length > 0) {
      problems.push(`${label(condition)}: ${missing.join(",")} 없음 — ${sights.map((s) => s.name).join(" > ")}`);
    }
  }
  report(problems);
});
