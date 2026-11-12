from itertools import permutations

from Core.constraints import is_solution
from Core.model import Problem


def solve(problem: Problem) -> list[dict[str, int]]:
    solutions = []
    for digits in permutations(range(10), len(problem.letters)):
        assignment = dict(zip(problem.letters, digits))
        if any(assignment[letter] == 0 for letter in problem.leading):
            continue
        if is_solution(problem, assignment):
            solutions.append(assignment)
    return solutions
