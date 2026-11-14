# 04. 파일 구조

현재 구현 구조다. 초기 제안의 Common 및 Kit 파일을 별도로 만들지 않고, 작은 프로젝트의 공통 설정과 UI 기능을 아래 파일에서 관리한다.

```text
app.py                         Flask 생성·설정·로컬 실행
requirements.txt               Python 의존성
package.json / package-lock.json UI 테스트 의존성
Core/
  model.py                     문제 모델
  constraints.py               배정 및 전체 정답 검증
  brute_force.py               전체 배정 열거·산술 검사·실행 이벤트
  backtracking.py              자리별 계산·올림·가지치기
Feature/
  control.py                   시간·해 제한과 공통 통계
  solve.py                     실행·기록 상한·중요 요약
  summary.py                   연속 장면 요약·장면 구간 설명
  presentation.py              실제 이벤트 기반 발표 장면·계산 설명
  trace_store.py               전체 기록의 임시 토큰 조회
  trace_archive.py             실제 실행 기록 복원·전체 구간 조회
Module/
  validation.py                입력 검증·파싱
  routes.py                    풀이 및 기록 조회 HTTP API
templates/index.html           시뮬레이터 화면
static/css/style.css           일반·비교·발표·모바일 배치
static/js/app.js                API·결과·독립 재생/재풀이·발표 모드
tests/                         Python 및 DOM 통합 테스트
docs/                          01~07 주제별 문서 폴더
```

의존성은 Module → Feature → Core다. Core는 Flask와 브라우저를 참조하지 않고 선택적 이벤트 콜백을 사용한다. 임시 기록 조회는 앱 인스턴스별 저장소에 연결된다. 프론트엔드는 HTTP를 통해 결과를 받으며 정답 풀이 로직을 중복하지 않는다.

[아키텍처](../03-architecture/README.md) · [할 일](../07-todo-list/README.md)
