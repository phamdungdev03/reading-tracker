const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../dist/app');
const { pool } = require('../dist/config/database');

test('book details: saved snapshot, upstream mapping, missing fields, cache and errors', async () => {
 const realFetch=global.fetch, realQuery=pool.query;
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api/books/`;
 let calls=0, saved=null, membership=false, dbFailure=false;
 pool.query=async options=>{
  if(dbFailure) throw new Error('SECRET');
  assert.match(options.sql,/\?/);
  if(options.sql.includes('LEFT JOIN')) return [saved ? [saved] : [],[]];
  return [membership ? [{open_library_work_id: options.values[0]}] : [],[]];
 };
 global.fetch=async url=>{
  calls++;
  assert.equal(url.hostname,'openlibrary.org');
  if(url.pathname==='/works/OL404W.json') return new Response('',{status:404});
  if(url.pathname==='/works/OL502W.json') return new Response('',{status:500});
  if(url.pathname==='/works/OL504W.json') throw new DOMException('slow','TimeoutError');
  if(url.pathname==='/works/OL500W.json') return Response.json({unexpected:true});
  if(url.pathname==='/search.json') {
   const id=url.searchParams.get('q').split('/').at(-1);
   return Response.json({numFound:1,docs:[{key:'/works/'+id,author_name:['Author'],first_publish_year:2001}]});
  }
  if(url.pathname.endsWith('/editions.json')) return Response.json({entries:url.pathname.includes('OL2W') ? [] : [
   {key:'/books/OL1M',number_of_pages:0},
   {key:'/books/OL2M',number_of_pages:320},
  ]});
  const id=url.pathname.split('/').at(-1).replace('.json','');
  return Response.json(id==='OL2W' ? {key:'/works/'+id,title:'Sparse'} : {
   key:'/works/'+id,title:'Book',description:{value:'Description'},subjects:['Fiction',null],covers:[-1,42],
  });
 };
 try {
  for(const id of ['abc','OL1M','OL0W','OL'+'1'.repeat(35)+'W']) assert.equal((await realFetch(base+id)).status,400);
  assert.equal(calls,0);
  saved={open_library_work_id:'OL1W',title:'Saved',authors:'["Saved Author"]',subjects:['Saved Subject'],cover_id:12,first_publish_year:1999,description:'Snapshot',in_shelf:1};
  let res=await realFetch(base+'OL1W');
  assert.equal(res.status,200);
  let body=(await res.json()).data;
  assert.equal(body.title,'Saved'); assert.equal(body.inShelf,true); assert.deepEqual(body.authors,['Saved Author']); assert.equal(body.suggestedTotalPages,null); assert.equal(calls,0);
  saved.in_shelf=0;
  assert.equal((await (await realFetch(base+'OL1W')).json()).data.inShelf,false);
  saved=null;
  res=await realFetch(base+'OL1W'); assert.equal(res.status,200); body=(await res.json()).data;
  assert.deepEqual(body,{workId:'OL1W',title:'Book',authors:['Author'],coverUrl:'/api/covers/42',firstPublishYear:2001,description:'Description',subjects:['Fiction'],suggestedTotalPages:320,suggestedEditionId:'OL2M',inShelf:false});
  const previous=calls; membership=true;
  assert.equal((await (await realFetch(base+'OL1W')).json()).data.inShelf,true); assert.equal(calls,previous);
  body=(await (await realFetch(base+'OL2W')).json()).data;
  assert.equal(body.description,null); assert.equal(body.coverUrl,null); assert.deepEqual(body.subjects,[]); assert.equal(body.suggestedTotalPages,null);
  for(const [id,status,code] of [['OL404W',404,'BOOK_NOT_FOUND'],['OL502W',502,'OPEN_LIBRARY_ERROR'],['OL504W',504,'OPEN_LIBRARY_TIMEOUT'],['OL500W',502,'OPEN_LIBRARY_ERROR']]) {
   const res=await realFetch(base+id); assert.equal(res.status,status); assert.equal((await res.json()).error.code,code);
  }
  dbFailure=true;
  res=await realFetch(base+'OL1W'); assert.equal(res.status,503); assert.equal((await res.json()).error.code,'DATABASE_UNAVAILABLE');
 } finally {
  global.fetch=realFetch; pool.query=realQuery;
  await new Promise(resolve=>server.close(resolve)); await pool.end();
 }
});
