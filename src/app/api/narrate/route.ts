import { NextResponse, type NextRequest } from "next/server";
import { parseConditions } from "@/lib/conditions";
import { narrateCourse } from "@/lib/gemini";
import { makePlan } from "@/lib/planner";

// GET /api/narrate?mode=car&hours=6&themes=history,food → { value, reason }
// 브라우저가 보낸 장소 이름은 받지 않고, 조건으로 코스를 다시 만들어 그 장소만 AI에 넘긴다 (CLAUDE.md 규칙 1)
export async function GET(request: NextRequest) {
  const conditions = parseConditions(request.nextUrl.searchParams);
  if (!conditions) {
    return NextResponse.json({ value: null, reason: "invalid_conditions" }, { status: 400 });
  }

  const { stops } = makePlan(conditions);
  return NextResponse.json(await narrateCourse({ conditions, stops }));
}
