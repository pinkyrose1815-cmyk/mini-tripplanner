"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MODES, THEMES } from "@/lib/conditions";
import type { PlanReason, PlanResponse } from "@/lib/planner";

// S02 ①~⑥ · 상태 4가지 — docs/SCREENS.md. 순서·시각은 /api/plan 그대로 보여 주고 화면에서 계산하지 않는다.

// Leaflet은 브라우저에서만 동작하므로 화면을 그린 뒤에 불러온다
const CourseMap = dynamic(() => import("./CourseMap"), {
  ssr: false,
  loading: () => <div className="map-slot">지도를 불러오는 중…</div>,
});

const REASON_TEXT: Record<PlanReason, string> = {
  travel_estimated: "이동 시간은 추정값이에요",
  hours_defaulted: "영업시간을 확인해 주세요",
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; plan: PlanResponse }
  | { kind: "invalid" } // 주소의 조건이 잘못됨 (400) — 다시 시도해도 같다
  | { kind: "error" };

export default function CourseView({ query }: { query: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/plan?${query}`)
      .then(async (res): Promise<State> => {
        if (res.status === 400) return { kind: "invalid" };
        if (!res.ok) throw new Error(String(res.status));
        return { kind: "ready", plan: (await res.json()) as PlanResponse };
      })
      .then((next) => !cancelled && setState(next))
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [query, attempt]);

  const backButton = (
    // S02-⑥ · 불러오는 동안은 잠시 꺼 둔다
    <button
      type="button"
      className="primary"
      disabled={state.kind === "loading"}
      onClick={() => router.push("/")}
    >
      조건 다시 고르기
    </button>
  );

  if (state.kind === "loading") {
    return (
      <>
        <p className="status" aria-live="polite">코스를 만들고 있어요…</p>
        {backButton}
      </>
    );
  }

  if (state.kind === "invalid") {
    return (
      <>
        <p className="status" role="alert">조건이 올바르지 않아요 — 조건을 다시 골라 주세요</p>
        {backButton}
      </>
    );
  }

  if (state.kind === "error") {
    return (
      <>
        <p className="status" role="alert">잠시 후 다시 시도해 주세요</p>
        <button type="button" className="secondary" onClick={() => setAttempt((n) => n + 1)}>
          다시 시도
        </button>
        {backButton}
      </>
    );
  }

  const { conditions, stops, reasons } = state.plan;

  if (stops.length === 0) {
    return (
      <>
        <p className="status">맞는 코스가 없어요 — 여행 시간을 늘리거나 조건을 바꿔 보세요</p>
        {backButton}
      </>
    );
  }

  const chips = [
    MODES.find((m) => m.value === conditions.mode)?.label,
    `${conditions.hours}시간`,
    ...(conditions.themes.length
      ? THEMES.filter((t) => conditions.themes.includes(t.value)).map((t) => t.label)
      : ["모든 테마"]),
    `${stops.length}곳`,
  ];

  return (
    <>
      {/* S02-① */}
      <ul className="summary">
        {chips.map((chip) => (
          <li key={chip}>{chip}</li>
        ))}
      </ul>

      {/* S02-② */}
      {reasons.length > 0 && (
        <p className="notice">
          <strong>알아 두세요</strong> · {reasons.map((r) => REASON_TEXT[r]).join(" · ")}
        </p>
      )}

      {/* S02-③ */}
      <CourseMap stops={stops} />

      {/* S02-④ */}
      <ol className="timetable">
        {stops.map((stop, i) => (
          <li key={stop.id}>
            {i > 0 && <p className="travel">이동 {stop.travelMin}분(추정)</p>}
            <div className="stop">
              <span className="stop-no">{i + 1}</span>
              <span className="stop-time">
                {stop.arrive}~{stop.depart}
              </span>
              <span className="stop-name">
                {stop.name}
                {stop.meal && <em className="meal">식사</em>}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* S02-⑤ 3회차 */}
      <div className="placeholder">AI 설명은 3회차에</div>

      {backButton}
    </>
  );
}
