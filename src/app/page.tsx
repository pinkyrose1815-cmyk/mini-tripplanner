import Image from "next/image";
import { getPlaces } from "@/lib/places";
import ConditionsForm from "./ConditionsForm";
import headerImage from "../../public/images/header-gongsanseong.png";

// S01 조건 고르기 — docs/SCREENS.md
export default function ConditionsPage() {
  const placeCount = getPlaces().length;

  return (
    <>
      {/* S01-① · 배경은 AI로 만든 그림이라 실제 사진으로 오해하지 않게 표시한다 */}
      <header className="hero">
        <Image
          src={headerImage}
          alt="AI로 만든 공산성 풍경 그림"
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="hero-image"
        />
        <h1>미니 트립플래너 · 공주 {placeCount}곳</h1>
        <small className="hero-credit">AI로 만든 이미지</small>
      </header>
      <ConditionsForm />
    </>
  );
}
