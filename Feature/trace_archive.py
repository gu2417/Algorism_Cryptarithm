"""실제 실행 순서를 페이지 단위로 복원한다. 실행이 도달한 seq 밖은 노출하지 않는다."""
from functools import lru_cache
from Core import backtracking


class TraceArchive:
    def __init__(self, problem, result):
        self.problem = problem
        self.algorithm = result['algorithm']
        self.total = result['events_seen']
        self.status = result['status']
        self.prefix = result['trace']
        self.solutions = [item['mapping'] for item in result['solutions']]
        self.letters = tuple(dict.fromkeys(problem.result + problem.left + problem.right))

    @lru_cache(maxsize=2048)
    def subtree_size(self, index, mask):
        if index == len(self.letters):
            return 1
        size = 0
        for digit in range(10):
            if mask & (1 << digit):
                continue
            if digit == 0 and self.letters[index] in self.problem.leading:
                size += 2
            else:
                size += 3 + self.subtree_size(index + 1, mask | (1 << digit))
        return size

    def brute_event(self, target):
        assignment = {}
        cursor = 0

        def event(kind, depth, check=None, reason=None, undo=(), valid=False):
            return dict(seq=target, type=kind, depth=depth, assignment=assignment.copy(),
                        column=None, carry_in=None, carry_out=None, check=check,
                        reason=reason, undo=list(undo), is_solution=valid)

        if target == 0:
            return event('start', 0)
        if self.status == 'complete' and target == self.total - 1:
            return event('finish', 0)
        cursor = 1

        def visit(index, mask):
            nonlocal cursor
            if index == len(self.letters):
                valid = any(mapping == assignment for mapping in self.solutions)
                if target == cursor:
                    number = lambda word: ''.join(str(assignment[c]) for c in word)
                    equation = f'{number(self.problem.left)} + {number(self.problem.right)} = {number(self.problem.result)}'
                    return event('complete_check', index, equation,
                                 '전체 식이 성립합니다.' if valid else '전체 식이 성립하지 않습니다.', valid=valid)
                return event('solution', index, valid=True)
            letter = self.letters[index]
            for digit in range(10):
                bit = 1 << digit
                if mask & bit:
                    continue
                if target == cursor:
                    return event('candidate', index, f'{letter}={digit}')
                cursor += 1
                if digit == 0 and letter in self.problem.leading:
                    if target == cursor:
                        return event('prune', index, reason='여러 자리 수의 첫 자리는 0이 될 수 없습니다.')
                    cursor += 1
                    continue
                assignment[letter] = digit
                if target == cursor:
                    return event('assign', index, f'{letter}={digit}')
                cursor += 1
                solutions_below = sum(all(mapping[c] == value for c, value in assignment.items()) for mapping in self.solutions)
                size = self.subtree_size(index + 1, mask | bit) + solutions_below
                if target < cursor + size:
                    return visit(index + 1, mask | bit)
                cursor += size
                del assignment[letter]
                if target == cursor:
                    return event('backtrack', index, undo=(letter,))
                cursor += 1
            raise IndexError(target)

        return visit(0, 0)

    def page(self, offset, limit):
        end = min(self.total, offset + limit)
        if end <= len(self.prefix):
            return self.prefix[offset:end]
        if self.algorithm == 'brute_force':
            return [self.brute_event(seq) for seq in range(offset, end)]
        # 백트래킹도 같은 결정적 순서를 재생하되 해당 실행이 도달한 구간만 반환한다.
        events = []
        class PageReady(Exception):
            pass
        def collect(event):
            if offset <= event['seq'] < end:
                events.append(event)
            if event['seq'] + 1 >= end:
                raise PageReady()
        try:
            backtracking.solve(self.problem, emit=collect)
        except PageReady:
            pass
        return events
