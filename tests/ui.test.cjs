const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {JSDOM} = require('jsdom');
const python = ['.venv/Scripts/python.exe', '.venv/bin/python.exe'].find(p => fs.existsSync(p)) || 'python';
function response(expression = 'A + B = C', algorithm = 'backtracking', config = {}) {
  const source = `import json\nfrom app import create_app\nconfig=json.loads(${JSON.stringify(JSON.stringify(config))})\npayload=json.loads(${JSON.stringify(JSON.stringify({expression,algorithm}))})\nprint(json.dumps(create_app(config).test_client().post('/api/solve',json=payload).get_json()))`;
  const result = spawnSync(python, ['-c', source], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function setup(data) {
  const dom = new JSDOM(fs.readFileSync('templates/index.html','utf8'), {runScripts:'outside-only', url:'http://localhost/'});
  const w = dom.window, timers = new Map(); let nextTimer = 0, calls = 0;
  w.setInterval = callback => {timers.set(++nextTimer, callback); return nextTimer;};
  w.clearInterval = id => timers.delete(id);
  w.fetch = async () => {calls++; return {ok:true,json:async()=>data};};
  w.eval(fs.readFileSync('static/js/app.js','utf8'));
  const el = id => w.document.getElementById(id);
  const submit = async () => {el('solve-form').dispatchEvent(new w.Event('submit',{cancelable:true})); await new Promise(setImmediate);};
  return {dom,w,el,submit,timers,get calls(){return calls;},tick(){[...timers.values()].forEach(fn=>fn());}};
}
const data = response();
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
  assert.equal(ui.el('play').disabled,true);assert.match(ui.el('trace-warning').textContent,/완전탐색/);ui.dom.window.close();
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
