# 복면산 탐구실

알고리즘 13반 기말발표 주제 **B04 복면산**을 위한 교육용 웹 시뮬레이터입니다. 영문 수식을 입력하면 완전탐색 또는 백트래킹으로 해를 찾고, 실제 숫자 배정과 탐색 과정을 단계별로 보여 줍니다.

## 주요 기능

- `I + BB = ILL`, `SEND + MORE = MONEY` 같은 수식을 직접 입력하거나 예제를 선택합니다.
- 완전탐색은 숫자를 배정한 뒤 전체 수식을 검사합니다. 백트래킹은 오른쪽 자리부터 검사하며 불가능한 후보를 제외합니다.
- 탐색 기록을 자동 재생하거나 이전·다음 단계로 이동하고, 속도를 조절할 수 있습니다. 비교 모드에서는 두 알고리즘의 기록을 선택합니다.
- 문자별 숫자 배정, 해의 개수, 배정 시도·검사·가지치기 횟수와 실행 시간을 확인합니다.

## 입력 규칙

초기 버전은 `WORD + WORD = WORD` 형태의 **영문 단어 두 개를 더하는 수식**을 지원합니다. 소문자는 대문자로 변환되며 연산자 주변 공백은 허용됩니다. 서로 다른 문자는 최대 10개이고, 같은 문자는 같은 숫자, 다른 문자는 다른 숫자에 대응합니다. 여러 자리 단어의 첫 문자에는 0을 배정할 수 없습니다. 입력은 최대 128자입니다.

뺄셈·곱셈·나눗셈과 세 개 이상의 피연산자는 지원하지 않습니다. 데이터베이스, 사용자 계정과 외부 API는 사용하지 않습니다.

## 로컬 실행

Windows에서 Python 3.10 이상과 Git이 필요합니다. PowerShell에서 다음 명령을 실행하세요.

```powershell
git clone https://github.com/gu2417/Algorism_Cryptarithm.git
cd Algorism_Cryptarithm
git switch develop
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

브라우저에서 [http://127.0.0.1:5000](http://127.0.0.1:5000)을 엽니다. 서버를 종료하려면 실행 중인 터미널에서 `Ctrl+C`를 누릅니다. 5000번 포트가 이미 사용 중이라면 다른 포트로 실행할 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m flask --app app run --host 127.0.0.1 --port 5001
```

이 경우 [http://127.0.0.1:5001](http://127.0.0.1:5001)에 접속합니다. 가상환경이 이미 있다면 생성 단계를 건너뛸 수 있습니다.

## 사용 방법

1. 수식을 입력하거나 예제 버튼을 누릅니다.
2. 백트래킹, 완전탐색 또는 두 알고리즘 비교를 선택하고 **풀이 시작**을 누릅니다.
3. 탐색 기록의 재생 버튼과 이전·다음 버튼으로 실제 실행 단계를 살펴봅니다. 비교 모드에서는 재생할 알고리즘을 선택할 수 있습니다.
4. 결과 영역에서 숫자 계산식과 문자별 배정, 탐색 통계를 확인합니다. 반환된 해가 여러 개라면 목록에서 선택할 수 있습니다.

기본 제한은 알고리즘별 **5초, 반환 해 100개, 기록 10,000개**입니다. 시간 또는 해 개수 제한으로 중단되면 표시된 해의 개수는 전체 개수가 아닌 하한입니다. 기록이 잘리더라도 계산은 계속될 수 있으며, 재생은 저장된 앞부분만 가능합니다. 실행 시간에는 기록 생성 비용이 포함됩니다.

## 테스트

Python 의존성을 설치한 뒤 다음 명령으로 Core와 API 테스트를 실행합니다.

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

UI의 DOM 통합 테스트에는 Node.js 18 이상과 npm이 추가로 필요합니다.

```powershell
npm ci
npm test
```

PowerShell에서 `npm` 스크립트 실행이 차단된다면 `npm.cmd ci`, `npm.cmd test`를 사용할 수 있습니다.

## 프로젝트 구조

| 경로 | 역할 |
|---|---|
| `Core/` | 수식 모델, 제약 조건과 탐색 알고리즘 |
| `Feature/` | 풀이 실행, 탐색 기록 및 제한 관리 |
| `Module/` | 입력 검증과 Flask API |
| `templates/`, `static/` | 웹 화면과 스타일, 재생 기능 |
| `tests/` | Python 및 UI 테스트 |
| `docs/` | 요구사항, 설계, 검증과 작업 계획 |

## 문서

- [프로젝트 개요](docs/01-overview/README.md)
- [기능 요구사항](docs/02-features/README.md)
- [아키텍처와 API](docs/03-architecture/README.md)
- [파일 구조](docs/04-file-structure/README.md)
- [데이터 관리](docs/05-database/README.md)
- [UI/UX 설계](docs/06-uiux/README.md)
- [할 일 목록과 검증 보고서](docs/07-todo-list/README.md)

개발은 구윤찬, 발표자료와 영상 제작은 송준영이 담당합니다.
