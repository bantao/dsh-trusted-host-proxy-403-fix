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
    bypassCookieWhenHostFencePasses({})
  }, /0\.1\.2/)
}

{
  const calls = []
  const connection = {
    requestRejection(request) {
      calls.push(['reject', request.host])
      if (request.host === 'evil.example') return 403
      if (request.cookie) return undefined
      return 401
    },
    authorizeIndex(req, res) {
      calls.push(['auth', req.host, req.token])
      if (req.token === 'ok') {
        res.writeHead(303, { location: '/' })
        res.end()
        return false
      }
      if (req.cookie) return true
      res.writeHead(401)
      res.end()
      return false
    }
  }

  apply({ connection: connection }, { trustedHosts: ['dsh.xxzz.dev'] })

  assert.equal(connection.requestRejection({ host: 'evil.example' }), 403)
  assert.equal(connection.requestRejection({ host: 'dsh.xxzz.dev' }), undefined)
  assert.equal(connection.requestRejection({ host: '127.0.0.1:3080', cookie: true }), undefined)

  const forwarded = []
  assert.equal(
    connection.authorizeIndex({ host: 'dsh.xxzz.dev' }, {
      writeHead() { forwarded.push('write') },
      end() { forwarded.push('end') }
    }),
    true
  )
  assert.deepEqual(forwarded, [])

  assert.equal(
    connection.authorizeIndex({ host: 'dsh.xxzz.dev', cookie: true }, {
      writeHead() { forwarded.push('write') },
      end() { forwarded.push('end') }
    }),
    true
  )

  assert.equal(
    connection.authorizeIndex({ host: 'dsh.xxzz.dev', token: 'ok' }, {
      writeHead(code, headers) { forwarded.push(['head', code, headers.location]) },
      end() { forwarded.push('end') }
    }),
    false
  )
  assert.deepEqual(forwarded, [['head', 303, '/'], 'end'])
}

console.log('apply.test.js ok')
