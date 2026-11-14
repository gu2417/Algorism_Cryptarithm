"""서로 다른 후보의 계산을 붙이지 않고 실제 정답 경로를 요약한다."""
from collections import deque
from Core import backtracking
from Feature.trace_archive import TraceArchive


def causal(events):
    """생략 전후에도 표시된 배정이 해당 이벤트 하나로 설명되어야 한다."""
    assignment = {}
    for event in sorted(events.values(), key=lambda item:item['seq']):
        if event['type'] == 'finish':
            continue
        expected = assignment.copy()
        if event['type'] == 'assign':
            letter, digit = event['check'].split('=')
            expected[letter] = int(digit)
        elif event['type'] == 'backtrack':
            for letter in event['undo']:
                expected.pop(letter, None)
        if expected != event['assignment']:
            return False
        assignment = event['assignment']
    return True


def brute_path(archive):
    mapping = archive.solutions[0]
    selected = {0}
    assignment = {}
    mask, cursor = 0, 1
    for index, letter in enumerate(archive.letters):
        preceding_failure = None
        for digit in range(10):
            bit = 1 << digit
            if mask & bit:
                continue
            if digit == mapping[letter]:
                if index == len(archive.letters)-1 and preceding_failure is not None:
                    selected.update(range(*preceding_failure))
                selected.update((cursor,cursor+1))
                assignment[letter] = digit
                mask |= bit
                cursor += 2
                break
            if digit == 0 and letter in archive.problem.leading:
                selected.update((cursor,cursor+1))
                cursor += 2
            else:
                prefix = {**assignment,letter:digit}
                found = sum(all(solution[c] == value for c,value in prefix.items()) for solution in archive.solutions)
                size = 3 + archive.subtree_size(index+1,mask|bit) + found
                preceding_failure = (cursor,cursor+size)
                cursor += size
    selected.update((cursor,cursor+1))
    return {seq:archive.page(seq,1)[0] for seq in selected if seq < archive.total}


def backtracking_path(archive):
    active, columns = {}, {}
    recent = deque(maxlen=64)
    previous = None
    result = {}
    failure_frames = []
    failure_state = None
    failure_seq = None

    class Found(Exception):
        pass

    def collect(event):
        nonlocal previous, result, failure_state, failure_seq
        if failure_state is not None:
            if event['type']=='prune' and event['seq']==failure_seq+1:
                failure_frames.append(event)
            elif event['type']=='backtrack' and any(letter in failure_state for letter in event['undo']):
                expected={letter:value for letter,value in failure_state.items() if letter not in event['undo']}
                if event['assignment']==expected:
                    failure_frames.append(event)
                    failure_state=expected
        if event['type'] == 'assign':
            letter = event['check'].split('=')[0]
            active[letter] = [previous,event] if previous and previous['type']=='candidate' and previous['check']==event['check'] else [event]
        elif event['type'] == 'backtrack':
            for letter in event['undo']:
                active.pop(letter,None)
        elif event['type'] == 'carry_check' and previous and previous['type']=='column_calculation':
            columns[event['column']] = [previous,event]
        elif event['type']=='conflict' and event['carry_out'] is not None and failure_state is None:
            failure_state=event['assignment'].copy()
            failure_seq=event['seq']
            failure_frames.append(archive.page(0,1)[0])
            failure_frames.extend(frame for frames in active.values() for frame in frames)
            failure_frames.extend(frame for frames in columns.values() for frame in frames)
            failure_frames.append(event)
        elif event['type'] == 'solution':
            selected = [archive.page(0,1)[0],event]
            selected.extend(frame for frames in active.values() for frame in frames)
            pairs = list(columns.values())
            if len(pairs)>20:
                pairs = [pairs[i*(len(pairs)-1)//19] for i in range(20)]
            selected.extend(frame for frames in pairs for frame in frames)
            result = {frame['seq']:frame for frame in selected}
            with_failure={**result,**{frame['seq']:frame for frame in failure_frames}}
            if failure_frames and len(with_failure)<=128 and causal(with_failure):
                result=with_failure
                raise Found()
            history = list(recent)
            for end in range(len(history)-1,-1,-1):
                failed = history[end]
                if failed['type'] not in ('prune','conflict'):
                    continue
                wrong = [c for c,value in failed['assignment'].items() if archive.solutions[0][c]!=value]
                if len(wrong)>1:
                    continue
                start = next((i for i in range(end-1,-1,-1)
                              if history[i]['type']=='candidate' and
                              (not wrong or history[i]['check'].startswith(wrong[0]+'='))),None)
                if start is None:
                    continue
                stop = end+1
                if wrong:
                    stop = next((i+1 for i in range(end+1,len(history))
                                 if history[i]['type']=='backtrack' and wrong[0] in history[i]['undo']),stop)
                elif stop<len(history) and history[stop]['type']=='prune':
                    stop+=1
                combined = {**result,**{frame['seq']:frame for frame in history[start:stop]}}
                if causal(combined):
                    result = combined
                    break
            raise Found()
        recent.append(event)
        previous = event

    try:
        for event in archive.prefix:
            collect(event)
        active.clear(); columns.clear(); recent.clear(); previous=None
        failure_frames.clear(); failure_state=None; failure_seq=None
        backtracking.solve(archive.problem,emit=collect)
    except Found:
        pass
    return result


def build_summary(problem, result):
    archive = TraceArchive(problem,result)
    if not archive.total:
        return [],[]
    if archive.solutions:
        events = brute_path(archive) if archive.algorithm=='brute_force' else backtracking_path(archive)
    else:
        first = archive.page(0,min(96,archive.total))
        failed = False
        stop = len(first)
        for i,event in enumerate(first):
            failed |= event['type'] in ('prune','conflict') or (event['type']=='complete_check' and not event['is_solution'])
            if failed and event['type']=='backtrack':
                stop=i+1
                break
        events = {event['seq']:event for event in first[:stop]}
    if archive.status=='complete':
        events[archive.total-1] = archive.page(archive.total-1,1)[0]
    ordered = sorted(events.values(),key=lambda event:event['seq'])
    sections=[]
    for event in ordered:
        if sections and event['seq']==sections[-1]['end_seq']+1:
            sections[-1]['end_seq']=event['seq']
        else:
            previous_end=sections[-1]['end_seq']+1 if sections else 0
            sections.append(dict(start_seq=event['seq'],end_seq=event['seq'],title='',omitted_before=event['seq']-previous_end))
    for section in sections:
        frames=[event for event in ordered if section['start_seq']<=event['seq']<=section['end_seq']]
        kinds={event['type'] for event in frames}
        if 'finish' in kinds:
            title='남은 후보 검사까지 마친 최종 결과'
        elif 'solution' in kinds:
            title='같은 후보의 계산을 검증하고 정답을 확인합니다'
        elif kinds & {'conflict','prune'}:
            title='잘못된 숫자 후보를 제외하고 되돌아갑니다'
        elif kinds & {'column_calculation','carry_check'}:
            title='같은 배정으로 자리 계산과 올림을 확인합니다'
        else:
            title='정답 후보의 숫자를 하나씩 배정합니다'
        section['title']=title
    return ordered,sections
