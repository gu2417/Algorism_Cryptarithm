# 04. 파일 구조

## 확인된 현재 구조

조사 시 저장소에는 `docs`의 일곱 문서만 있었고 Python, Flask, 프론트엔드, 테스트 코드 및 아래 다섯 영역은 없었다. 기존 문서의 미정 항목을 지시서에 맞게 구체화했으며 이 문서의 구조는 **구현 제안**이다. 문서를 번호별 폴더로 옮긴 현재 구조는 아래와 같다.

```text
docs/
├── 01-overview/README.md
├── 02-features/README.md
├── 03-architecture/README.md
├── 04-file-structure/README.md
├── 05-database/README.md
├── 06-uiux/README.md
└── 07-todo-list/README.md
```

## 제안하는 구현 구조

```text
project/
├── app.py                       # Flask 앱 생성 및 로컬 진입점
├── requirements.txt             # Flask 의존성
├── Core/
│   ├── model.py                 # 파싱된 문제·배정 상태
│   ├── constraints.py           # 선행 0, 배정, 자리 및 정답 검사
│   ├── brute_force.py           # 완전탐색
│   └── backtracking.py          # 자리별 백트래킹 및 이벤트 발생
├── Feature/
│   ├── solve.py                 # 검증된 문제의 풀이 흐름과 제한
│   ├── trace.py                 # 이벤트 수집·상한 처리
│   └── compare.py               # 두 풀이 실행과 비교용 결과
├── Common/
│   ├── config.py                # 시간·기록·해·입력 길이 상한
│   └── errors.py                # 공통 오류 코드와 예외
├── Module/
│   ├── routes.py                # Flask 라우트와 HTTP 변환
│   └── validation.py            # 서버 입력 검증·파싱
├── templates/index.html         # 단일 화면 템플릿
├── static/
│   ├── css/style.css            # 배치·디자인 토큰·상태 스타일
│   └── js/
│       ├── app.js               # 입력·API·화면 연결
│       └── Kit/
│           ├── visualizer.js    # 수식·자리올림·탐색 상태 렌더링
│           └── controls.js      # 재생 및 재사용 컨트롤
├── tests/                       # Core, API, 통합 테스트 (예정)
└── docs/                        # 위의 일곱 문서 폴더
```

## 의존성 방향

`Module → Feature → Core`, `Module/Feature → Common`, 브라우저 `app.js → Kit`, HTTP로 브라우저 → Module이다. Core는 Flask, 브라우저, Feature를 참조하지 않는다. 백트래킹은 구체적인 기록 저장소에 의존하지 않고 선택적 이벤트 콜백을 호출하며 Feature가 수집한다. 서비스 연결 및 Flask 앱 초기화는 Module과 `app.py`에서 처리한다. 작은 기능은 역할이 명확한 기존 파일에 두고 불필요한 계층이나 파일을 추가하지 않는다.

[아키텍처](../03-architecture/README.md) · [할 일](../07-todo-list/README.md)
