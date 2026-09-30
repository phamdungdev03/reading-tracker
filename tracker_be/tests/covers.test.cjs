const {test}=require('node:test');
const assert=require('node:assert/strict');
const {app}=require('../dist/app');
const {pool}=require('../dist/config/database');

test('covers: binary response, ID validation, missing image and upstream failures',async()=>{
 const realFetch=global.fetch, realQuery=pool.query;
 const server=app.listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api/covers/`;
 let calls=0;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 pool.query=async()=>{throw new Error('Cover must not use MySQL')};
 global.fetch=async(url)=>{
  calls++;
  const u=new URL(url);
  assert.equal(u.origin,'https://covers.openlibrary.org');
  assert.equal(u.search,'?default=false');
  const id=u.pathname.match(/^\/b\/id\/(\d+)-M.jpg$/)[1];
  if(id==='404') return new Response('',{status:404});
  if(id==='500') return new Response('',{status:500});
  if(id==='504') throw new DOMException('Timeout','TimeoutError');
  if(id==='502') throw new Error('PRIVATE_NETWORK_DETAIL');
  if(id==='2') return new Response('<html>oops</html>',{headers:{'Content-Type':'text/html'}});
  if(id==='3') return new Response(new Uint8Array(2*1024*1024+1),{headers:{'Content-Type':'image/jpeg'}});
  if(id==='4') return new Response('',{headers:{'Content-Type':'image/jpeg'}});
  return new Response(png,{headers:{'Content-Type':'image/png'}});
 };
 try {
  for(const id of ['0','-1','1.5','abc','01','9007199254740992','https%3A%2F%2Fevil.example']) {
   const r=await realFetch(base+id);assert.equal(r.status,400);assert.equal((await r.json()).error.code,'VALIDATION_ERROR');
  }
  assert.equal(calls,0);
  const r=await realFetch(base+'12539702');
  assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');
  assert.equal(r.headers.get('cache-control'),'public, max-age=3600');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
  for(const [id,status,code] of [['404',404,'COVER_NOT_FOUND'],['500',502,'OPEN_LIBRARY_ERROR'],['504',504,'OPEN_LIBRARY_TIMEOUT'],['502',502,'OPEN_LIBRARY_ERROR'],['2',502,'INVALID_COVER'],['3',502,'INVALID_COVER'],['4',502,'INVALID_COVER']]) {
   const r=await realFetch(base+id); assert.equal(r.status,status);
   assert.equal(r.headers.get('cache-control'),null);
   assert.equal((await r.json()).error.code,code);
  }
 }finally{
  global.fetch=realFetch;pool.query=realQuery;
  await new Promise(r=>server.close(r));await pool.end();
 }
});
