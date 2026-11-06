import Anthropic from "@anthropic-ai/sdk";
import type { Conditions } from "./conditions";
import type { PlanStop } from "./planner";

// S02-⑤ AI 코스 설명 — 서버 라우트(/api/narrate)에서만 쓴다.
// 실패해도 예외를 던지지 않고 { value, reason } 으로 돌려준다 (CLAUDE.md 규칙 4).

const MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 8000;

// null = AI 설명 성공 · 그 밖은 기본 설명을 보여 준 이유
export type NarrateReason = "no_key" | "timeout" | "rate_limited" | "ai_error" | "refused" | "empty_course";

export type Narration = { value: string; reason: NarrateReason | null };

const SYSTEM = `당신은 공주를 처음 찾는 가족에게 하루 여행 코스를 소개하는 안내자입니다.
주어진 코스 목록만 보고 한국어로 3~4문장의 짧은 소개글을 씁니다.
- 목록에 있는 장소만, 목록 순서대로 언급합니다. 목록에 없는 장소는 쓰지 않습니다.
- 영업시간·가격·역사적 사실·거리처럼 목록에 없는 정보는 지어내지 않습니다.
- 시각은 목록에 적힌 값만 씁니다.
- 제목·목록·이모지 없이 문장만 씁니다.`;

// AI 없이 만드는 기본 설명
export function basicNarration(conditions: Conditions, stops: PlanStop[]): string {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const meals = stops.filter((s) => s.meal).map((s) => `${s.arrive}에 ${s.name}`);
  return [
    `${first.name}에서 시작해 ${stops.length}곳을 둘러보는 ${conditions.hours}시간 코스예요.`,
    meals.length > 0 ? `식사는 ${meals.join(", ")}에서 해요.` : "",
    `마지막으로 ${last.name}에 들렀다가 ${last.depart}에 일정을 마쳐요.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function courseText(conditions: Conditions, stops: PlanStop[]): string {
  const mode = conditions.mode === "car" ? "자가용" : "도보·대중교통";
  const lines = stops.map(
    (s, i) => `${i + 1}. ${s.arrive}~${s.depart} ${s.name}${s.meal ? " (식사)" : ""}`,
  );
  return `이동수단: ${mode} · 여행 시간: ${conditions.hours}시간\n코스:\n${lines.join("\n")}`;
}

export async function narrate(
  conditions: Conditions,
  stops: PlanStop[],
  { timeoutMs = TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Narration> {
  if (stops.length === 0) return { value: "", reason: "empty_course" };
  const fallback = (reason: NarrateReason): Narration => ({ value: basicNarration(conditions, stops), reason });

  // 키는 .env.local 에서만 읽는다 (CLAUDE.md 규칙 3)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback("no_key");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 2000,
        output_config: { effort: "low" }, // 짧은 소개글이라 깊게 생각할 필요가 없다
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // 거절되면 서버가 다른 모델로 다시 시도
        system: SYSTEM,
        messages: [{ role: "user", content: courseText(conditions, stops) }],
      },
      { timeout: timeoutMs, maxRetries: 0 },
    );

    if (response.stop_reason === "refusal") return fallback("refused");
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return text ? { value: text, reason: null } : fallback("ai_error");
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) return fallback("timeout");
    if (error instanceof Anthropic.RateLimitError) return fallback("rate_limited");
    // 원인은 서버 로그에만 남긴다 — 키나 오류 내용은 응답에 넣지 않는다
    console.error("[narrate]", error instanceof Anthropic.APIError ? `${error.status} ${error.name}` : error);
    return fallback("ai_error");
  }
}
