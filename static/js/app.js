(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('solve-form'), input = $('expression'), algorithm = $('algorithm');
  let trace = [], index = 0, timer = null, words = [], lastResult = null;
  const names = {start:'탐색을 시작합니다', candidate:'숫자 후보를 선택합니다', assign:'문자에 숫자를 배정합니다', column_calculation:'현재 자리를 계산합니다', carry_check:'자리올림을 확인합니다', conflict:'제약 조건이 충돌했습니다', prune:'이 후보를 가지치기합니다', backtrack:'이전 상태로 되돌아갑니다', solution:'유효한 정답을 찾았습니다', finish:'탐색이 끝났습니다'};
  const node = (tag, className, value) => { const element = document.createElement(tag); if (className) element.className = className; if (value !== undefined) element.textContent = value; return element; };
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
    $('restart').disabled = !has || index === 0;
    $('prev').disabled = !has || index === 0;
    $('next').disabled = !has || index >= trace.length - 1;
    $('play').disabled = !has || (index >= trace.length - 1 && timer === null);
  }
  function render() {
    if (!trace.length) { renderEquation(); updateButtons(); return; }
    const event = trace[index];
    renderEquation(event.assignment, event.column);
    $('column-label').textContent = event.column === null ? '자리 선택 전' : `${event.column + 1}번째 자리 · 오른쪽부터`;
    $('carry').replaceChildren(document.createTextNode('자리올림 '), node('strong', '', event.carry_in === null ? '—' : String(event.carry_in)), document.createTextNode(' → '), node('strong', '', event.carry_out === null ? '—' : String(event.carry_out)));
    const assignment = $('assignment'); assignment.replaceChildren();
    const entries = Object.entries(event.assignment);
    if (!entries.length) assignment.append(node('span', 'muted', '아직 배정된 숫자가 없습니다.'));
    entries.forEach(([letter, digit]) => assignment.append(node('span', 'assignment-chip', `${letter}  =  ${digit}`)));
    $('step-number').textContent = `${(index + 1).toLocaleString()} / ${trace.length.toLocaleString()}`;
    $('event-description').textContent = names[event.type] || event.type;
    $('event-detail').textContent = event.reason || event.check || (event.undo.length ? `${event.undo.join(', ')} 배정을 해제했습니다.` : '현재 상태를 확인해 보세요.');
    const list = $('trace-list'); list.replaceChildren();
    const start = Math.max(0, index - 2), end = Math.min(trace.length, index + 3);
    for (let i = start; i < end; i++) {
      const li = node('li', i === index ? 'selected' : '');
      const button = node('button', 'trace-item'); button.type = 'button';
      button.append(node('span', 'trace-index', String(i + 1).padStart(2, '0')), node('span', '', names[trace[i].type] || trace[i].type));
      button.addEventListener('click', () => { pause(); index = i; render(); }); li.append(button); list.append(li);
    }
    updateButtons();
  }
  function resetPlayback() {
    pause(); trace = []; index = 0; words = []; lastResult = null;
    $('step-number').textContent = '— / —'; $('column-label').textContent = '자리 선택 전';
    $('carry').innerHTML = '자리올림 <strong>—</strong> → <strong>—</strong>';
    $('assignment').replaceChildren(node('span', 'muted', '아직 배정된 숫자가 없습니다.'));
    $('event-description').textContent = '문제를 실행하면 탐색 과정이 이곳에 나타납니다.';
    $('event-detail').textContent = '하나의 단계씩 살펴보거나 자동으로 재생해 보세요.';
    $('trace-list').replaceChildren(node('li', 'trace-empty', '아직 기록이 없습니다.'));
    $('trace-warning').textContent = ''; $('mode-label').textContent = '실행 대기';
    $('result-caption').textContent = '문제를 실행하면 결과가 표시됩니다.';
    const area = $('results-content'); area.className = 'results-empty';
    area.replaceChildren(node('span', '', '✳'), node('p', '', '아직 실행된 문제가 없습니다.'), node('small', '', '위에서 예제를 고르거나 직접 수식을 입력해 보세요.'));
    render();
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
    if (data.runs.length > 1) area.append(node('p', 'compare-note', '배정 시도는 미사용 숫자를 문자에 배정하려 한 횟수입니다. 백트래킹 실행 시간에는 기록 생성 비용이 포함됩니다.'));
  }
  function validation(value) {
    if (!value.trim()) return '수식을 입력해 주세요.';
    if (value.length > 128) return '수식은 128자 이하여야 합니다.';
    const match = value.match(/^\s*([a-z]+)\s*\+\s*([a-z]+)\s*=\s*([a-z]+)\s*$/i);
    if (!match) return '영문 단어 두 개를 더하는 WORD + WORD = WORD 형식으로 입력해 주세요.';
    if (new Set((match[1] + match[2] + match[3]).toUpperCase()).size > 10) return '서로 다른 문자는 최대 10개까지 사용할 수 있습니다.';
    return '';
  }
  document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.example; $('input-error').textContent = ''; input.removeAttribute('aria-invalid'); input.focus(); }));
  form.addEventListener('submit', async event => {
    event.preventDefault(); const message = validation(input.value); $('input-error').textContent = message;
    if (message) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    input.removeAttribute('aria-invalid'); resetPlayback(); $('solve-button').disabled = true; $('solve-button').textContent = '계산 중…'; $('mode-label').textContent = '계산 중';
    try {
      const response = await fetch('/api/solve', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expression: input.value, algorithm: algorithm.value})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || '요청을 처리하지 못했습니다.');
      lastResult = data; words = data.normalized_expression.match(/[A-Z]+/g) || []; const run = data.runs.find(item => item.algorithm === 'backtracking'); trace = run?.trace || []; index = 0;
      $('mode-label').textContent = trace.length ? '탐색 기록 준비' : '기록 없음';
      if (!run) $('trace-warning').textContent = '완전탐색은 단계별 기록을 제공하지 않습니다. 백트래킹 또는 비교를 선택해 주세요.';
      else if (run.trace_truncated) $('trace-warning').textContent = '기록이 제한되어 탐색의 앞부분만 재생합니다. 최종 결과는 아래에서 확인하세요.';
      else if (!trace.length) $('trace-warning').textContent = '재생할 탐색 기록이 없습니다.';
      render(); showResults(data);
    } catch (error) { $('input-error').textContent = error.message || '서버에 연결할 수 없습니다.'; $('mode-label').textContent = '실행 오류'; }
    finally { $('solve-button').disabled = false; $('solve-button').innerHTML = '풀이 시작 <span aria-hidden="true">↗</span>'; }
  });
  $('prev').addEventListener('click', () => { pause(); if (index > 0) index--; render(); });
  $('next').addEventListener('click', () => { pause(); if (index < trace.length - 1) index++; render(); });
  $('restart').addEventListener('click', () => { pause(); index = 0; render(); });
  function play() { if (!trace.length || index >= trace.length - 1) return; $('play').innerHTML = 'Ⅱ <span>일시정지</span>'; timer = setInterval(() => { if (index < trace.length - 1) { index++; render(); } if (index >= trace.length - 1) { pause(); render(); } }, Number($('speed').value)); updateButtons(); }
  $('play').addEventListener('click', () => { if (timer !== null) { pause(); render(); } else play(); });
  $('speed').addEventListener('change', () => { if (timer !== null) { pause(); play(); } });
  resetPlayback();
})();
