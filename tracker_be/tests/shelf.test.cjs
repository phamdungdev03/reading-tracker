const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAddShelf, validatePatchShelf, validateShelfId } = require('../dist/validators/shelf.validator');
const { applyShelfPatch } = require('../dist/services/shelf.service');
const { app } = require('../dist/app');
const { pool } = require('../dist/config/database');
const now = '2026-09-30T10:00:00.000Z';
const originalStart = '2026-09-28T08:00:00.000Z';
const base = { status: 'want_to_read', totalPages: 100, currentPage: 0, startedAt: null, finishedAt: null, rating: null, notes: null };

test('validate shelf input strictly without coercion', () => {
 for (const input of [null, [], {}, {workId:'OL1W',status:'reading',totalPages:'100'}, {workId:'OL1W',status:'reading',totalPages:0}, {workId:'OL1W',status:'bad',totalPages:100}, {workId:'OL1W',status:'reading',totalPages:100,title:'client metadata'}]) {
  assert.throws(()=>validateAddShelf(input),error=>error.status===400);
 }
 for(const input of [{}, {status:'reading',currentPage:0}, {currentPage:-1}, {currentPage:1.5}, {currentPage:null}, {rating:'5'}, {rating:0}, {rating:6}, {notes:'x'.repeat(1001)}, {totalPages:50}]) {
  assert.throws(()=>validatePatchShelf(input),error=>error.status===400);
 }
 assert.deepEqual(validatePatchShelf({rating:null,notes:''}),{rating:null,notes:''});
 for(const id of ['0','-1','1.5','18446744073709551616']) assert.throws(()=>validateShelfId(id));
 assert.equal(validateShelfId('18446744073709551615'),'18446744073709551615');
});

test('reading transitions, dates and idempotency', () => {
 for (const page of [29,57,58]) assert.equal(applyShelfPatch(base,{currentPage:page},now).progressPercent,page);
 let item=applyShelfPatch(base,{currentPage:10},now);
 assert.equal(item.status,'reading'); assert.equal(item.startedAt,now); assert.equal(item.progressPercent,10);
 item=applyShelfPatch(item,{currentPage:100},now);
 assert.equal(item.status,'completed');assert.equal(item.finishedAt,now);
 assert.equal(applyShelfPatch(item,{status:'completed'},'2026-10-01T00:00:00Z').finishedAt,now);
 assert.equal(applyShelfPatch(item,{currentPage:100},'2026-10-01T00:00:00Z').finishedAt,now);
 const reread=applyShelfPatch(item,{status:'reading'},now);
 assert.equal(reread.currentPage,0);assert.equal(reread.finishedAt,null);assert.equal(reread.startedAt,item.startedAt);
 const wanted=applyShelfPatch({...item,startedAt:originalStart},{status:'want_to_read'},now);
 assert.equal(wanted.currentPage,0);assert.equal(wanted.finishedAt,null);assert.equal(wanted.startedAt,originalStart);
 const completed=applyShelfPatch(base,{status:'completed'},now);
 assert.equal(completed.startedAt,null); assert.equal(completed.currentPage,100);
 const reduced=applyShelfPatch(completed,{currentPage:0},now);
 assert.equal(reduced.status,'reading');assert.equal(reduced.startedAt,now);assert.equal(reduced.finishedAt,null);
 assert.equal(applyShelfPatch(base,{currentPage:0},now).status,'want_to_read');
 const edited=applyShelfPatch(item,{rating:5,notes:'hello'},now);
 assert.equal(edited.startedAt,item.startedAt);assert.equal(edited.finishedAt,item.finishedAt);assert.equal(edited.currentPage,100);
 assert.throws(()=>applyShelfPatch(item,{currentPage:101},now),e=>e.status===400);
});

test('HTTP rejects invalid body, malformed JSON, invalid filter and ID',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const baseUrl=`http://127.0.0.1:${server.address().port}/api/shelf`;
 try {
  for(const [path,method,body] of [['','POST','{'],['','POST','{}'],['/1','PATCH','{}'],['/0','DELETE',undefined],['?status=bad','GET',undefined]]) {
   const res=await fetch(baseUrl+path,{method,headers:{'Content-Type':'application/json'},body});
   assert.equal(res.status,400);assert.equal((await res.json()).error.code,'VALIDATION_ERROR');
  }
 }finally{await new Promise(r=>server.close(r));await pool.end();}
});
