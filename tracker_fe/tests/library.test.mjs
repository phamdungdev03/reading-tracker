import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { api } = await server.ssrLoadModule('/src/services/api.ts')
  const { useLibrary } = await server.ssrLoadModule('/src/composables/useLibrary.ts')
  const library = useLibrary()
  const fixture = id => ({ id, title: id, author: 'Test', year: null, pages: 100, coverUrl: null,
    description: '', subjects: [], inShelf: true,
    entry: { id: id === 'OL1W' ? '1' : '2', bookId: '1', status: 'reading', totalPages: 100,
      currentPage: 0, rating: null, notes: '', startedAt: null, finishedAt: null } })
  const existing = fixture('OL1W'), added = fixture('OL2W')
  let release
  let requests = 0
  api.shelf = () => ++requests === 1 ? new Promise(resolve => { release = resolve }) : Promise.resolve([existing, added])
  api.add = async () => added
  const loading = library.loadShelf()
  const beforeAdd = library.getRevision()
  await library.addBook('OL2W', 100, 'reading')
  const reused = library.loadShelf()
  release([existing])
  await Promise.all([loading, reused])
  assert.equal(requests, 2)
  assert.equal(library.loaded.value, true)
  assert.equal(library.loading.value, false)
  assert.equal(library.stats.value.total, 2)
  assert.deepEqual(library.shelfBooks.value.map(book => book.id).sort(), ['OL1W', 'OL2W'])
  // Old search must not undo a successful local mutation.
  library.acceptMembership([{ id: 'OL2W', inShelf: false }], beforeAdd)
  assert.equal(library.membership.value.OL2W, true)
  // A fresh response can report deletion/addition from another tab.
  library.acceptMembership([{ id: 'OL2W', inShelf: false }], library.getRevision())
  assert.equal(library.membership.value.OL2W, false)
  library.acceptMembership([{ id: 'OL2W', inShelf: true }], library.getRevision())
  assert.equal(library.membership.value.OL2W, true)
  api.remove = async () => { throw new Error('Test failure') }
  await assert.rejects(library.removeBook(added))
  assert.equal(library.stats.value.total, 2)
  api.remove = async id => assert.equal(id, '2')
  await library.removeBook(added)
  assert.equal(library.stats.value.total, 1)
  assert.equal(library.membership.value.OL2W, false)
  console.log('PASS: refresh/mutation race, fresh membership, stale response and delete failure.')
} finally {
  await server.close()
}
