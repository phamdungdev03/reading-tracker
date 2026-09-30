const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const mysql = require('mysql2/promise');

// Opt-in: chỉ tạo/xóa database test tên ngẫu nhiên; không dùng DB_NAME của ứng dụng.
test('MySQL integration: shelf CRUD, duplicate race, rollback and concurrent updates', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async () => {
 require('dotenv').config({quiet:true});
 const database = `reading_tracker_test_${Date.now()}_${process.pid}`;
 const admin = await mysql.createConnection({
  host:process.env.DB_HOST ?? '127.0.0.1', port:Number(process.env.DB_PORT ?? 3307),
  user:process.env.DB_USER ?? 'root', password:process.env.DB_PASSWORD ?? '', multipleStatements:true,
 });
 let server, pool, created=false;
 const realFetch=global.fetch;
 try {
  await admin.query(`CREATE DATABASE \`${database}\``); created=true;
  const schema=readFileSync(resolve(__dirname,'../../database/reading-tracker.sql'),'utf8').split('-- 2. QUERY THAM KHẢO')[0].replaceAll('reading_tracker',database);
  await admin.query(schema);
  process.env.DB_NAME=database;
  ({pool}=require('../dist/config/database'));
  const {app}=require('../dist/app');
  global.fetch=async(url)=>{
   const u=new URL(url);
   if(u.pathname==='/search.json'){
    const workId=u.searchParams.get('q').split('/').at(-1);
    return Response.json({numFound:1,docs:[{key:'/works/'+workId,title:'Integration fixture',author_name:['Test Author'],first_publish_year:2020}]});
   }
   if(u.pathname.endsWith('/editions.json'))return Response.json({entries:[]});
   return Response.json({key:u.pathname.replace('.json',''),title:'Integration fixture',description:'Test only',subjects:['Testing'],covers:[123]});
  };
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const root=`http://127.0.0.1:${server.address().port}/api`;
  const request=async(path,method='GET',body)=>{
   const response=await realFetch(root+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,body:response.status===204?null:await response.json()};
  };
  const input={workId:'OL101W',status:'want_to_read',totalPages:100};
  let result=await request('/shelf','POST',input);
  assert.equal(result.status,201); let item=result.body.data;const id=item.id;
  assert.equal(typeof id,'string');assert.equal(item.currentPage,0);assert.equal(item.startedAt,null);
  assert.match(item.createdAt,/Z$/);
  assert.ok(Math.abs(Date.now()-Date.parse(item.createdAt)) < 120000, 'Stored timestamp must be UTC');
  assert.equal((await request('/shelf','POST',input)).status,409);
  // Two simultaneous requests for a new Work must create just one shelf row.
  const raced=await Promise.all([request('/shelf','POST',{...input,workId:'OL102W',status:'reading'}),request('/shelf','POST',{...input,workId:'OL102W',status:'reading'})]);
  assert.deepEqual(raced.map(r=>r.status).sort(),[201,409]);
  assert.ok(raced.find(r=>r.status===201).body.data.startedAt);
  result=await request('/shelf','POST',{...input,workId:'OL103W',status:'completed'});
  assert.equal(result.status,201);assert.equal(result.body.data.currentPage,100);assert.equal(result.body.data.startedAt,null);assert.ok(result.body.data.finishedAt);
  result=await request('/shelf?status=reading');
  assert.equal(result.body.data.items.length,1);assert.deepEqual(result.body.data.stats,{total:3,reading:1,completed:1});
  // Row lock prevents a partial update from losing another request's changes.
  const edits=await Promise.all([request('/shelf/'+id,'PATCH',{currentPage:29}),request('/shelf/'+id,'PATCH',{rating:5,notes:'Keep this note'})]);
  assert.ok(edits.every(r=>r.status===200));
  item=(await request('/shelf')).body.data.items.find(x=>x.id===id);
  assert.equal(item.currentPage,29);assert.equal(item.progressPercent,29);assert.equal(item.rating,5);assert.equal(item.notes,'Keep this note');const start=item.startedAt;
  result=await request('/shelf/'+id,'PATCH',{currentPage:101});assert.equal(result.status,400);
  item=(await request('/shelf/'+id,'PATCH',{currentPage:100})).body.data;
  assert.equal(item.status,'completed');assert.equal(item.startedAt,start);const finish=item.finishedAt;
  item=(await request('/shelf/'+id,'PATCH',{status:'completed',rating:null})).body.data;assert.equal(item.finishedAt,finish);
  item=(await request('/shelf/'+id,'PATCH',{status:'reading'})).body.data;
  assert.equal(item.currentPage,0);assert.equal(item.startedAt,start);assert.equal(item.finishedAt,null);
  // Force CHECK failure after books insert: the transaction must remove new metadata.
  const {insertShelfBook}=require('../dist/repositories/shelf.repository');
  await assert.rejects(()=>insertShelfBook({workId:'OL104W',title:'Rollback',authors:[],coverUrl:null,firstPublishYear:null,description:null,subjects:[],suggestedTotalPages:null,suggestedEditionId:null},{workId:'OL104W',status:'reading',totalPages:0}));
  const [rollbackRows]=await admin.query(`SELECT id FROM \`${database}\`.books WHERE open_library_work_id='OL104W'`);assert.equal(rollbackRows.length,0);
  assert.equal((await request('/shelf/'+id,'DELETE')).status,204);
  assert.equal((await request('/shelf/'+id,'DELETE')).status,404);
  assert.equal((await request('/shelf/'+id,'PATCH',{notes:'missing'})).status,404);
  result=await request('/books/OL101W');assert.equal(result.status,200);assert.equal(result.body.data.inShelf,false);
  // Stored snapshot allows re-add without any external request, resetting personal fields.
  global.fetch=async()=>{throw new Error('Must use snapshot')};
  result=await request('/shelf','POST',input);assert.equal(result.status,201);
  assert.notEqual(result.body.data.id,id);assert.equal(result.body.data.rating,null);assert.equal(result.body.data.notes,null);assert.equal(result.body.data.currentPage,0);
  const largeId='9007199254740993';
  await admin.execute(`UPDATE \`${database}\`.shelf_books SET id = ? WHERE id = ?`,[largeId,result.body.data.id]);
  result=await request('/shelf/'+largeId,'PATCH',{notes:null,rating:null});
  assert.equal(result.status,200);assert.equal(result.body.data.id,largeId);assert.equal(result.body.data.notes,null);
  assert.equal((await request('/shelf/'+largeId,'DELETE')).status,204);
  console.log('Isolated MySQL integration passed; application database untouched.');
 }finally{
  global.fetch=realFetch;
  if(server)await new Promise(r=>server.close(r));
  if(pool)await pool.end();
  try{if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}
 }
});
