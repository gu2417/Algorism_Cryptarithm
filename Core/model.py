from dataclasses import dataclass


@dataclass(frozen=True)
class Problem:
    left: str
    right: str
    result: str
    original: str
    normalized: str
    letters: tuple[str, ...]
    leading: frozenset[str]
