import time


class SearchStopped(Exception):
    pass


class SearchControl:
    def __init__(self, time_limit, solution_limit):
        self.started = time.monotonic()
        self.deadline = self.started + time_limit
        self.solution_limit = solution_limit
        self.status = 'complete'
        self.solutions = []
        self.assignment_attempts = 0
        self.complete_assignments_checked = 0
        self.prunes = 0

    def check(self):
        if time.monotonic() >= self.deadline:
            self.status = 'time_limit'
            raise SearchStopped()

    def found(self, assignment):
        self.solutions.append(assignment.copy())
        if len(self.solutions) >= self.solution_limit:
            self.status = 'solution_limit'
            raise SearchStopped()
