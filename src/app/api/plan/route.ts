import { NextResponse, type NextRequest } from "next/server";
import { parseConditions } from "@/lib/conditions";
import { makePlan } from "@/lib/planner";

// GET /api/plan?mode=car&hours=6&themes=history,food
// → { conditions, stops, reasons } · 코스가 없으면 stops: [] (S02 빈 결과 상태)
export function GET(request: NextRequest) {
  const conditions = parseConditions(request.nextUrl.searchParams);
  if (!conditions) {
    return NextResponse.json({ error: "invalid_conditions" }, { status: 400 });
  }

  const { stops, reasons } = makePlan(conditions);
  return NextResponse.json({ conditions, stops, reasons });
}
