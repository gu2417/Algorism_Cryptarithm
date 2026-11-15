from Core.model import Problem


def is_solution(problem: Problem, assignment: dict[str, int]) -> bool:
    if set(assignment) != set(problem.letters):
        return False
    values = list(assignment.values())
    if any(type(value) is not int or not 0 <= value <= 9 for value in values):
        return False
    if len(set(values)) != len(values) or any(assignment[letter] == 0 for letter in problem.leading):
        return False

    def number(word: str) -> int:
        return int(''.join(str(assignment[letter]) for letter in word))

    return number(problem.left) + number(problem.right) == number(problem.result)
