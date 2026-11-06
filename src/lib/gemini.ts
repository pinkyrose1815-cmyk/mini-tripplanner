import "server-only";
import params from "../../data/params.json";
import type { Conditions } from "./conditions";
import { basicNarration, parseNarration, type Narration } from "./narration";
import type { PlanStop } from "./planner";

// S02-⑤ AI 코스 설명 — Gemini 는 이 파일에서만 부른다.
// 실패해도 예외를 던지지 않고 { value, reason } 으로 돌려준다 (CLAUDE.md 규칙 4).

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function buildPrompt({ conditions, stops }: Course): string {
  const mode = conditions.mode === "car" ? "자가용" : "도보·대중교통";
  const lines = stops.map(
    (s, i) => `${i + 1}. [${s.id}] ${s.arrive}~${s.depart} ${s.name}${s.meal ? " (식사)" : ""}`,
  );
  return `당신은 공주를 처음 찾는 가족에게 하루 코스를 설명하는 안내자입니다. 한국어로 씁니다.

규칙:
- 아래 목록의 장소와 시각만 씁니다. 목록에 없는 장소는 쓰지 않습니다.
- 영업시간·가격·이동 수단을 단정하지 않습니다. 목록에 없는 숫자는 쓰지 않습니다.
- 과장하지 않습니다. 최고·필수·꼭 같은 표현을 쓰지 않습니다.
- 순서를 바꾸거나 다른 장소를 추천하지 않습니다.

쓸 내용:
- summary: 코스 전체를 2~3문장으로 설명합니다.
- stops: 목록의 장소마다 placeId 와 왜 가 볼 만한지 한 문장(why)을 씁니다.
- cautions: 방문 전에 확인하면 좋은 점을 단정 없이 0~2개 씁니다.

여행 시간: ${conditions.hours}시간 · 이동수단: ${mode}
코스:
${lines.join("\n")}`;
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
