import re

from Core.model import Problem


class InputError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def parse_expression(expression: str) -> Problem:
    if not isinstance(expression, str):
        raise InputError('INVALID_FORMAT', '수식은 문자열이어야 합니다.')
    if len(expression) > 128:
        raise InputError('TOO_LONG', '수식은 128자 이하여야 합니다.')
    if not expression.strip():
        raise InputError('EMPTY_INPUT', '수식을 입력해 주세요.')
    match = re.fullmatch(r'\s*([A-Za-z]+)\s*\+\s*([A-Za-z]+)\s*=\s*([A-Za-z]+)\s*', expression, flags=re.ASCII)
    if not match:
        raise InputError('INVALID_FORMAT', '영문 단어 두 개를 더하는 WORD + WORD = WORD 형식으로 입력해 주세요.')
    left, right, result = (part.upper() for part in match.groups())
    letters = tuple(dict.fromkeys(left + right + result))
    if len(letters) > 10:
        raise InputError('TOO_MANY_LETTERS', '서로 다른 문자는 최대 10개까지 사용할 수 있습니다.')
    leading = frozenset(word[0] for word in (left, right, result) if len(word) > 1)
    return Problem(left, right, result, expression, f'{left} + {right} = {result}', letters, leading)
