# Core 구현 계획

**목표:** 직접 입력한 덧셈 복면산을 검증하고 완전탐색과 자리별 백트래킹으로 풀며 결과를 독립적으로 검증한다.

**근거:** [기능](../02-features/README.md), [아키텍처](../03-architecture/README.md). Flask와 UI에 의존하지 않는 Python 표준 라이브러리 구현이다.

1. `Module/validation.py`와 `Core/model.py`: 실패하는 입력 테스트를 먼저 작성한 뒤 정규화, 문법 및 오류 코드를 구현한다.
2. `Core/constraints.py`: 숫자 중복, 범위, 선행 0, 산식 검증 테스트와 구현을 추가한다.
3. `Core/brute_force.py`, `Core/backtracking.py`: 해 없음, 다중 해, 반복 문자, 올림, 두 알고리즘 해 일치를 테스트하고 구현한다. 백트래킹은 독립적인 선택적 이벤트 콜백을 제공한다.
4. 전체 `python -m unittest discover -s tests -v`를 실행하고 문서에 기재된 입력과 실제 결과를 교차 검증한다.

시간·해·기록 제한 및 API는 후속 Feature 단계다. Core는 완전 탐색 결과를 반환하며 호출자 제어를 위한 중단 기능은 해당 단계에서 검증하며 추가한다.
