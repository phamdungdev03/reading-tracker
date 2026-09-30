const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../dist/app');
const { pool } = require('../dist/config/database');

// Stub các hệ thống bên ngoài; gửi HTTP thật vào Express.
test('GET /api/books: validation, normalization, pagination, membership and errors', async () => {
  const realFetch = global.fetch;
  const realQuery = pool.query;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let calls = 0;
  let saved = true;
  global.fetch = async (url) => {
    calls++;
    assert.equal(url.hostname, 'openlibrary.org');
    assert.equal(url.searchParams.get('limit'), '20');
    const q = url.searchParams.get('q');
    if (q === 'upstream-fail') return new Response('', { status: 500 });
    if (q === 'timeout') throw new DOMException('timeout', 'TimeoutError');
    if (q === 'malformed') return Response.json({ docs: [] });
    if (q === 'abc' || q === 'a'.repeat(200)) return Response.json({ docs: [], num_found: 0 });
    if (q === 'empty') return Response.json({ docs: [], num_found: 0 });
    assert.equal(q, 'James Clear');
    assert.equal(url.searchParams.get('page'), '2');
    return Response.json({ numFound: 42, docs: [
      { key: '/works/OL1W', title: 'Atomic Habits', author_name: ['James Clear'], cover_i: 123, first_publish_year: 2018 },
      { key: 'OL2W' },
      { key: '/authors/OL1A' },
    ] });
  };
  pool.query = async (options) => {
    assert.match(options.sql, /JOIN shelf_books/);
    assert.match(options.sql, /IN \(\?, \?\)/);
    assert.deepEqual(options.values, ['OL1W', 'OL2W']);
    return [saved ? [{ open_library_work_id: 'OL1W' }] : [], []];
  };
  try {
    for (const query of ['', '?q= ', '?q=1', '?q=ab', '?q=%20ab%20', '?q=abc&page=0', '?q=abc&page=1.5', '?q=abc&page=abc', '?q=abc&page=9007199254740991', '?q=a&q=b', '?q=abc&page=1&page=2', `?q=${'x'.repeat(201)}`]) {
      const response = await realFetch(base + '/api/books' + query);
      assert.equal(response.status, 400, query);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    }
    const shortQuery = await realFetch(base + '/api/books?q=1');
    assert.equal(shortQuery.status, 400);
    assert.equal((await shortQuery.json()).error.fields.q, 'Vui lòng nhập ít nhất 3 ký tự để tìm kiếm.');
    assert.equal(calls, 0, 'Invalid queries must not call Open Library');
    const path = '/api/books?q=%20James%20Clear%20&page=2';
    const response = await realFetch(base + path);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.pagination, { page: 2, limit: 20, total: 42 });
    assert.deepEqual(body.data[0], { workId: 'OL1W', title: 'Atomic Habits', authors: ['James Clear'], coverUrl: '/api/covers/123', firstPublishYear: 2018, inShelf: true });
    assert.deepEqual(body.data[1], { workId: 'OL2W', title: 'Chưa có tên sách', authors: [], coverUrl: null, firstPublishYear: null, inShelf: false });
    saved = false;
    assert.equal((await (await realFetch(base + path)).json()).data[0].inShelf, false);
    assert.equal(calls, 1, 'Metadata cached, membership fresh');
    pool.query = async () => { throw new Error('SECRET_SQL'); };
    const dbError = await realFetch(base + path);
    assert.equal(dbError.status, 503);
    assert.equal((await dbError.json()).error.code, 'DATABASE_UNAVAILABLE');
    for (const [q, status, code] of [['upstream-fail', 502, 'OPEN_LIBRARY_ERROR'], ['timeout', 504, 'OPEN_LIBRARY_TIMEOUT'], ['malformed', 502, 'OPEN_LIBRARY_ERROR']]) {
      const response = await realFetch(base + '/api/books?q=' + q);
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
    for (const q of ['abc', 'a'.repeat(200)]) {
      assert.equal((await realFetch(base + '/api/books?q=' + q)).status, 200);
    }
    const empty = await realFetch(base + '/api/books?q=empty');
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { data: [], pagination: { page: 1, limit: 20, total: 0 } });
  } finally {
    global.fetch = realFetch;
    pool.query = realQuery;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
