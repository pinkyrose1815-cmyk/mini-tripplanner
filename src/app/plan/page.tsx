import CourseView from "./CourseView";

// S02 오늘의 코스 — docs/SCREENS.md. 주소의 조건을 그대로 /api/plan 에 넘긴다.
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  return (
    <>
      <h1>오늘의 코스</h1>
      <CourseView query={params.toString()} />
    </>
  );
}
