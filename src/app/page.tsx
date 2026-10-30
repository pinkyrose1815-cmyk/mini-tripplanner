import { getPlaces } from "@/lib/places";
import ConditionsForm from "./ConditionsForm";

// S01 조건 고르기 — docs/SCREENS.md
export default function ConditionsPage() {
  const placeCount = getPlaces().length;

  return (
    <>
      {/* S01-① */}
      <h1>미니 트립플래너 · 공주 {placeCount}곳</h1>
      <ConditionsForm />
    </>
  );
}
