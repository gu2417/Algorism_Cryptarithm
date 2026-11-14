(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('solve-form'), input = $('expression'), algorithm = $('algorithm');
  let words = [], busy = false, players = [];
  const stage = $('comparison-stage');
  $('presentation-toggle').addEventListener('click', () => {
    const active = document.body.classList.toggle('presentation');
    $('presentation-toggle').setAttribute('aria-pressed', String(active));
    $('presentation-toggle').textContent = active ? '일반 화면으로' : '발표 화면';
    if (active) window.scrollTo(0, 0);
  });
  const primary = $('player-backtracking');
  const names = {start:'탐색을 시작합니다', candidate:'숫자 후보를 선택합니다', assign:'문자에 숫자를 배정합니다', complete_check:'완성된 수식을 검사합니다', column_calculation:'현재 자리를 계산합니다', carry_check:'자리올림을 확인합니다', conflict:'제약 조건이 충돌했습니다', prune:'이 후보를 가지치기합니다', backtrack:'이전 상태로 되돌아갑니다', solution:'유효한 정답을 찾았습니다', finish:'탐색이 끝났습니다'};
  const node = (tag, className, value) => { const element = document.createElement(tag); if (className) element.className = className; if (value !== undefined) element.textContent = value; return element; };
  function createPlayer(root, run, words, prefix = '', onResult = () => {}) {
    const $ = id => root.querySelector(`[id="${prefix}${id}"]`);
    const listeners = new AbortController();
    const listen = (element, type, callback) => element.addEventListener(type, callback, {signal:listeners.signal});
    let trace = [], index = 0, timer = null, activeAlgorithm = '', disposed = false, generation = 0;
    let pageOffset = 0, loadingPage = false;
    let pendingSummaryStep = null;
    const storyToolbar=node('div','story-toolbar');storyToolbar.hidden=true;
    const storyNav=node('nav','story-nav');storyNav.setAttribute('aria-label','발표 장면');storyNav.hidden=true;
    const storyAuto=node('button','story-auto','▶ 자동 재생');storyAuto.type='button';storyAuto.setAttribute('aria-pressed','false');
    storyToolbar.append(storyNav,storyAuto);$('trace-view-choice').after(storyToolbar);
    listen(storyAuto,'click',()=>{if(timer!==null){pause();render();}else play();});
    const storyCard=node('section','story-card');storyCard.hidden=true;
    storyCard.setAttribute('aria-live','polite');
    const storyPhase=node('p','story-phase'),storyTitle=node('h3','story-title'),storyNarration=node('p','story-narration'),storyFormula=node('div','story-formula'),storyDetail=node('p','story-detail'),storyExplanation=node('p','story-explanation');
    storyCard.append(storyPhase,storyTitle,storyNarration,storyFormula,storyDetail,storyExplanation);
    root.querySelector('.lab-side').prepend(storyCard);
    const scene = node('p', 'summary-scene'); scene.setAttribute('role','status'); scene.hidden=true;
    $('trace-summary-info').after(scene);
    const sceneFor = event => (run.summary_sections || []).find(section => section.start_seq <= event.seq && event.seq <= section.end_seq);
    const paged = () => $('trace-view').value === 'full' && run.trace_paged;
    const totalSteps = () => paged() ? run.trace_total : trace.length;
    const position = () => pageOffset + index;
    const atEnd = () => position() === totalSteps() - 1;
    const jumpControls = node('div', 'trace-jump');
    const stepInput = node('input'); stepInput.type='number'; stepInput.min='1'; stepInput.setAttribute('aria-label','이동할 전체 단계');
    const jumpButton = node('button','','단계로 이동'); jumpButton.type='button';
    const endButton = node('button','','마지막 단계'); endButton.type='button';
    jumpControls.append(stepInput,jumpButton,endButton); jumpControls.hidden=true;
    $('trace-view-choice').after(jumpControls);
    listen(jumpButton,'click',()=> {const value=Number(stepInput.value);if(Number.isInteger(value)&&value>=1&&value<=totalSteps()) jump(value-1);});
    listen(endButton,'click',()=>jump(totalSteps()-1));
    const solveButton = node('button', 'player-solve', '이 알고리즘만 다시 풀이');
    solveButton.type = 'button';
    root.querySelector('.section-title').append(solveButton);
    listen(solveButton,'click', async () => {
      if (disposed) return;
      if (solveButton.disabled) return;
      pause(); solveButton.disabled = true; solveButton.textContent = '계산 중…';
      generation++;
      try {
        const response = await fetch('/api/solve', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expression:`${words[0]} + ${words[1]} = ${words[2]}`, algorithm:run.algorithm, trace_view:'summary'})});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || '풀이에 실패했습니다.');
        if (disposed) return;
        run = data.runs[0];
        $('trace-view').value = 'story';
        selectTrace(run.algorithm); onResult(run);
      } catch (error) { if (!disposed) $('trace-warning').textContent = error.message; }
      finally { if (!disposed) { solveButton.disabled = false; solveButton.textContent = '이 알고리즘만 다시 풀이'; } }
    });
  function pause() { if (timer !== null) clearInterval(timer); timer = null; $('play').innerHTML = '▶ <span>재생</span>'; }
  function renderEquation(assignment = {}, column = null) {
    const equation = $('equation'); equation.replaceChildren();
    if (words.length !== 3) { equation.append(node('p', 'equation-placeholder', 'A + B = C')); return; }
    words.forEach((word, row) => {
      const line = node('div', 'equation-row' + (row === 2 ? ' equation-answer' : ''));
      line.append(node('span', 'operator', row === 1 ? '+' : ''));
      const digits = node('span', 'digits');
      [...word].forEach((letter, pos) => {
        const cell = node('span', 'digit' + (column === word.length - 1 - pos ? ' current' : ''));
        cell.append(node('small', '', letter), node('strong', '', Object.hasOwn(assignment, letter) ? String(assignment[letter]) : '·'));
        digits.append(cell);
      });
      line.append(digits); equation.append(line);
    });
  }
  function updateButtons() {
    const has = trace.length > 0;
    $('restart').disabled = !has || loadingPage || (position() === 0 && pendingSummaryStep === null);
    $('prev').disabled = !has || loadingPage || (position() === 0 && pendingSummaryStep === null);
    $('next').disabled = !has || loadingPage || atEnd();
    $('play').disabled = !has || loadingPage;
    if (timer === null) $('play').innerHTML = has && atEnd() ? '↻ <span>다시 재생</span>' : '▶ <span>재생</span>';
    if(timer===null && $('trace-view').value==='story')$('play').innerHTML=atEnd()?'↻ <span>처음부터</span>':'▶ <span>자동 재생</span>';
    if (pendingSummaryStep !== null) $('play').innerHTML = '▶ <span>다음 장면</span>';
    storyAuto.disabled=!has||loadingPage;
    storyAuto.textContent=timer!==null?'Ⅱ 일시정지':atEnd()?'↻ 다시 자동 재생':'▶ 자동 재생';
    storyAuto.setAttribute('aria-pressed',String(timer!==null));
    storyAuto.title=`현재 장면부터 자동으로 넘깁니다 · 장면당 ${Number($('speed').value)*12/1000}초`;
  }
  function render() {
    if (disposed) return;
    if (!trace.length) { renderEquation(); updateButtons(); return; }
    const event = trace[index];
    const storyMode=$('trace-view').value==='story';
    const chapter=storyMode ? run.presentation_scenes?.[index] : null;
    $('next').textContent=storyMode?'다음 장면 →':'→';$('prev').textContent=storyMode?'← 이전':'←';
    $('next').setAttribute('aria-label',storyMode?'다음 장면':'다음 단계');$('prev').setAttribute('aria-label',storyMode?'이전 장면':'이전 단계');
    storyCard.hidden=!storyMode;storyNav.hidden=!storyMode;storyToolbar.hidden=!storyMode;
    if(chapter){
      storyCard.dataset.phase=chapter.phase;
      storyPhase.textContent=`${String(index+1).padStart(2,'0')} / ${String(trace.length).padStart(2,'0')} · ${chapter.phase}`;
      storyTitle.textContent=chapter.title;storyNarration.textContent=chapter.narration;
      storyFormula.textContent=chapter.formula;storyFormula.hidden=!chapter.formula;
      storyDetail.textContent=chapter.detail;storyExplanation.replaceChildren(node('strong','','구조 설명'),document.createTextNode(chapter.explanation || chapter.takeaway || ''));
      storyNav.replaceChildren();
      run.presentation_scenes.forEach((item,i)=>{const button=node('button',i===index?'active':'',String(i+1).padStart(2,'0'));button.type='button';button.title=item.title;button.setAttribute('aria-label',`${i+1}장면: ${item.title}`);button.setAttribute('aria-current',i===index?'step':'false');button.addEventListener('click',()=>{jump(i);root.focus({preventScroll:true});});storyNav.append(button);});
      root.querySelector('.step-count > span').textContent='발표 장면';
    }else root.querySelector('.step-count > span').textContent='탐색 단계';
    scene.hidden = $('trace-view').value !== 'summary';
    scene.dataset.waiting = String(pendingSummaryStep !== null);
    if (!scene.hidden) {
      const next = pendingSummaryStep === null ? index : pendingSummaryStep;
      const section = sceneFor(trace[next]);
      const omitted = next > 0 ? trace[next].seq - trace[next-1].seq - 1 : 0;
      const title = pendingSummaryStep !== null && trace[next].type === 'solution' ? '정답 발견 장면을 확인합니다' : pendingSummaryStep !== null && trace[next].type === 'finish' ? '탐색 종료 결과를 확인합니다' : section?.title || '주요 장면';
      let changes = '';
      if (omitted > 0 && next > 0) {
        const before=trace[next-1].assignment, after=trace[next].type==='finish' && run.solutions.length ? run.solutions[0].mapping : trace[next].assignment;
        const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>before[key]!==after[key]);
        if(changed.length) changes=` · 배정 변경: ${changed.slice(0,3).map(key=>`${key} ${before[key]??'미배정'}→${after[key]??'해제'}`).join(', ')}${changed.length>3?` 외 ${changed.length-3}개`:''}`;
      }
      scene.textContent = `${title}${omitted > 0 ? ` · 중간 ${omitted.toLocaleString()}단계 생략` : ''}${changes}${pendingSummaryStep !== null ? ' · 다음 장면을 누르면 이어집니다.' : ''}`;
    }
    const completed = event.type === 'finish' && run.status === 'complete';
    const finalSolution = (completed || atEnd()) && run.solutions.length ? run.solutions[0] : null;
    const shownAssignment = finalSolution ? finalSolution.mapping : event.assignment;
    const resultBoard = completed || finalSolution !== null;
    renderEquation(shownAssignment, resultBoard ? null : event.column);
    $('column-label').textContent = completed ? (finalSolution ? '최종 정답' : '탐색 종료') : finalSolution ? '발견한 정답' : event.type==='solution' ? '정답 발견' : event.column === null ? (activeAlgorithm === 'brute_force' ? '전체 식 검사' : '자리 선택 전') : `${event.column + 1}번째 자리 · 오른쪽부터`;
    const shownCarryIn=resultBoard?null:event.carry_in,shownCarryOut=resultBoard?null:event.carry_out;
    $('carry').replaceChildren(document.createTextNode('자리올림 '), node('strong', '', shownCarryIn === null ? '—' : String(shownCarryIn)), document.createTextNode(' → '), node('strong', '', shownCarryOut === null ? '—' : String(shownCarryOut)));
    const assignment = $('assignment'); assignment.replaceChildren();
    const entries = Object.entries(shownAssignment);
    if (!entries.length) assignment.append(node('span', 'muted', completed ? '모든 후보의 검사를 마쳤습니다. 유효한 배정이 없습니다.' : '아직 배정된 숫자가 없습니다.'));
    entries.forEach(([letter, digit]) => assignment.append(node('span', 'assignment-chip', `${letter}  =  ${digit}`)));
    $('step-number').textContent = `${(position() + 1).toLocaleString()} / ${totalSteps().toLocaleString()}`;
    $('event-description').textContent = finalSolution && !completed ? '저장된 기록 재생이 끝났습니다' : names[event.type] || event.type;
    $('event-detail').textContent = [event.check, event.reason].filter(Boolean).join(' · ') || (event.undo.length ? `${event.undo.join(', ')} 배정을 해제했습니다.` : '현재 상태를 확인해 보세요.');
    if (completed) $('event-detail').textContent = finalSolution ? `최종 정답: ${finalSolution.numeric_expression}` : '가능한 배정을 모두 확인했지만 정답이 없습니다.';
    else if (finalSolution) $('event-detail').textContent = `발견한 정답: ${finalSolution.numeric_expression} · 탐색 상태는 아래 안내를 확인하세요.`;
    const outcome = $('playback-outcome');
    outcome.hidden = !atEnd();
    outcome.replaceChildren();
    if (!outcome.hidden) {
      if (run.status === 'complete') {
        const partialPlayback = run.trace_truncated && $('trace-view').value === 'full';
        outcome.append(node('strong', '', partialPlayback ? '저장된 전체 기록의 앞부분 재생이 끝났습니다. 실제 탐색은 완료되었습니다.' : '탐색이 끝났습니다.'));
        if (partialPlayback) outcome.append(node('span', '', '전체 탐색 기록 중 저장된 앞부분만 재생했습니다.'));
        if (run.solutions.length) {
          outcome.append(node('span', '', `최종 정답: ${run.solutions[0].numeric_expression}`));
          outcome.append(node('span', '', Object.entries(run.solutions[0].mapping).map(([letter, digit]) => `${letter}=${digit}`).join(' · ')));
          if (run.solutions.length > 1) outcome.append(node('span', '', '다른 해는 아래 결과 영역에서 선택할 수 있습니다.'));
        } else outcome.append(node('span', '', '가능한 배정을 모두 확인했지만 정답이 없습니다.'));
      } else {
        outcome.append(node('strong', '', run.status === 'time_limit' ? '시간 제한으로 탐색이 중단되었습니다.' : '해 개수 제한으로 탐색이 중단되었습니다.'));
        outcome.append(node('span', '', '전체 해의 개수는 알 수 없습니다.'));
        if (run.solutions.length) {
          outcome.append(node('span', '', `발견한 정답: ${run.solutions[0].numeric_expression}`));
          outcome.append(node('span', '', Object.entries(run.solutions[0].mapping).map(([letter, digit]) => `${letter}=${digit}`).join(' · ')));
          if (run.solutions.length > 1) outcome.append(node('span', '', '다른 해는 아래 결과 영역에서 선택할 수 있습니다.'));
        } else outcome.append(node('span', '', '제한 전에 발견한 해가 없습니다.'));
      }
    }
    const list = $('trace-list'); list.replaceChildren();
    const start = Math.max(0, index - 2), end = Math.min(trace.length, index + 3);
    for (let i = start; i < end; i++) {
      const li = node('li', i === index ? 'selected' : '');
      const button = node('button', 'trace-item'); button.type = 'button';
      button.dataset.sourceStep = String(trace[i].seq + 1);
      button.title = `원본 기록 ${trace[i].seq + 1}단계`;
      button.append(node('span', 'trace-index', String(pageOffset + i + 1).padStart(2, '0')), node('span', '', names[trace[i].type] || trace[i].type));
      button.addEventListener('click', () => jump(pageOffset+i)); li.append(button); list.append(li);
    }
    updateButtons();
  }
  function summarize(events) {
    const important = new Set(['start', 'candidate', 'assign', 'complete_check', 'column_calculation', 'carry_check', 'conflict', 'prune', 'backtrack']);
    const counts = new Map(), selected = new Set();
    events.forEach((event, position) => {
      if (important.has(event.type) && (counts.get(event.type) || 0) < 3) {
        selected.add(position); counts.set(event.type, (counts.get(event.type) || 0) + 1);
      }
      if ((event.type === 'solution' || event.type === 'finish') && !counts.has(event.type)) {
        selected.add(position); counts.set(event.type, 1);
      }
    });
    return events.filter((_, position) => selected.has(position));
  }
  async function selectTrace(name) {
    if (disposed) return;
    pause(); index = 0; pageOffset = 0; loadingPage = false; pendingSummaryStep=null; scene.hidden=true; activeAlgorithm = name;
    const current = ++generation;
    root.classList.toggle('story-mode',$('trace-view').value==='story');
    if($('trace-view').value==='story')root.tabIndex=0;else root.removeAttribute('tabindex');
    storyToolbar.hidden=storyNav.hidden=storyCard.hidden=$('trace-view').value!=='story';
    jumpControls.hidden = !paged(); stepInput.max = run.trace_total || 1;
    if (paged()) {
      trace = []; await jump(0); return;
    }
    if ($('trace-view').value === 'full' && run.trace_token && !run.trace.length) {
      $('trace-warning').textContent = '전체 기록을 불러오는 중입니다…';
      for (const id of ['play','next','prev','restart']) $(id).disabled = true;
      try {
        const response = await fetch(`/api/traces/${run.trace_token}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || '기록을 가져오지 못했습니다.');
        if (disposed || current !== generation) return;
        run.trace = data.trace;
      } catch (error) {
        if (!disposed && current === generation) { $('trace-view').value = 'summary'; await selectTrace(name); $('trace-warning').textContent = error.message; }
        return;
      }
    }
    if (disposed || current !== generation) return;
    const fullTrace = run?.trace || [];
    const summary = $('trace-view').value !== 'full';
    trace = $('trace-view').value==='story' && run.presentation_scenes?.length ? run.presentation_scenes.map(chapter=>chapter.event) : summary ? (run?.summary_trace || summarize(fullTrace)) : fullTrace;
    $('trace-view-choice').hidden = false;
    $('trace-summary-info').hidden = !summary;
    const seen = run?.events_seen ?? fullTrace.length;
    $('trace-summary-info').textContent = summary ? `발생한 ${seen.toLocaleString()}단계 중 ${trace.length.toLocaleString()}단계 표시 · ${(seen - trace.length).toLocaleString()}단계 생략 · 장면 전환·결과 확인 전 잠시 멈춥니다 · 1×에서 배정 1초, 검사 1.5초 (목록 번호는 요약 순서)` : '';
    const title = name === 'brute_force' ? '완전탐색' : '백트래킹';
    $('trace-context').hidden = false;
    $('trace-context').textContent = name === 'brute_force' ? '완전탐색은 숫자 배정을 완성한 뒤 전체 수식을 검사합니다.' : '백트래킹은 오른쪽 자리부터 계산하며 맞지 않는 후보를 제외합니다.';
    $('mode-label').textContent = `${title} · ${trace.length ? '탐색 기록 준비' : '기록 없음'}`;
    $('trace-warning').textContent = run?.trace_truncated ? (summary ? '전체 보기는 앞부분만 저장됐지만, 요약은 실제 실행된 구간 전체에서 주요 장면을 수집했습니다.' : '전체 기록이 제한되어 탐색의 앞부분만 재생합니다. 탐색 결과는 아래에서 확인하세요.') : (!trace.length ? '재생할 탐색 기록이 없습니다.' : '');
    if (!trace.length) {
      $('playback-outcome').hidden = true;
      $('step-number').textContent = '— / —'; $('column-label').textContent = '자리 선택 전';
      $('carry').innerHTML = '자리올림 <strong>—</strong> → <strong>—</strong>';
      $('assignment').replaceChildren(node('span', 'muted', '아직 배정된 숫자가 없습니다.'));
      $('event-description').textContent = '재생할 탐색 기록이 없습니다.';
      $('event-detail').textContent = '';
      $('trace-list').replaceChildren(node('li', 'trace-empty', '기록이 없습니다.'));
    }
    render();
  }
  listen($('trace-view'),'change', () => selectTrace(activeAlgorithm));
  async function jump(target, resume=false) {
    if (disposed) return;
    pause();
    pendingSummaryStep=null;
    if(target<0 || target>=totalSteps()) return;
    if(paged() && (target<pageOffset || target>=pageOffset+trace.length)) {
      const current=++generation; loadingPage=true; updateButtons();
      $('trace-warning').textContent='탐색 기록을 불러오는 중입니다…';
      try {
        const offset=Math.floor(target/200)*200;
        const response=await fetch(`/api/traces/${run.trace_token}?offset=${offset}&limit=200`);
        const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'기록 조회 실패');
        if(disposed||current!==generation)return;
        trace=data.trace;pageOffset=data.offset;loadingPage=false;
        $('trace-summary-info').hidden=true;
        $('trace-warning').textContent='';
      } catch(error) {
        if(!disposed&&current===generation){loadingPage=false;$('trace-view').value='summary';await selectTrace(activeAlgorithm);$('trace-warning').textContent=error.message;}
        return;
      }
    }
    index=target-pageOffset;render();if(resume)play();
  }
  listen($('prev'),'click', () => jump(pendingSummaryStep!==null ? position() : Math.max(0,position()-1)));
  listen($('next'),'click', () => jump(position()+1));
  listen($('restart'),'click', () => jump(0));
  function play() {
    if (disposed) return;
    if (!trace.length) return;
    if(totalSteps()===1){jump(0);return;}
    if(pendingSummaryStep!==null){index=pendingSummaryStep;pendingSummaryStep=null;render();if(atEnd()){pause();render();return;}}
    if(atEnd()){jump(0,true);return;}
    $('play').innerHTML = 'Ⅱ <span>일시정지</span>';
    const summary=$('trace-view').value==='summary';
    const important=['column_calculation','carry_check','conflict','prune','complete_check','solution'];
    const factor=$('trace-view').value==='story'?12:summary?(important.includes(trace[index].type)?3:2):1;
    timer=setInterval(()=>{
      clearInterval(timer);timer=null;
      if (disposed) return;
      const next=trace[index+1];
      if(summary && next && (next.seq>trace[index].seq+1 || next.type==='solution' || next.type==='finish' || sceneFor(next)!==sceneFor(trace[index]))){pendingSummaryStep=index+1;pause();render();return;}
      if(index===trace.length-1 && !atEnd()){jump(position()+1,true);return;}
      if(!atEnd()){index++;render();}
      if(atEnd()){pause();render();}else play();
    },Number($('speed').value)*factor);
    updateButtons();
  }
  listen($('play'),'click', () => { if (timer !== null) { pause(); render(); } else play(); });
  listen($('speed'),'change', () => { if (timer !== null) { pause(); play(); } });
  listen(root,'keydown',event=>{if($('trace-view').value!=='story'||event.target.matches('input,select'))return;if(event.key==='ArrowRight'){event.preventDefault();jump(position()+1);root.focus({preventScroll:true});}if(event.key==='ArrowLeft'){event.preventDefault();jump(Math.max(0,position()-1));root.focus({preventScroll:true});}});
    selectTrace(run.algorithm);
    return {destroy() { disposed = true; generation++; listeners.abort(); pause(); solveButton.remove(); jumpControls.remove(); scene.remove(); storyToolbar.remove();storyCard.remove();root.classList.remove('story-mode');root.removeAttribute('tabindex'); }};
  }
  function resetPlayback() {
    players.forEach(player => player.destroy()); players = [];
    const extra = document.getElementById('player-brute');
    if (extra) extra.remove();
    stage.classList.remove('compare'); words = [];
    primary.querySelector('h2').textContent = '풀이 들여다보기';
    primary.setAttribute('aria-label', '탐색 시각화');
    $('trace-choice').hidden = true; $('trace-context').hidden = true;
    $('playback-outcome').hidden = true; $('playback-outcome').replaceChildren();
    $('trace-view-choice').hidden = true; $('trace-summary-info').hidden = true; $('trace-view').value = 'story';
    $('step-number').textContent = '— / —'; $('column-label').textContent = '자리 선택 전';
    $('carry').innerHTML = '자리올림 <strong>—</strong> → <strong>—</strong>';
    $('assignment').replaceChildren(node('span', 'muted', '아직 배정된 숫자가 없습니다.'));
    $('equation').replaceChildren(node('p', 'equation-placeholder', 'A + B = C'));
    $('event-description').textContent = '문제를 실행하면 탐색 과정이 이곳에 나타납니다.';
    $('event-detail').textContent = '하나의 단계씩 살펴보거나 자동으로 재생해 보세요.';
    $('trace-list').replaceChildren(node('li', 'trace-empty', '아직 기록이 없습니다.'));
    $('trace-warning').textContent = ''; $('mode-label').textContent = '실행 대기';
    for (const id of ['restart', 'prev', 'play', 'next']) $(id).disabled = true;
    $('play').innerHTML = '▶ <span>재생</span>';
    $('result-caption').textContent = '문제를 실행하면 결과가 표시됩니다.';
    const area = $('results-content'); area.className = 'results-empty';
    area.replaceChildren(node('span', '', '✳'), node('p', '', '아직 실행된 문제가 없습니다.'), node('small', '', '위에서 예제를 고르거나 직접 수식을 입력해 보세요.'));
  }
  function setupPlayers(runs) {
    const backtracking = runs.find(run => run.algorithm === 'backtracking');
    const brute = runs.find(run => run.algorithm === 'brute_force');
    let secondary;
    if (backtracking && brute) {
      secondary = primary.cloneNode(true);
      secondary.id = 'player-brute';
      secondary.querySelectorAll('[id]').forEach(element => { element.id = `brute-${element.id}`; });
      secondary.setAttribute('aria-label', '완전탐색 시각화');
      stage.classList.add('compare'); stage.append(secondary);
      primary.querySelector('h2').textContent = '백트래킹';
      primary.setAttribute('aria-label', '백트래킹 시각화');
      secondary.querySelector('h2').textContent = '완전탐색';
    }
    const latest = new Map(runs.map(run => [run.algorithm, run]));
    const updateResult = run => { latest.set(run.algorithm, run); showResults({original_expression:input.value, runs:[...latest.values()]}); };
    players.push(createPlayer(primary, backtracking || brute, words, '', updateResult));
    if (secondary) players.push(createPlayer(secondary, brute, words, 'brute-', updateResult));
  }
  function showResults(data) {
    const area = $('results-content'); area.className = 'result-grid'; area.replaceChildren();
    $('result-caption').textContent = `입력 수식  ${data.original_expression}`;
    for (const run of data.runs) {
      const panel = node('article', 'result-panel');
      const heading = node('div', 'result-head'); heading.append(node('h3', '', run.algorithm === 'brute_force' ? '완전탐색' : '백트래킹'), node('span', 'status ' + (run.status === 'complete' ? 'done' : 'limited'), run.status === 'complete' ? '탐색 완료' : run.status === 'time_limit' ? '시간 제한' : '해 개수 제한')); panel.append(heading);
      const count = run.status === 'complete' ? `정답 ${run.solutions_found}개` : `발견한 정답 ${run.solutions_found}개 이상`;
      panel.append(node('p', 'result-count', count));
      if (run.status !== 'complete') panel.append(node('p', 'result-note', '탐색이 중단되어 전체 해의 개수는 알 수 없습니다.'));
      if (!run.solutions.length) panel.append(node('p', 'result-note', run.status === 'complete' ? '모든 허용 후보를 검사했지만 정답을 찾지 못했습니다.' : '제한 전에 발견한 해가 없습니다.'));
      if (run.solutions.length) {
        const label = node('label', 'solution-select', '확인할 정답 '), select = node('select');
        run.solutions.forEach((solution, i) => { const option = node('option', '', `정답 ${i + 1} · ${solution.numeric_expression}`); option.value = i; select.append(option); });
        label.append(select); panel.append(label);
        const selected = node('div', 'solution-value');
        function displaySolution() { const solution = run.solutions[Number(select.value)]; selected.replaceChildren(node('strong', '', solution.numeric_expression), node('span', '', Object.entries(solution.mapping).map(([key, value]) => `${key}=${value}`).join('  ·  '))); }
        select.addEventListener('change', displaySolution); displaySolution(); panel.append(selected);
      }
      const stats = node('div', 'stats');
      [['배정 시도', run.statistics.assignment_attempts.toLocaleString()], ['완성 배정 검사', run.statistics.complete_assignments_checked.toLocaleString()], ['가지치기', run.statistics.prunes.toLocaleString()], ['실행 시간', `${run.statistics.elapsed_ms.toFixed(1)} ms`]].forEach(([key, val]) => { const item = node('div'); item.append(node('span', '', key), node('strong', '', val)); stats.append(item); });
      panel.append(stats); area.append(panel);
    }
    if (data.runs.length > 1) area.append(node('p', 'compare-note', '배정 시도는 미사용 숫자를 문자에 배정하려 한 횟수입니다. 두 알고리즘의 실행 시간에는 기록 생성 비용이 포함됩니다.'));
  }
  function validation(value) {
    if (!value.trim()) return '수식을 입력해 주세요.';
    if (value.length > 128) return '수식은 128자 이하여야 합니다.';
    const match = value.match(/^\s*([a-z]+)\s*\+\s*([a-z]+)\s*=\s*([a-z]+)\s*$/i);
    if (!match) return '영문 단어 두 개를 더하는 WORD + WORD = WORD 형식으로 입력해 주세요.';
    if (new Set((match[1] + match[2] + match[3]).toUpperCase()).size > 10) return '서로 다른 문자는 최대 10개까지 사용할 수 있습니다.';
    return '';
  }
  const examples = [...document.querySelectorAll('[data-example]')];
  function setInputLocked(locked) {
    input.disabled = locked;
    algorithm.disabled = locked;
    examples.forEach(button => { button.disabled = locked; });
  }
  function invalidateResults() {
    if (!busy) resetPlayback();
  }
  input.addEventListener('input', invalidateResults);
  algorithm.addEventListener('change', invalidateResults);
  examples.forEach(button => button.addEventListener('click', () => { input.value = button.dataset.example; invalidateResults(); $('input-error').textContent = ''; input.removeAttribute('aria-invalid'); input.focus(); }));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; const message = validation(input.value); $('input-error').textContent = message;
    if (message) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    busy = true; input.removeAttribute('aria-invalid'); resetPlayback(); setInputLocked(true); $('solve-button').disabled = true; $('solve-button').textContent = '계산 중…'; $('mode-label').textContent = '계산 중';
    try {
      const response = await fetch('/api/solve', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expression: input.value, algorithm: algorithm.value, trace_view:'summary'})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || '요청을 처리하지 못했습니다.');
      words = data.normalized_expression.match(/[A-Z]+/g) || [];
      setupPlayers(data.runs); showResults(data);
    } catch (error) { $('input-error').textContent = error.message || '서버에 연결할 수 없습니다.'; $('mode-label').textContent = '실행 오류'; }
    finally { busy = false; setInputLocked(false); $('solve-button').disabled = false; $('solve-button').innerHTML = '풀이 시작 <span aria-hidden="true">↗</span>'; }
  });
  resetPlayback();
})();
