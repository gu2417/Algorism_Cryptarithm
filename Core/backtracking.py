from collections.abc import Callable

from Core.constraints import is_solution
from Core.model import Problem


def solve(problem: Problem, emit: Callable[[dict], None] | None = None, control=None) -> list[dict[str, int]]:
    assignment: dict[str, int] = {}
    used: set[int] = set()
    solutions: list[dict[str, int]] = []
    width = max(map(len, (problem.left, problem.right, problem.result)))
    seq = 0

    def event(kind, depth, column=None, carry_in=None, carry_out=None, check=None, reason=None, undo=(), is_solution_event=False):
        nonlocal seq
        if emit is not None:
            emit({'seq': seq, 'type': kind, 'depth': depth, 'assignment': assignment.copy(),
                  'column': column, 'carry_in': carry_in, 'carry_out': carry_out,
                  'check': check, 'reason': reason, 'undo': list(undo), 'is_solution': is_solution_event})
            seq += 1

    def char_at(word, column):
        return word[-column - 1] if column < len(word) else None

    def visit(column, carry):
        if control:
            control.check()
        if column == width:
            if control and carry == 0:
                control.complete_assignments_checked += 1
            if carry == 0 and is_solution(problem, assignment):
                solutions.append(assignment.copy())
                event('solution', column, is_solution_event=True)
                if control:
                    control.found(assignment)
            elif carry:
                if control:
                    control.prunes += 1
                event('conflict', column, reason='마지막 자리올림이 남았습니다.')
                event('prune', column, reason='마지막 자리올림이 남았습니다.')
            return
        left = char_at(problem.left, column)
        right = char_at(problem.right, column)
        result = char_at(problem.result, column)
        pending = list(dict.fromkeys(c for c in (left, right) if c is not None and c not in assignment))

        def assign_operands(index):
            if index < len(pending):
                letter = pending[index]
                for digit in range(10):
                    if control:
                        control.check()
                        if digit not in used:
                            control.assignment_attempts += 1
                    event('candidate', column, column, carry, check=f'{letter}={digit}')
                    if digit in used or (digit == 0 and letter in problem.leading):
                        reason = '이미 사용한 숫자입니다.' if digit in used else '여러 자리 수의 첫 자리는 0이 될 수 없습니다.'
                        if control and digit not in used:
                            control.prunes += 1
                        event('conflict', column, column, carry, reason=reason)
                        event('prune', column, column, carry, reason=reason)
                        continue
                    assignment[letter] = digit
                    used.add(digit)
                    event('assign', column, column, carry, check=f'{letter}={digit}')
                    assign_operands(index + 1)
                    del assignment[letter]
                    used.remove(digit)
                    event('backtrack', column, column, carry, undo=(letter,))
                return
            total = (assignment[left] if left else 0) + (assignment[right] if right else 0) + carry
            digit, outgoing = total % 10, total // 10
            event('column_calculation', column, column, carry, outgoing, check=f'{total} % 10 = {digit}')
            event('carry_check', column, column, carry, outgoing, check=f'{total} // 10 = {outgoing}')
            if result is None:
                valid = digit == 0
                newly_assigned = False
            elif result in assignment:
                valid = assignment[result] == digit
                newly_assigned = False
            else:
                if control:
                    control.check()
                    if digit not in used:
                        control.assignment_attempts += 1
                valid = digit not in used and not (digit == 0 and result in problem.leading)
                newly_assigned = valid
            if not valid:
                if control:
                    control.prunes += 1
                reason = '결과 자리의 숫자 또는 배정 제약이 일치하지 않습니다.'
                event('conflict', column, column, carry, outgoing, reason=reason)
                event('prune', column, column, carry, outgoing, reason=reason)
                return
            if newly_assigned:
                assignment[result] = digit
                used.add(digit)
                event('assign', column, column, carry, outgoing, check=f'{result}={digit}')
            visit(column + 1, outgoing)
            if newly_assigned:
                del assignment[result]
                used.remove(digit)
                event('backtrack', column, column, carry, outgoing, undo=(result,))

        assign_operands(0)

    event('start', 0)
    visit(0, 0)
    event('finish', 0)
    return solutions
