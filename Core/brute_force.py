from Core.constraints import is_solution
from Core.model import Problem


def solve(problem: Problem, control=None, emit=None) -> list[dict[str, int]]:
    solutions = []
    assignment = {}
    used = set()
    seq = 0

    def event(kind, depth, check=None, reason=None, undo=(), is_solution_event=False):
        nonlocal seq
        if emit is not None:
            emit({'seq': seq, 'type': kind, 'depth': depth, 'assignment': assignment.copy(),
                  'column': None, 'carry_in': None, 'carry_out': None,
                  'check': check, 'reason': reason, 'undo': list(undo),
                  'is_solution': is_solution_event})
            seq += 1

    def visit(index):
        if control:
            control.check()
        if index == len(problem.letters):
            if control:
                control.complete_assignments_checked += 1
            valid = is_solution(problem, assignment)
            if emit is not None:
                def number(word):
                    return ''.join(str(assignment[letter]) for letter in word)
                equation = f'{number(problem.left)} + {number(problem.right)} = {number(problem.result)}'
                event('complete_check', index, check=equation, is_solution_event=valid,
                      reason='전체 식이 성립합니다.' if valid else '전체 식이 성립하지 않습니다.')
            if valid:
                solutions.append(assignment.copy())
                event('solution', index, is_solution_event=True)
                if control:
                    control.found(assignment)
            return
        letter = problem.letters[index]
        for digit in range(10):
            if control:
                control.check()
            if digit in used:
                continue
            if control:
                control.assignment_attempts += 1
            event('candidate', index, check=f'{letter}={digit}')
            if digit == 0 and letter in problem.leading:
                if control:
                    control.prunes += 1
                event('prune', index, reason='여러 자리 수의 첫 자리는 0이 될 수 없습니다.')
                continue
            assignment[letter] = digit
            used.add(digit)
            event('assign', index, check=f'{letter}={digit}')
            visit(index + 1)
            used.remove(digit)
            del assignment[letter]
            event('backtrack', index, undo=(letter,))

    event('start', 0)
    visit(0)
    event('finish', 0)
    return solutions
