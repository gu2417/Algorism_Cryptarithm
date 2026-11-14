"""발표자가 설명하며 넘길 수 있는 실제 실행 기반 장면."""


def build_presentation(problem, result):
    events = result['summary_trace']
    if not events:
        return []
    scenes = []

    def add(event, phase, title, narration, explanation, formula='', detail=''):
        scenes.append(dict(event=event, phase=phase, title=title, narration=narration,
                           explanation=explanation, formula=formula, detail=detail))

    def math(event):
        column = event['column']
        if column is None or event['carry_in'] is None:
            return None
        def digit(word):
            if column >= len(word):
                return 0
            return event['assignment'].get(word[-1-column])
        left, right = digit(problem.left), digit(problem.right)
        if left is None or right is None:
            return None
        incoming = event['carry_in']
        total = left + right + incoming
        expression = f'{left} + {right}' + (f' + {incoming}' if incoming else '')
        place = ('일','십','백','천','만')[column]+'의 자리' if column<5 else f'오른쪽 {column+1}번째 자리'
        return dict(total=total, digit=total%10, carry=total//10, place=place, formula=f'{expression} = {total}')

    add(events[0], '문제', '문자 뒤에 숨은 숫자를 찾습니다',
        '같은 문자는 같은 숫자, 다른 문자는 서로 다른 숫자입니다.',
        '위의 두 단어를 더해 아래 단어를 만드는 세로셈입니다. 같은 문자가 있는 칸들은 하나의 숫자 배정값을 공유하며, 여러 자리 수의 첫 숫자는 0이 될 수 없습니다.', problem.normalized)
    assigned = next((event for event in events if event['type']=='assign'),None)
    if assigned:
        letter,digit=assigned['check'].split('=')
        add(assigned,'배정',f'{letter}의 숫자를 정해 봅니다',
            '아직 정답을 안다는 뜻은 아닙니다. 숫자를 배정하고 조건에 맞는지 확인합니다.',
            '문자별 숫자 배정표와 사용한 숫자 집합을 함께 관리합니다. 문자를 배정하면 같은 문자가 나오는 모든 칸에 같은 값이 적용되고, 그 숫자는 다른 문자에 사용할 수 없습니다.',assigned['check'].replace('=',' = '))
    failure=next((event for event in events if event['type']=='prune' or (event['type']=='complete_check' and not event['is_solution'])),None)
    if failure:
        calculation=math(failure)
        narration=failure['reason'] or '완성된 식의 왼쪽과 오른쪽 값이 다릅니다.'
        formula=failure['check'] or ''
        if failure['type']=='complete_check':
            formula=formula.replace(' = ',' ≠ ')
        if calculation:
            column=failure['column']
            letter=problem.result[-1-column] if column<len(problem.result) else None
            value=failure['assignment'].get(letter)
            formula=calculation['formula']
            if letter and value is not None and value!=calculation['digit']:
                narration=f"{calculation['place']} 계산 결과({calculation['digit']})와 {letter}의 배정값({value})이 달라 이 후보를 제외합니다."
        add(failure,'제외','맞지 않는 후보를 제외합니다',narration,
            '숫자 중복·선행 0·현재 자리의 결과 조건을 검사합니다. 조건을 어긴 분기는 더 높은 자리로 진행하지 않고 이전 선택으로 돌아갑니다.' if result['algorithm']=='backtracking' else '모든 문자에 서로 다른 숫자를 배정한 뒤 두 피연산자의 합과 결과 값을 비교합니다. 전체 식이 맞지 않으면 다른 배정을 검사합니다.',formula)
        undo=next((event for event in events if event['type']=='backtrack' and event['seq']>failure['seq']),None)
        if undo:
            letters=', '.join(undo['undo'])
            add(undo,'복귀','이전 선택으로 되돌아갑니다',f'{letters}의 숫자 배정을 해제하고 다른 선택을 이어갑니다.',
                '재귀 호출에서 새로 배정했던 문자를 해제하고 해당 숫자를 다시 사용할 수 있게 합니다. 상위 호출의 배정은 유지한 채 다음 후보를 시도합니다.')
            if result['solutions']:
                mapping=result['solutions'][0]['mapping']
                retry=next((event for event in events if event['type']=='assign' and event['seq']>undo['seq'] and all(mapping.get(c)==value for c,value in event['assignment'].items())),None)
                if retry:
                    letter,digit=retry['check'].split('=')
                    add(retry,'재시도','다른 숫자로 다시 시도합니다',f'다른 후보들을 더 검사한 뒤, {letter} = {digit}인 후보를 확인합니다.',
                        '이전 후보의 상태를 정리한 뒤 다음 사용 가능한 숫자를 선택하고 같은 검사를 반복합니다. 이 장면은 중간 후보들을 생략한 실제 재시도 상태입니다.',retry['check'].replace('=',' = '))
    solution=next((event for event in events if event['type']=='solution'),None)
    if solution and result['algorithm']=='backtracking':
        mapping=result['solutions'][0]['mapping']
        calculations=[event for event in events if event['type']=='carry_check' and
                      all(mapping.get(letter)==value for letter,value in event['assignment'].items())]
        # 첫 자리, 올림이 이어지는 자리, 가장 높은 자리의 세 장면을 선택한다.
        selected=[]
        if calculations:
            selected=[calculations[0]]
            middle=next((event for event in calculations[1:-1] if event['carry_in']),None)
            if middle is not None:
                selected.append(middle)
            if calculations[-1] not in selected:
                selected.append(calculations[-1])
        for event in selected:
            event=next((following for following in events if following['seq']==event['seq']+1 and following['type']=='assign' and following['column']==event['column']),event)
            calculation=math(event)
            if not calculation:
                continue
            add(event,'자리 계산',f"{calculation['place']}부터 확인합니다",
                f"결과 숫자는 {calculation['digit']}, 다음 자리로 넘길 올림은 {calculation['carry']}입니다." if calculation['carry'] else f"결과 숫자는 {calculation['digit']}입니다. 다음 자리로 넘길 올림은 없습니다.",
                f"현재 자리의 합을 10으로 나눈 나머지({calculation['digit']})는 결과 칸에 들어가고, 몫({calculation['carry']})은 왼쪽 자리의 입력 올림으로 전달됩니다. 이 값으로 다음 자리에서 가능한 배정을 제한합니다.",
                calculation['formula'],f"결과 숫자 {calculation['digit']} · 다음 자리 올림 {calculation['carry']}")
    if solution:
        add(solution,'정답','모든 자리의 조건이 맞았습니다' if result['algorithm']=='backtracking' else '전체 덧셈식이 성립합니다',
            '이 숫자 배정은 전체 덧셈식도 만족합니다.',
            '모든 자리의 계산과 마지막 올림, 문자별 일대일 배정, 선행 0 조건을 확인하고 전체 덧셈식도 검증한 상태입니다. 다른 해가 있는지 확인하기 위해 탐색은 계속될 수 있습니다.' if result['algorithm']=='backtracking' else '일대일 숫자 배정과 선행 0 조건을 지킨 완성 배정에서 전체 식의 두 피연산자 합과 결과 값을 비교해 일치함을 확인했습니다. 자리별 중간 검사로 후보를 줄이는 과정은 수행하지 않습니다.',result['solutions'][0]['numeric_expression'])
    last=events[-1]
    if result['status']=='complete':
        title='탐색을 모두 마쳤습니다' if result['solutions'] else '조건을 만족하는 배정이 없습니다'
        add(last,'마무리',title,f"이 실행에서 확인한 정답은 {result['solutions_found']}개입니다.",
            '오른쪽 자리부터 제약을 검사하며 가능한 분기만 이어갔습니다. 남은 후보 검사까지 모두 끝났으므로 표시된 해의 개수가 전체 개수입니다.' if result['algorithm']=='backtracking' else '허용되는 전체 숫자 배정을 열거하고 완성된 식을 검사했습니다. 남은 후보가 없으므로 표시된 해의 개수가 전체 개수입니다.',
            result['solutions'][0]['numeric_expression'] if result['solutions'] else '정답 없음',
            f"완성 배정 검사 {result['statistics']['complete_assignments_checked']:,}회")
    else:
        add(last,'중단','이번 탐색은 여기까지 진행했습니다',
            '시간 또는 해 개수 제한에 도달해 전체 후보를 모두 확인하지 못했습니다.',
            '시간 또는 해 개수 제한이 탐색을 중단한 상태입니다. 지금까지 찾은 해와 통계만 보존되므로 전체 해의 개수나 해가 없다는 결론은 확정할 수 없습니다.',
            result['solutions'][0]['numeric_expression'] if result['solutions'] else '전체 탐색 미완료')
    return sorted(scenes,key=lambda scene:scene['event']['seq'])
