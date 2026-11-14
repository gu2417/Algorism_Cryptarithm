const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {JSDOM} = require('jsdom');
const python = process.env.CRYPTARITHM_TEST_PYTHON || ['.venv/Scripts/python.exe', '.venv/bin/python.exe'].find(p => fs.existsSync(p)) || 'python';
function response(expression = 'A + B = C', algorithm = 'backtracking', config = {}) {
  const source = `import json\nfrom app import create_app\nconfig=json.loads(${JSON.stringify(JSON.stringify(config))})\npayload=json.loads(${JSON.stringify(JSON.stringify({expression,algorithm}))})\nprint(json.dumps(create_app(config).test_client().post('/api/solve',json=payload).get_json()))`;
  const result = spawnSync(python, ['-c', source], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function setup(data, fillDefault = true, fullView = true) {
  const dom = new JSDOM(fs.readFileSync('templates/index.html','utf8'), {runScripts:'outside-only', url:'http://localhost/'});
  const w = dom.window, timers = new Map(); let nextTimer = 0, calls = 0;
  w.setInterval = callback => {timers.set(++nextTimer, callback); return nextTimer;};
  w.clearInterval = id => timers.delete(id);
  w.fetch = async () => {calls++; return {ok:true,json:async()=>data};};
  w.eval(fs.readFileSync('static/js/app.js','utf8'));
  const el = id => w.document.getElementById(id);
  if (fillDefault) el('expression').value = 'I + BB = ILL';
  // Existing tests explicitly exercise detailed summary/full modes; story tests keep the new default.
  const submit = async () => {el('solve-form').dispatchEvent(new w.Event('submit',{cancelable:true})); await new Promise(setImmediate); if(fullView!=='story' && el('trace-view')) { const selects=fullView?[el('trace-view')]:[...w.document.querySelectorAll('[id$="trace-view"]')];for(const select of selects){select.value=fullView?'full':'summary';select.dispatchEvent(new w.Event('change'));} }};
  return {dom,w,el,submit,timers,get calls(){return calls;},tick(){[...timers.values()].forEach(fn=>fn());}};
}
const data = response();
test('presentation summary is the default and shows real scenes with readable explanations',async()=>{
  const source=response('I + BB = ILL','backtracking',{TRACE_LIMIT:2});const ui=setup(source,true,'story');
  assert.equal(ui.el('trace-view').value,'story');await ui.submit();const root=ui.el('player-backtracking');
  assert.ok(root.classList.contains('story-mode'));assert.equal(root.querySelector('.story-card').hidden,false);
  assert.equal(root.querySelectorAll('.story-nav button').length,source.runs[0].presentation_scenes.length);
  assert.match(root.querySelector('.story-title').textContent,/문자/);ui.dom.window.close();
});
test('story has structure explanations and a dedicated automatic playback control',async()=>{
  const source=response('I + BB = ILL','backtracking',{TRACE_LIMIT:2});const ui=setup(source,true,'story');await ui.submit();const root=ui.el('player-backtracking');const auto=root.querySelector('.story-auto');
  assert.match(root.querySelector('.story-explanation').textContent,/구조 설명.*세로셈/);
  assert.doesNotMatch(root.querySelector('.story-card').textContent,/발표 포인트/);
  assert.equal(auto.disabled,false);assert.match(auto.textContent,/자동 재생/);assert.equal(ui.timers.size,0);
  auto.click();assert.equal(ui.timers.size,1);assert.equal(auto.getAttribute('aria-pressed'),'true');ui.tick();assert.match(ui.el('step-number').textContent,/^2 \/ /);
  auto.click();assert.equal(ui.timers.size,0);assert.equal(auto.getAttribute('aria-pressed'),'false');
  auto.click();for(let i=0;i<source.runs[0].presentation_scenes.length;i++)ui.tick();assert.equal(ui.timers.size,0);assert.equal(ui.el('next').disabled,true);assert.match(auto.textContent,/다시 자동 재생/);
  auto.click();assert.equal(ui.timers.size,1);assert.match(ui.el('step-number').textContent,/^1 \/ /);ui.el('next').click();assert.equal(ui.timers.size,0);ui.dom.window.close();
});
test('presentation scenes are replaced completely when switching examples',async()=>{
  const first=response('I + BB = ILL','backtracking',{TRACE_LIMIT:2}),second=response('SEND + MORE = MONEY','backtracking',{TRACE_LIMIT:2});
  const ui=setup(first,true,'story');await ui.submit();ui.el('player-backtracking').querySelector('.story-auto').click();
  [...ui.w.document.querySelectorAll('[data-example]')].find(button=>button.dataset.example==='SEND + MORE = MONEY').click();
  ui.w.fetch=async()=>({ok:true,json:async()=>second});await ui.submit();const root=ui.el('player-backtracking');
  assert.equal(root.querySelector('.story-formula').textContent,'SEND + MORE = MONEY');
  assert.equal(root.querySelectorAll('.story-nav button').length,second.runs[0].presentation_scenes.length);root.querySelector('.story-auto').click();assert.equal(ui.timers.size,1);
  for(let i=0;i<second.runs[0].presentation_scenes.length;i++){ui.tick();assert.equal([...root.querySelectorAll('.digit small')].map(el=>el.textContent).join(''),'SENDMOREMONEY');}
  assert.equal(ui.timers.size,0);ui.dom.window.close();
});
test('presentation scenes support chapter navigation, keyboard and switching to detailed records',async()=>{
  const source=response('I + BB = ILL','backtracking',{TRACE_LIMIT:2});const ui=setup(source,true,'story');await ui.submit();const root=ui.el('player-backtracking');
  const scenes=source.runs[0].presentation_scenes;const calculation=scenes.findIndex(scene=>scene.phase==='자리 계산');assert.ok(calculation>=0);
  root.querySelectorAll('.story-nav button')[calculation].click();assert.equal(root.querySelector('.story-formula').textContent,scenes[calculation].formula);
  assert.equal(ui.w.document.activeElement,root);
  assert.equal(root.querySelector('.story-title').textContent,scenes[calculation].title);
  ui.el('next').dispatchEvent(new ui.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.match(ui.el('step-number').textContent,new RegExp('^'+(calculation+2)+' /'));
  ui.el('trace-view').value='summary';ui.el('trace-view').dispatchEvent(new ui.w.Event('change'));assert.equal(root.classList.contains('story-mode'),false);
  assert.equal(root.querySelector('.story-card').hidden,true);assert.match(ui.el('step-number').textContent,new RegExp('1 / '+source.runs[0].summary_trace.length));ui.dom.window.close();
});
test('switching from I BB ILL to SEND removes the old player handlers and timers',async()=>{
  const first=response('I + BB = ILL','backtracking',{TRACE_LIMIT:2});
  const second=response('SEND + MORE = MONEY','backtracking',{TRACE_LIMIT:2});
  const ui=setup(first,true,false);await ui.submit();
  [...ui.w.document.querySelectorAll('[data-example]')].find(button=>button.dataset.example==='SEND + MORE = MONEY').click();
  ui.w.fetch=async()=>({ok:true,json:async()=>second});await ui.submit();
  ui.el('play').click();assert.equal(ui.timers.size,1,'이전 문제 재생기가 다시 살아나면 안 됨');
  for(let i=0;i<100;i++){
    if(ui.timers.size===0 && !ui.el('next').disabled)ui.el('play').click();
    ui.tick();
    const letters=[...ui.el('equation').querySelectorAll('.digit small')].map(el=>el.textContent).join('');
    assert.equal(letters,'SENDMOREMONEY');
    assert.ok(!/[IBL]/.test(ui.el('assignment').textContent));
    assert.ok(ui.timers.size<=1);
    if(ui.el('next').disabled)break;
  }
  ui.dom.window.close();
});
test('repeated example switches keep each current equation isolated in all algorithm modes',async()=>{
  const fixtures=new Map();
  for(const expression of ['I + BB = ILL','SEND + MORE = MONEY'])for(const algorithm of ['backtracking','brute_force','compare'])fixtures.set(expression+'|'+algorithm,response(expression,algorithm,{TRACE_LIMIT:2}));
  const ui=setup(fixtures.get('I + BB = ILL|backtracking'),true,false);
  ui.w.fetch=async(url,options)=>{const request=JSON.parse(options.body);return {ok:true,json:async()=>structuredClone(fixtures.get(request.expression+'|'+request.algorithm))};};
  for(const algorithm of ['backtracking','brute_force','compare'])for(const expression of ['I + BB = ILL','SEND + MORE = MONEY','I + BB = ILL','SEND + MORE = MONEY']){
    [...ui.w.document.querySelectorAll('[data-example]')].find(button=>button.dataset.example===expression).click();
    ui.el('algorithm').value=algorithm;ui.el('algorithm').dispatchEvent(new ui.w.Event('change'));assert.equal(ui.timers.size,0);
    await ui.submit();const roots=[...ui.w.document.querySelectorAll('.lab')];
    for(const root of roots)root.querySelector('[id$="play"]').click();assert.equal(ui.timers.size,roots.length);
    for(let tick=0;tick<15;tick++){
      ui.tick();
      for(const root of roots){
        assert.equal([...root.querySelectorAll('.digit small')].map(el=>el.textContent).join(''),expression.replace(/[^A-Z]/g,''));
        const play=root.querySelector('[id$="play"]');if(play.textContent.includes('다음 장면'))play.click();
      }
      assert.ok(ui.timers.size<=roots.length);
    }
  }
  ui.dom.window.close();
});
test('summary gives assignments and checks readable dwell time and stops before the final reveal',async()=>{
  const ui=setup(data,true,false);await ui.submit();const delays=[];const original=ui.w.setInterval;
  ui.w.setInterval=(fn,delay)=>{delays.push(delay);return original(fn,delay);};
  ui.el('play').click();assert.equal(delays.at(-1),1000);ui.el('play').click();
  const events=data.runs[0].summary_trace;const check=events.findIndex(event=>event.type==='column_calculation');assert.ok(check>=0);
  for(let i=0;i<check;i++)ui.el('next').click();ui.el('play').click();assert.equal(delays.at(-1),1500);ui.el('play').click();
  while(!ui.el('next').disabled)ui.el('next').click();ui.el('prev').click();const before=ui.el('step-number').textContent;
  ui.el('play').click();ui.tick();assert.equal(ui.timers.size,0);assert.equal(ui.el('step-number').textContent,before);
  ui.el('play').click();assert.equal(ui.timers.size,0);assert.equal(ui.el('next').disabled,true);assert.match(ui.el('playback-outcome').textContent,/탐색이 끝났습니다/);
  ui.el('play').click();assert.equal(ui.timers.size,1);assert.match(ui.el('step-number').textContent,/^1 \/ /);ui.dom.window.close();
});
test('all five examples and both algorithms pause at summary gaps without losing manual navigation',async()=>{
  for(const expression of ['I + BB = ILL','SEND + MORE = MONEY','A + A = A','A + B = C','A + B = AA']) {
    for(const algorithm of ['backtracking','brute_force']) {
      const result=response(expression,algorithm,{TRACE_LIMIT:2});assert.equal(result.runs[0].status,'complete');
      const ui=setup(result,true,false);await ui.submit();const events=result.runs[0].summary_trace;
      const boundary=events.findIndex((event,i)=>i>0&&event.seq>events[i-1].seq+1);
      if(boundary>0) {
        for(let i=0;i<boundary-1;i++)ui.el('next').click();const before=ui.el('step-number').textContent;
        ui.el('play').click();ui.tick();assert.equal(ui.timers.size,0,expression+algorithm);assert.equal(ui.el('step-number').textContent,before);
        ui.el('restart').click();ui.el('play').click();assert.match(ui.el('step-number').textContent,/^1 \/ /);ui.el('play').click();
      }
      while(!ui.el('next').disabled)ui.el('next').click();assert.match(ui.el('playback-outcome').textContent,/탐색이 끝났습니다/);
      assert.equal(events.at(-1).type,'finish');ui.dom.window.close();
    }
  }
});
test('summary pauses before omitted work and resumes the next continuous scene explicitly',async()=>{
  const ui=setup(data,true,false);await ui.submit();const events=data.runs[0].summary_trace;
  const boundary=events.findIndex((event,i)=>i>0&&event.seq>events[i-1].seq+1);assert.ok(boundary>0);
  for(let i=0;i<boundary-1;i++)ui.el('next').click();const before=ui.el('step-number').textContent;
  ui.el('play').click();ui.tick();assert.equal(ui.timers.size,0);assert.equal(ui.el('step-number').textContent,before);
  assert.match(ui.el('play').textContent,/다음 장면/);assert.match(ui.w.document.querySelector('.summary-scene').textContent,/생략.*다음 장면/);
  ui.el('play').click();assert.equal(ui.timers.size,1);assert.match(ui.el('step-number').textContent,new RegExp('^'+(boundary+1)+' /'));
  ui.el('restart').click();assert.equal(ui.timers.size,0);assert.match(ui.el('step-number').textContent,/^1 \/ /);ui.dom.window.close();
});
test('paged full replay crosses buffer boundaries and reaches the actual last event',async()=>{
  const source=response('I + BB = ILL','backtracking');const compact=structuredClone(source);
  Object.assign(compact.runs[0],{trace:[],trace_paged:true,trace_token:'paged',trace_total:source.runs[0].trace.length});
  const ui=setup(compact,true,false);await ui.submit();const offsets=[];
  ui.w.fetch=async url=>{const parsed=new URL(url,'http://localhost');const offset=Number(parsed.searchParams.get('offset'));offsets.push(offset);return {ok:true,json:async()=>({offset,total:879,trace:source.runs[0].trace.slice(offset,offset+200)})};};
  ui.el('trace-view').value='full';ui.el('trace-view').dispatchEvent(new ui.w.Event('change'));await new Promise(setImmediate);
  assert.match(ui.el('step-number').textContent,/^1 \/ 879$/);
  for(let i=0;i<199;i++)ui.el('next').click();assert.match(ui.el('step-number').textContent,/^200 \/ 879$/);
  ui.el('next').click();await new Promise(setImmediate);assert.match(ui.el('step-number').textContent,/^201 \/ 879$/);
  assert.equal(ui.el('playback-outcome').hidden,true);
  ui.el('player-backtracking').querySelector('.trace-jump button:last-child').click();await new Promise(setImmediate);
  assert.match(ui.el('step-number').textContent,/^879 \/ 879$/);assert.match(ui.el('playback-outcome').textContent,/탐색이 끝났습니다/);
  assert.equal(ui.el('trace-warning').textContent,'');ui.el('play').click();await new Promise(setImmediate);
  assert.match(ui.el('step-number').textContent,/^1 \/ 879$/);assert.equal(ui.timers.size,1);assert.ok(offsets.includes(200));ui.dom.window.close();
});
test('comparison can recompute one algorithm without changing the other player',async()=>{
  const both=response('A + A = A','compare');const ui=setup(both,true,false);await ui.submit();
  ui.el('next').click();const before=ui.el('step-number').textContent;
  const requests=[];ui.w.fetch=async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({runs:[both.runs.find(run=>run.algorithm==='brute_force')]})};};
  ui.el('player-brute').querySelector('.player-solve').click();await new Promise(setImmediate);
  assert.equal(requests.length,1);assert.equal(requests[0].algorithm,'brute_force');assert.equal(requests[0].trace_view,'summary');
  assert.equal(ui.el('step-number').textContent,before);assert.match(ui.el('brute-step-number').textContent,/^1 \/ /);ui.dom.window.close();
});
test('full trace is fetched only on demand and expired records retain usable summary',async()=>{
  const compact=structuredClone(data);compact.runs[0].trace_token='test-token';compact.runs[0].trace=[];
  const ui=setup(compact,true,false);await ui.submit();assert.equal(ui.calls,1);
  let calls=0;ui.w.fetch=async url=>{calls++;assert.equal(url,'/api/traces/test-token');return {ok:false,json:async()=>({error:{message:'기록 만료'}})};};
  ui.el('trace-view').value='full';ui.el('trace-view').dispatchEvent(new ui.w.Event('change'));await new Promise(setImmediate);
  assert.equal(calls,1);assert.equal(ui.el('trace-view').value,'summary');assert.match(ui.el('trace-warning').textContent,/만료/);assert.equal(ui.el('play').disabled,false);ui.dom.window.close();
});
test('presentation view can be entered and exited',()=>{
  const ui=setup(data);ui.w.scrollTo=()=>{};ui.el('presentation-toggle').click();assert.ok(ui.w.document.body.classList.contains('presentation'));
  ui.el('presentation-toggle').click();assert.equal(ui.w.document.body.classList.contains('presentation'),false);ui.dom.window.close();
});
test('full trace fetch restores original events without recomputing the solution',async()=>{
  const compact=structuredClone(data);compact.runs[0].trace_token='saved';compact.runs[0].trace=[];
  const ui=setup(compact,true,false);await ui.submit();let fetches=0;
  ui.w.fetch=async url=>{fetches++;assert.equal(url,'/api/traces/saved');return {ok:true,json:async()=>({trace:data.runs[0].trace})};};
  ui.el('trace-view').value='full';ui.el('trace-view').dispatchEvent(new ui.w.Event('change'));await new Promise(setImmediate);
  assert.match(ui.el('step-number').textContent,new RegExp('1 / '+data.runs[0].trace.length.toLocaleString()));
  ui.el('trace-view').value='summary';ui.el('trace-view').dispatchEvent(new ui.w.Event('change'));
  ui.el('trace-view').value='full';ui.el('trace-view').dispatchEvent(new ui.w.Event('change'));assert.equal(fetches,1);ui.dom.window.close();
});
test('real API trace restores previous and restart snapshots', async () => {
  const ui=setup(data); await ui.submit();
  const initial=ui.el('equation').textContent;
  for(let i=0;i<4;i++)ui.el('next').click();
  assert.notEqual(ui.el('equation').textContent,initial);
  ui.el('prev').click();
  assert.match(ui.el('step-number').textContent,/4 \/ /);
  ui.el('restart').click();
  assert.equal(ui.el('equation').textContent,initial);
  assert.equal(ui.calls,1); ui.dom.window.close();
});

test('initial input is empty and example choices do not execute a solve',async()=>{
  const ui=setup(data,false);assert.equal(ui.el('expression').value,'');
  await ui.submit();assert.equal(ui.calls,0);assert.ok(ui.el('input-error').textContent);
  const examples=[...ui.w.document.querySelectorAll('[data-example]')];assert.ok(examples.length>2);
  examples[2].click();assert.equal(ui.el('expression').value,examples[2].dataset.example);assert.equal(ui.calls,0);ui.dom.window.close();
});
test('summary uses real ordered events and mode switches stop replay',async()=>{
  const run=data.runs[0];const ui=setup(data,true,false);await ui.submit();
  const mode=ui.el('trace-view');assert.ok(mode);assert.equal(mode.value,'summary');
  const total=run.trace.length;let count=Number(ui.el('step-number').textContent.split('/')[1].trim().replaceAll(',',''));
  assert.ok(count<total);assert.match(ui.el('trace-summary-info').textContent,/생략/);
  let previous=-1;
  for(let i=0;i<count;i++){
    const selected=ui.w.document.querySelector('.trace-list .selected .trace-index');
    assert.equal(Number(selected.textContent),i+1);
    const seq=Number(selected.parentElement.dataset.sourceStep)-1;assert.ok(seq>previous);assert.ok(run.trace.some(e=>e.seq===seq));previous=seq;
    if(i<count-1)ui.el('next').click();
  }
  mode.value='full';mode.dispatchEvent(new ui.w.Event('change'));assert.match(ui.el('step-number').textContent,new RegExp('1 / '+total.toLocaleString()));
  ui.el('play').click();assert.equal(ui.timers.size,1);mode.value='summary';mode.dispatchEvent(new ui.w.Event('change'));assert.equal(ui.timers.size,0);assert.match(ui.el('step-number').textContent,/^1 \/ /);ui.dom.window.close();
});
test('replay starts again at the first step after reaching the end',async()=>{
  const ui=setup(response('A + A = A','backtracking'),true,false);await ui.submit();
  while(!ui.el('next').disabled)ui.el('next').click();
  assert.equal(ui.el('play').disabled,false);assert.match(ui.el('play').textContent,/다시/);
  ui.el('play').click();assert.match(ui.el('step-number').textContent,/^1 \/ /);assert.equal(ui.timers.size,1);
  ui.tick();assert.match(ui.el('step-number').textContent,/^2 \/ /);ui.dom.window.close();
});
test('replay on one comparison panel leaves the other panel untouched',async()=>{
  const ui=setup(response('A + A = A','compare'),true,false);await ui.submit();
  ui.el('next').click();const before=ui.el('step-number').textContent;
  while(!ui.el('brute-next').disabled)ui.el('brute-next').click();
  ui.el('brute-play').click();assert.match(ui.el('brute-step-number').textContent,/^1 \/ /);
  assert.equal(ui.el('step-number').textContent,before);ui.dom.window.close();
});
test('a one-event trace can be replayed without starting a timer',async()=>{
  const ui=setup(response('A + A = A','backtracking',{TRACE_LIMIT:1}),true,true);await ui.submit();
  assert.equal(ui.el('play').disabled,false);assert.match(ui.el('play').textContent,/다시/);
  ui.el('play').click();assert.match(ui.el('step-number').textContent,/^1 \/ 1$/);
  assert.equal(ui.timers.size,0);assert.equal(ui.calls,1);ui.dom.window.close();
});
test('summary includes real solution and finish even when full trace is truncated',async()=>{
  const result=response('A + B = C','backtracking',{TRACE_LIMIT:2});
  const ui=setup(result,true,false);await ui.submit();
  assert.match(ui.el('trace-warning').textContent,/전체 보기/);
  assert.ok(result.runs[0].summary_trace.some(event=>event.type==='solution'));
  assert.equal(result.runs[0].summary_trace.at(-1).type,'finish');
  assert.equal(result.runs[0].trace_truncated,true);
  assert.match(ui.el('results-content').textContent,/정답/);ui.dom.window.close();
});
test('summary can be selected for each comparison run',async()=>{
  const result=response('A + A = A','compare');const ui=setup(result,true,false);await ui.submit();
  for(const prefix of ['', 'brute-']) {
    assert.equal(ui.el(prefix+'trace-view').value,'summary');
    assert.match(ui.el(prefix+'trace-summary-info').textContent,/생략/);
    assert.match(ui.el(prefix+'step-number').textContent,/^1 \/ /);
  }
  ui.dom.window.close();
});
test('play, pause, speed change and end maintain one timer',async()=>{
  const ui=setup(data);await ui.submit();ui.el('play').click();assert.equal(ui.timers.size,1);
  ui.tick();assert.match(ui.el('step-number').textContent,/2 \/ /);
  ui.el('speed').value='100';ui.el('speed').dispatchEvent(new ui.w.Event('change'));assert.equal(ui.timers.size,1);
  ui.el('play').click();assert.equal(ui.timers.size,0);
  ui.el('play').click();for(let i=0;i<data.runs[0].trace.length;i++)ui.tick();
  assert.equal(ui.timers.size,0);assert.equal(ui.el('next').disabled,true);ui.dom.window.close();
});
test('examples only fill input, invalid input never reaches API',async()=>{
  const ui=setup(data);ui.w.document.querySelector('[data-example]').click();assert.equal(ui.calls,0);
  ui.el('expression').value='A - B = C';await ui.submit();assert.equal(ui.calls,0);assert.ok(ui.el('input-error').textContent);ui.dom.window.close();
});
test('multiple solutions are selectable without changing trace',async()=>{
  const ui=setup(data);await ui.submit();const select=ui.w.document.querySelector('.solution-select select');
  const before=ui.w.document.querySelector('.solution-value').textContent;select.value='1';select.dispatchEvent(new ui.w.Event('change'));
  assert.notEqual(ui.w.document.querySelector('.solution-value').textContent,before);assert.match(ui.el('step-number').textContent,/1 \/ /);ui.dom.window.close();
});
test('partial results and trace truncation have separate notices',async()=>{
  const ui=setup(response('A + B = C','backtracking',{SOLUTION_LIMIT:2,TRACE_LIMIT:1}));await ui.submit();
  assert.match(ui.el('results-content').textContent,/2개 이상/);assert.match(ui.el('trace-warning').textContent,/앞부분/);ui.dom.window.close();
});
test('complete no-solution and brute-force response remain usable',async()=>{
  const ui=setup(response('A + B = AA','brute_force'));await ui.submit();assert.match(ui.el('results-content').textContent,/정답 0개/);
  assert.equal(ui.el('play').disabled,false);assert.match(ui.el('mode-label').textContent,/완전탐색/);ui.dom.window.close();
});
test('compare shows both algorithms and their independent states',async()=>{
  const ui=setup(response('A + A = A','compare'));await ui.submit();assert.equal(ui.w.document.querySelectorAll('.result-panel').length,2);ui.dom.window.close();
});
test('duplicate submits while request pending produce one request',async()=>{
  const ui=setup(data);let resolve;ui.w.fetch=()=>{return new Promise(r=>{resolve=r;});};
  let calls=0;const original=ui.w.fetch;ui.w.fetch=(...args)=>{calls++;return original(...args);};
  ui.el('solve-form').dispatchEvent(new ui.w.Event('submit',{cancelable:true}));
  ui.el('solve-form').dispatchEvent(new ui.w.Event('submit',{cancelable:true}));
  assert.equal(calls,1);resolve({ok:true,json:async()=>data});await new Promise(setImmediate);ui.dom.window.close();
});
test('network errors release busy state and permit retry',async()=>{
  const ui=setup(data);ui.w.fetch=async()=>{throw new Error('연결 실패');};await ui.submit();
  assert.equal(ui.el('solve-button').disabled,false);assert.match(ui.el('input-error').textContent,/연결 실패/);
  ui.w.fetch=async()=>({ok:true,json:async()=>data});await ui.submit();assert.match(ui.el('results-content').textContent,/정답/);ui.dom.window.close();
});
test('server validation errors appear and timeout is not called no-solution',async()=>{
  const ui=setup(response('A + B = C','backtracking',{TIME_LIMIT_SECONDS:0}));await ui.submit();
  assert.match(ui.el('results-content').textContent,/시간 제한/);assert.doesNotMatch(ui.el('results-content').textContent,/모든 허용 후보/);
  ui.w.fetch=async()=>({ok:false,json:async()=>({error:{message:'수식 오류'}})});await ui.submit();assert.equal(ui.el('input-error').textContent,'수식 오류');ui.dom.window.close();
});

test('pending solve locks inputs and restores them after success',async()=>{
  const ui=setup(data);let resolve;
  ui.w.fetch=()=>new Promise(r=>{resolve=r;});
  ui.el('solve-form').dispatchEvent(new ui.w.Event('submit',{cancelable:true}));
  const example=ui.w.document.querySelector('[data-example]');
  assert.equal(ui.el('expression').disabled,true);
  assert.equal(ui.el('algorithm').disabled,true);
  assert.equal(example.disabled,true);
  const original=ui.el('expression').value;example.click();assert.equal(ui.el('expression').value,original);
  resolve({ok:true,json:async()=>data});await new Promise(setImmediate);
  assert.equal(ui.el('expression').disabled,false);assert.equal(ui.el('algorithm').disabled,false);assert.equal(example.disabled,false);
  ui.dom.window.close();
});
test('editing input, selecting example or changing algorithm clears stale result',async()=>{
  for(const change of ['input','example','algorithm']){
    const ui=setup(data);await ui.submit();assert.match(ui.el('results-content').textContent,/정답/);
    if(change==='input'){ui.el('expression').value='B + B = C';ui.el('expression').dispatchEvent(new ui.w.Event('input'));}
    if(change==='example')ui.w.document.querySelectorAll('[data-example]')[1].click();
    if(change==='algorithm'){ui.el('algorithm').value='compare';ui.el('algorithm').dispatchEvent(new ui.w.Event('change'));}
    assert.match(ui.el('results-content').textContent,/아직 실행된 문제가 없습니다/);
    assert.equal(ui.el('play').disabled,true);ui.dom.window.close();
  }
});
test('controls are restored after a failed request',async()=>{
  const ui=setup(data);ui.w.fetch=async()=>{throw new Error('offline');};await ui.submit();
  assert.equal(ui.el('expression').disabled,false);assert.equal(ui.el('algorithm').disabled,false);
  assert.ok([...ui.w.document.querySelectorAll('[data-example]')].every(button=>!button.disabled));ui.dom.window.close();
});

test('trace text and selected step maintain readable contrast',async()=>{
  const ui=setup(data);
  const style=ui.w.document.createElement('style');style.textContent=fs.readFileSync('static/css/style.css','utf8');ui.w.document.head.append(style);
  await ui.submit();
  const rgb=value=>{const values=value.match(/[\d.]+/g);assert.ok(values,`Invalid color: ${value}`);return values.slice(0,3).map(Number);};
  const luminance=color=>{const channels=color.map(n=>{const c=n/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];};
  const ratio=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  const contrast=(text,background)=>ratio(rgb(ui.w.getComputedStyle(text).color),rgb(ui.w.getComputedStyle(background).backgroundColor));
  const side=ui.w.document.querySelector('.lab-side');
  for(const selector of ['.trace-heading','.trace-empty','.event-detail','.legend']){
    const element=ui.w.document.querySelector(selector);if(element)assert.ok(contrast(element,side)>=4.5,selector);
  }
  const selected=ui.w.document.querySelector('.trace-list .selected .trace-item');
  assert.ok(contrast(selected.querySelector('.trace-index'),selected)>=4.5,'selected trace index');
  ui.dom.window.close();
});


test('compare mode displays and replays both traces independently',async()=>{
  const ui=setup(response('A + A = A','compare'));await ui.submit();
  assert.match(ui.el('mode-label').textContent,/백트래킹/);
  assert.match(ui.el('brute-mode-label').textContent,/완전탐색/);
  ui.el('play').click();assert.equal(ui.timers.size,1);
  ui.tick();assert.match(ui.el('step-number').textContent,/2 \/ /);
  ui.el('brute-next').click();assert.match(ui.el('brute-step-number').textContent,/2 \/ /);
  assert.equal(ui.timers.size,1);
  ui.el('brute-play').click();assert.equal(ui.timers.size,2);
  ui.el('brute-speed').value='100';ui.el('brute-speed').dispatchEvent(new ui.w.Event('change'));
  assert.equal(ui.el('speed').value,'500');assert.equal(ui.timers.size,2);
  ui.el('brute-trace-view').value='full';ui.el('brute-trace-view').dispatchEvent(new ui.w.Event('change'));
  assert.equal(ui.timers.size,1);assert.match(ui.el('step-number').textContent,/2 \/ /);
  ui.dom.window.close();
});

test('completion displays final solution, while truncated trace never claims completion',async()=>{
  const complete=setup(response('A + A = A','backtracking'),true,false);await complete.submit();
  while(!complete.el('next').disabled)complete.el('next').click();
  assert.match(complete.el('event-description').textContent,/탐색이 끝났습니다/);
  assert.match(complete.el('assignment').textContent,/A\s*=\s*0/);
  assert.match(complete.el('equation').textContent,/0/);complete.dom.window.close();
  const truncated=setup(response('A + B = C','backtracking',{TRACE_LIMIT:2}),true,false);await truncated.submit();
  while(!truncated.el('next').disabled)truncated.el('next').click();
  assert.match(truncated.el('event-description').textContent,/탐색이 끝났습니다/);
  assert.match(truncated.el('trace-warning').textContent,/전체 보기/);
  assert.match(truncated.el('playback-outcome').textContent,/탐색이 끝났습니다/);
  assert.match(truncated.el('playback-outcome').textContent,/최종 정답/);truncated.dom.window.close();
});
test('limited search never displays completion after trace replay',async()=>{
  const ui=setup(response('A + B = C','brute_force',{SOLUTION_LIMIT:2}),true,false);await ui.submit();
  while(!ui.el('next').disabled)ui.el('next').click();
  assert.match(ui.el('playback-outcome').textContent,/제한으로 탐색이 중단/);
  assert.doesNotMatch(ui.el('playback-outcome').textContent,/탐색이 끝났습니다/);ui.dom.window.close();
});
test('limited brute-force replay displays a real found solution without claiming completion',async()=>{
  const result=response('SEND + MORE = MONEY','brute_force',{SOLUTION_LIMIT:1, TIME_LIMIT_SECONDS:10, TRACE_LIMIT:100});
  assert.equal(result.runs[0].status,'solution_limit');assert.equal(result.runs[0].solutions[0].numeric_expression,'9567 + 1085 = 10652');
  const ui=setup(result,true,false);await ui.submit();
  while(!ui.el('next').disabled)ui.el('next').click();
  assert.match(ui.el('playback-outcome').textContent,/발견한 정답: 9567 \+ 1085 = 10652/);
  assert.match(ui.el('playback-outcome').textContent,/중단/);
  assert.doesNotMatch(ui.el('playback-outcome').textContent,/탐색이 끝났습니다/);ui.dom.window.close();
});
test('completed no-solution search clearly reports no solution',async()=>{
  const ui=setup(response('A + B = AA','backtracking'),true,false);await ui.submit();
  while(!ui.el('next').disabled)ui.el('next').click();
  assert.match(ui.el('event-description').textContent,/탐색이 끝났습니다/);
  assert.match(ui.el('event-detail').textContent,/정답.*없/);ui.dom.window.close();
});
test('editing a comparison clears both players and stops both timers',async()=>{
  const ui=setup(response('A + A = A','compare'),true,false);await ui.submit();
  const ids=[...ui.w.document.querySelectorAll('[id]')].map(element=>element.id);
  assert.equal(new Set(ids).size,ids.length);
  ui.el('play').click();ui.el('brute-play').click();assert.equal(ui.timers.size,2);
  ui.el('expression').value='B + B = B';ui.el('expression').dispatchEvent(new ui.w.Event('input'));
  assert.equal(ui.timers.size,0);assert.equal(ui.el('player-brute'),null);
  assert.match(ui.el('results-content').textContent,/아직 실행된 문제가 없습니다/);ui.dom.window.close();
});
