import "server-only";
import params from "../../data/params.json";
import { THEMES, type Conditions } from "./conditions";
import { basicNarration, parseNarration, type Narration } from "./narration";
import { getPlaces, type Place } from "./places";
import type { PlanStop } from "./planner";

// S02-⑤ AI 코스 설명 — Gemini 는 이 파일에서만 부른다.
// 실패해도 예외를 던지지 않고 { value, reason } 으로 돌려준다 (CLAUDE.md 규칙 4).

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const TYPE_LABEL: Record<Place["type"], string> = {
  spot: "명소",
  culture: "문화시설",
  restaurant: "식당",
  cafe: "카페",
};

const REGION_LABEL: Record<string, string> = {
  wondosim: "원도심",
  gyeryong: "계룡산권",
  magok: "마곡사권",
};

// 코스 한 줄 — AI 가 이름만 보고 짐작하지 않도록 데이터에 있는 종류·테마·권역을 함께 넘긴다
function stopLine(stop: PlanStop, index: number): string {
  const place = getPlaces().find((p) => p.id === stop.id);
  const facts: string[] = [];
  if (place) {
    facts.push(TYPE_LABEL[place.type]);
    const themes = THEMES.filter((t) => place.themes.includes(t.value)).map((t) => t.label);
    if (themes.length > 0) facts.push(`테마 ${themes.join("·")}`);
    if (REGION_LABEL[place.region]) facts.push(REGION_LABEL[place.region]);
  }
  const meal = stop.meal ? (stop.arrive < "15:00" ? " · 점심 식사" : " · 저녁 식사") : "";
  return `${index + 1}. [${stop.id}] ${stop.arrive}~${stop.depart} ${stop.name} (${facts.join(" · ")}${meal})`;
}

// 이동수단은 넘기지 않는다 — 넘기면 '자가용으로 이동' 같은 단정 문장이 나온다 (docs/PLAN.md 결정 로그)
function buildPrompt({ conditions, stops }: Course): string {
  return `당신은 공주를 처음 찾는 가족에게 코스를 설명하는 안내자입니다. 한국어로 씁니다.

규칙:
- 아래 목록의 장소와 시각만 씁니다. 목록에 없는 장소는 쓰지 않습니다.
- 영업시간·가격·이동 수단을 단정하지 않습니다. 자가용·차·버스·도보·대중교통 등 장소 사이를 어떻게 오가는지 쓰지 않습니다.
- 목록에 없는 숫자는 쓰지 않습니다.
- 과장하지 않습니다. 최고·필수·꼭 같은 표현을 쓰지 않습니다.
- 순서를 바꾸거나 다른 장소를 추천하지 않습니다.
- 장소 이름만 보고 분위기·경치·메뉴·시설·체험 내용·역사를 추측하지 않습니다. 괄호 안의 종류·테마·권역과 코스 순서에 있는 내용만 근거로 씁니다.
- "하루"라고 쓰지 않습니다. 코스 길이는 여행 시간 값으로만 말합니다.

쓸 내용:
- summary: 코스의 흐름을 2~3문장으로 설명합니다.
- stops: 목록의 장소마다 placeId 와 why 를 씁니다. why 는 이 장소가 코스에서 어떤 역할인지 한 문장입니다. 고른 테마나 앞뒤 순서와 연결해 쓰고, 장소 이름을 다시 쓰지 않습니다.
- 식당의 why 는 점심·저녁 중 어느 식사인지와 앞뒤 일정과의 연결만 씁니다.
- cautions: 방문 전에 확인하면 좋은 점을 단정 없이 0~2개 씁니다.

여행 시간: ${conditions.hours}시간
고른 테마: ${conditions.themes.length > 0 ? THEMES.filter((t) => conditions.themes.includes(t.value)).map((t) => t.label).join("·") : "모든 테마"}
코스:
${stops.map(stopLine).join("\n")}`;
}

// 답의 틀 — placeId 는 이번 코스의 id 중에서만 고를 수 있다
function responseSchema(courseIds: string[]) {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      stops: {
        type: "array",
        items: {
          type: "object",
          properties: {
            placeId: { type: "string", enum: courseIds },
            why: { type: "string" },
          },
          required: ["placeId", "why"],
        },
      },
      cautions: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "stops", "cautions"],
  };
}

type Course = { conditions: Conditions; stops: PlanStop[] };

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

export async function narrateCourse(course: Course): Promise<Narration> {
  const { conditions, stops } = course;
  const fallback = (cause: string): Narration => {
    // 원인은 터미널에만 남긴다 — 키나 프롬프트는 남기지 않는다
    if (cause) console.warn(`[narrate] 기본 설명으로 대체 — ${cause}`);
    return { value: basicNarration(conditions, stops), reason: "ai_narrate_template" };
  };

  if (stops.length === 0) return fallback("");

  // 키는 .env.local 에서만 읽는다 (CLAUDE.md 규칙 3)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback("GEMINI_API_KEY 없음");

  const courseIds = stops.map((s) => s.id);
  const { model, timeoutMs, thinkingLevel } = params.gemini;

  try {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(course) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema(courseIds),
          thinkingConfig: { thinkingLevel },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return fallback(`HTTP ${res.status}`);

    const data = (await res.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("");
    const value = parseNarration(text, courseIds);
    return value ? { value, reason: null } : fallback("답의 틀이 다름");
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return fallback(`시간 초과 ${timeoutMs}ms`);
    return fallback("연결 오류");
  }
}
