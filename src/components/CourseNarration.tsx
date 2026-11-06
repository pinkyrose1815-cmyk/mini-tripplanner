import type { Narration } from "@/lib/narration";
import type { PlanStop } from "@/lib/planner";

// S02-⑤ 상태 — null이면 불러오는 중, "failed"면 /api/narrate 자체에 닿지 못함
export type NarrationState = Narration | "failed" | null;

// S02-⑤ 코스 설명 — 표시만 한다. 장소 이름은 시간표(/api/plan)의 값을 쓴다.
export default function CourseNarration({ narration, stops }: { narration: NarrationState; stops: PlanStop[] }) {
  const loaded = narration !== null && narration !== "failed" ? narration : null;
  const fromAi = loaded?.reason === null;

  return (
    <section className="narration" aria-live="polite">
      <h2>코스 설명{loaded && (fromAi ? " · AI 작성" : " · 기본 안내")}</h2>
      {narration === null && <p className="narration-loading">설명을 쓰고 있어요…</p>}
      {narration === "failed" && <p className="narration-loading">설명을 불러오지 못했어요</p>}
      {loaded && <p>{loaded.value.summary}</p>}
      {loaded && loaded.value.stops.length > 0 && (
        <ul className="narration-stops">
          {loaded.value.stops.map((s) => (
            <li key={s.placeId}>
              <strong>{stops.find((stop) => stop.id === s.placeId)?.name}</strong> {s.why}
            </li>
          ))}
        </ul>
      )}
      {loaded && loaded.value.cautions.length > 0 && (
        <ul className="narration-cautions">
          {loaded.value.cautions.map((caution) => (
            <li key={caution}>{caution}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
