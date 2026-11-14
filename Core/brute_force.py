from Core.model import Problem


def solve(problem: Problem, control=None, emit=None) -> list[dict[str, int]]:
    solutions = []
    assignment = {}
    used = set()
    seq = 0
    # 결과 단어를 먼저 배정해도 모든 유효 배정은 그대로 탐색한다.
    letters = tuple(dict.fromkeys(problem.result + problem.left + problem.right))
    weights = {letter: sum(sign * 10 ** place
                          for word, sign in ((problem.left, 1), (problem.right, 1), (problem.result, -1))
                          for place, char in enumerate(reversed(word)) if char == letter)
               for letter in letters}

    def event(kind, depth, check=None, reason=None, undo=(), is_solution_event=False):
        nonlocal seq
        if emit is not None:
            if not getattr(emit, 'capture', True) and kind not in ('solution', 'finish', 'prune'):
                seq += 1
                return
            emit({'seq': seq, 'type': kind, 'depth': depth, 'assignment': assignment.copy(),
                  'column': None, 'carry_in': None, 'carry_out': None,
                  'check': check, 'reason': reason, 'undo': list(undo),
                  'is_solution': is_solution_event})
            seq += 1

    def finish_subtree(index, balance):
        """상한 이후에도 동일한 DFS를 실행하며 저장할 필요 없는 스냅샷 생성만 생략한다."""
        nonlocal seq
        digits = [assignment.get(letter, 0) for letter in letters]
        coefficients = [weights[letter] for letter in letters]
        leading = [letter in problem.leading for letter in letters]
        attempts = checks = prunes = 0

        def fast_visit(position, used_mask, total):
            nonlocal seq, attempts, checks, prunes
            if control and position <= 3:
                control.check()
            if position == len(letters):
                checks += 1
                seq += 1  # 실제 전체 식 검사
                if total == 0:
                    mapping = dict(zip(letters, digits))
                    solutions.append(mapping)
                    previous = assignment.copy()
                    assignment.update(mapping)
                    event('solution', position, is_solution_event=True)
                    assignment.clear()
                    assignment.update(previous)
                    if control:
                        control.found(mapping)
                return
            for digit in range(10):
                bit = 1 << digit
                if used_mask & bit:
                    continue
                attempts += 1
                seq += 1  # 후보 선택
                if digit == 0 and leading[position]:
                    prunes += 1
                    seq += 1
                    continue
                digits[position] = digit
                seq += 1  # 배정
                fast_visit(position + 1, used_mask | bit, total + coefficients[position] * digit)
                seq += 1  # 복귀

        try:
            fast_visit(index, sum(1 << digit for digit in used), balance)
        finally:
            if control:
                control.assignment_attempts += attempts
                control.complete_assignments_checked += checks
                control.prunes += prunes

    def visit(index, balance):
        nonlocal seq
        if emit is not None and not getattr(emit, 'capture', True):
            finish_subtree(index, balance)
            return
        if control and index <= 3:
            control.check()
        if index == len(letters):
            if control:
                control.complete_assignments_checked += 1
            valid = balance == 0
            if emit is not None and getattr(emit, 'capture', True):
                def number(word):
                    return ''.join(str(assignment[letter]) for letter in word)
                equation = f'{number(problem.left)} + {number(problem.right)} = {number(problem.result)}'
                event('complete_check', index, check=equation, is_solution_event=valid,
                      reason='전체 식이 성립합니다.' if valid else '전체 식이 성립하지 않습니다.')
            elif emit is not None:
                seq += 1
            if valid:
                solutions.append(assignment.copy())
                event('solution', index, is_solution_event=True)
                if control:
                    control.found(assignment)
            return
        letter = letters[index]
        for digit in range(10):
            if digit in used:
                continue
            if control:
                control.assignment_attempts += 1
            capture = emit is not None and getattr(emit, 'capture', True)
            if capture:
                event('candidate', index, check=f'{letter}={digit}')
            elif emit is not None:
                seq += 1
            if digit == 0 and letter in problem.leading:
                if control:
                    control.prunes += 1
                event('prune', index, reason='여러 자리 수의 첫 자리는 0이 될 수 없습니다.')
                continue
            assignment[letter] = digit
            used.add(digit)
            if capture:
                event('assign', index, check=f'{letter}={digit}')
            elif emit is not None:
                seq += 1
            visit(index + 1, balance + weights[letter] * digit)
            used.remove(digit)
            del assignment[letter]
            if emit is not None and getattr(emit, 'capture', True):
                event('backtrack', index, undo=(letter,))
            elif emit is not None:
                seq += 1

    event('start', 0)
    try:
        visit(0, 0)
    finally:
        if emit is not None and hasattr(emit, 'capture'):
            emit.events_seen = seq
    if control:
        control.check()
    event('finish', 0)
    if emit is not None and hasattr(emit, 'capture'):
        emit.events_seen = seq
    return solutions
