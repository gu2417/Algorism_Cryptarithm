from Core.constraints import is_solution
from Core.model import Problem


def solve(problem: Problem, control=None) -> list[dict[str, int]]:
    solutions = []
    assignment = {}
    used = set()

    def visit(index):
        if control:
            control.check()
        if index == len(problem.letters):
            if control:
                control.complete_assignments_checked += 1
            if is_solution(problem, assignment):
                solutions.append(assignment.copy())
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
            if digit == 0 and letter in problem.leading:
                if control:
                    control.prunes += 1
                continue
            assignment[letter] = digit
            used.add(digit)
            visit(index + 1)
            used.remove(digit)
            del assignment[letter]

    visit(0)
    return solutions
