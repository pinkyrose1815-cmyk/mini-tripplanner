# CLAUDE.md — 미니 트립플래너 규칙 (기준선)
1. 장소는 data/places.json 의 id만 쓴다. 장소명을 지어내거나 하드코딩하지 않는다.
2. 거리·시간 계산은 src/lib/routing.ts 에서만 한다.
3. API 키는 .env.local 에만 두고 서버 라우트에서만 읽는다.
4. AI 호출 실패는 예외 대신 { value, reason } 으로 돌려주고 화면에 배지로 표시한다.
5. 한 번에 한 기능만. 코드 전에 변경 계획을 먼저 보여 준다.

## 먼저 읽을 문서
- docs/PLAN.md — 무엇을 · 누구를 위해 · 무엇은 안 하는지
- docs/SCREENS.md — 화면 S01·S02, 요소 번호(S01-① …)와 상태 4가지
