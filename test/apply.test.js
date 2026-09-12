import assert from 'node:assert/strict'
import { apply, bypassCookieWhenHostFencePasses, inject, name, Config } from '../src/index.js'

assert.deepEqual(inject, ['connection'])
assert.equal(name, 'dsh-trusted-host-proxy-403-fix')
assert.equal(Config.source, 'official-config')

{
  assert.throws(function () {
    apply({ connection: {} }, { trustedHosts: ['https://bad.example'] })
  })
}

{
  assert.throws(function () {
    bypassCookieWhenHostFencePasses({}, [])
  }, /0\.1\.2/)
}

{
  const calls = []
  const connection = {
    requestRejection(request) {
      calls.push(['reject', request.headers.host])
      if (request.headers.host === 'evil.example') return 403
      if (request.cookie) return undefined
      return 401
    },
    authorizeIndex(req, res) {
      calls.push(['auth', req.headers.host, req.token])
      if (req.token === 'ok') {
        res.writeHead(303, { location: '/' })
        res.end('redirect')
        return false
      }
      if (req.cookie) return true
      res.writeHead(401, 'Unauthorized', { 'x-auth': 'required' })
      res.end('unauthorized')
      return false
    }
  }

  apply({ connection: connection }, { trustedHosts: ['dsh.xxzz.dev'] })

  assert.equal(connection.requestRejection({ headers: { host: 'evil.example' } }), 403)
  assert.equal(connection.requestRejection({ headers: { host: 'dsh.xxzz.dev' } }), undefined)
  assert.equal(connection.requestRejection({ headers: { host: 'unknown.example' } }), 401)
  assert.equal(connection.requestRejection({ headers: { host: '127.0.0.1:3080' }, cookie: true }), undefined)

  const forwarded = []
  assert.equal(
    connection.authorizeIndex({ headers: { host: 'dsh.xxzz.dev' } }, {
      writeHead() { forwarded.push('write') },
      end() { forwarded.push('end') }
    }),
    true
  )
  assert.deepEqual(forwarded, [])

  assert.equal(
    connection.authorizeIndex({ headers: { host: 'dsh.xxzz.dev' }, cookie: true }, {
      writeHead() { forwarded.push('write') },
      end() { forwarded.push('end') }
    }),
    true
  )

  assert.equal(
    connection.authorizeIndex({ headers: { host: 'dsh.xxzz.dev' }, token: 'ok' }, {
      writeHead(code, headers) { forwarded.push(['head', code, headers.location]) },
      end(body) { forwarded.push(['end', body]) }
    }),
    false
  )
  assert.deepEqual(forwarded, [['head', 303, '/'], ['end', 'redirect']])

  assert.equal(
    connection.authorizeIndex({ headers: { host: 'evil.example' } }, {
      writeHead(...args) { forwarded.push(['rejected-head', ...args]) },
      end(...args) { forwarded.push(['rejected-end', ...args]) }
    }),
    false
  )
  assert.deepEqual(forwarded.slice(-2), [
    ['rejected-head', 401, 'Unauthorized', { 'x-auth': 'required' }],
    ['rejected-end', 'unauthorized']
  ])

  for (const headers of [
    { host: 'dsh.xxzz.dev', origin: 'https://evil.example' },
    { host: 'dsh.xxzz.dev', 'sec-fetch-site': 'cross-site' }
  ]) {
    const rejected = []
    assert.equal(
      connection.authorizeIndex({ headers }, {
        writeHead(...args) { rejected.push(['head', ...args]) },
        end(...args) { rejected.push(['end', ...args]) }
      }),
      false
    )
    assert.deepEqual(rejected, [
      ['head', 401, 'Unauthorized', { 'x-auth': 'required' }],
      ['end', 'unauthorized']
    ])
  }
}

console.log('apply.test.js ok')
