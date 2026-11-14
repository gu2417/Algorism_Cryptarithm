// Regressions QA-03: final results must not retain waiting/candidate metadata.
// Found by full browser QA on 2026-11-14; report: docs/07-todo-list/final-qa-2026-11-14.md.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const python=process.env.CRYPTARITHM_TEST_PYTHON||'.venv/Scripts/python.exe';
function response(expression,config={}){
  const source=`import json\nfrom app import create_app\nprint(json.dumps(create_app(json.loads(${JSON.stringify(JSON.stringify(config))})).test_client().post('/api/solve',json=json.loads(${JSON.stringify(JSON.stringify({expression,algorithm:'backtracking'}))})).get_json()))`;
  const result=spawnSync(python,['-c',source],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
async function finish(data,view='story'){
  const dom=new JSDOM(fs.readFileSync('templates/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost'}),w=dom.window;
  w.fetch=async()=>({ok:true,json:async()=>data});w.eval(fs.readFileSync('static/js/app.js','utf8'));
  const el=id=>w.document.getElementById(id);el('expression').value=data.normalized_expression;el('solve-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(setImmediate);
  el('trace-view').value=view;el('trace-view').dispatchEvent(new w.Event('change'));let count=0;while(!el('next').disabled&&count++<150)el('next').click();assert.ok(count<150);return {dom,el};
}
test('completed no-solution playback does not show waiting-for-assignment text',async()=>{
  const ui=await finish(response('A + B = AA'));assert.equal(ui.el('column-label').textContent,'탐색 종료');assert.doesNotMatch(ui.el('assignment').textContent,/아직/);assert.match(ui.el('assignment').textContent,/유효한 배정이 없습니다/);ui.dom.window.close();
});
test('completed solution board is labelled as the final answer',async()=>{
  const ui=await finish(response('I + BB = ILL'));assert.equal(ui.el('column-label').textContent,'최종 정답');ui.dom.window.close();
});
test('solution discovery scene is not labelled as waiting for a column',async()=>{
  const data=response('I + BB = ILL');const ui=await finish(data);const index=data.runs[0].presentation_scenes.findIndex(scene=>scene.phase==='정답');ui.el('player-backtracking').querySelectorAll('.story-nav button')[index].click();assert.equal(ui.el('column-label').textContent,'정답 발견');ui.dom.window.close();
});
test('partial result answer does not inherit a truncated candidate column or carry',async()=>{
  const data=response('A + B = C',{TRACE_LIMIT:2,SOLUTION_LIMIT:1});assert.equal(data.runs[0].status,'solution_limit');const ui=await finish(data,'full');assert.equal(ui.el('column-label').textContent,'발견한 정답');assert.equal(ui.el('equation').querySelectorAll('.current').length,0);assert.equal(ui.el('carry').textContent,'자리올림 — → —');ui.dom.window.close();
});
