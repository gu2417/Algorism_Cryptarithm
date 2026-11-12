# 05. 데이터 관리

## DB 미사용 결정

단일 로컬 발표용 실행에는 계정이나 실행 이력의 영구 저장이 필요하지 않다. 따라서 SQL DB, ORM, 테이블과 마이그레이션을 도입하지 않는다. 사용자 계정과 세션도 사용하지 않는다. 새로고침, 재실행 또는 서버 종료 후 이전 결과를 보존하지 않는다.

## 임시 데이터와 수명

서버는 한 요청의 원문·정규화된 문제, 문자 집합, 현재 배정과 사용 숫자, 자리올림 및 재귀 상태, 해 목록, 통계와 제한된 기록을 Python 메모리에 둔다. 응답 생성 후 참조를 해제한다. 요청 간 상태를 공유하지 않는다. 브라우저는 응답, 현재 재생 인덱스, 속도 및 선택한 해를 페이지 메모리에만 보유하며 새 실행 시 기존 결과를 초기화한다. 브라우저 저장소와 서버 파일에 사용자 데이터를 영구 저장하지 않는다.

## JSON 응답 예시

아래는 형식 설명용 예시이며 실제 실행 결과가 아니다. 이벤트의 필드는 [기록 계약](../03-architecture/README.md#기록과-재생-계약)을 따른다.

```json
{
  "original_expression": "A + B = C",
  "normalized_expression": "A + B = C",
  "runs": [{
    "algorithm": "backtracking",
    "status": "solution_limit",
    "solutions": [{"mapping": {"A": 1, "B": 2, "C": 3}, "numeric_expression": "1 + 2 = 3"}],
    "solutions_found": 1,
    "statistics": {"assignment_attempts": 0, "complete_assignments_checked": 0, "prunes": 0, "elapsed_ms": 0},
    "trace": [],
    "trace_truncated": true
  }]
}
```

예시는 필드 형태만 보여 주기 위해 임의의 축약 수치를 사용한다. 실제 설정의 해 상한은 100개이며 기록과 통계는 실제 실행에서 생성한다. `status`가 `complete`가 아니면 해 개수는 하한이다. `trace_truncated`는 계산 상태와 별개다. 응답과 오류 형식, 제한의 의미는 [아키텍처](../03-architecture/README.md#flask-api-제안)를 기준으로 한다.
