import { Config } from '@deepseek-ai/dsh-client-connection'
import { assertTrustedAuthority } from './trust.js'

export const name = 'dsh-trusted-host-proxy-403-fix'
export const inject = ['connection']
export { Config }

/**
 * DSH 0.1.2 replaced the privileged-method empty-trustedHosts 403 with a
 * process-token / signed-cookie gate. This deployment already authenticates
 * at Cloudflare Access; `--trusted-host` is the Host/Origin fence, not a
 * second login. Once Connection's Host fence has passed, skip the cookie 401
 * so reverse-proxy and loopback health checks keep working.
 *
 * Do not inject `remote` or the removed `apiProxy` service.
 * @param {object} connection - live Host Connection service.
 */
export function bypassCookieWhenHostFencePasses(connection) {
  if (
    connection === undefined ||
    typeof connection.requestRejection !== 'function' ||
    typeof connection.authorizeIndex !== 'function'
  ) {
    throw new Error(
      'dsh-trusted-host-proxy-403-fix: connection.requestRejection/authorizeIndex missing; need DSH 0.1.2+'
    )
  }

  const originalRejection = connection.requestRejection.bind(connection)
  const originalAuthorize = connection.authorizeIndex.bind(connection)

  connection.requestRejection = function (request) {
    const rejection = originalRejection(request)
    if (rejection === 401) return undefined
    return rejection
  }

  connection.authorizeIndex = function (req, res) {
    let status
    let headers
    const tap = {
      writeHead(code, hdrs) {
        status = code
        headers = hdrs
      },
      end() {}
    }
    const ok = originalAuthorize(req, tap)
    if (ok) return true
    if (status === 401) return true
    if (status !== undefined) {
      if (headers !== undefined) res.writeHead(status, headers)
      else res.writeHead(status)
      res.end()
      return false
    }
    return false
  }
}

export function apply(ctx, config) {
  const trustedHosts = config && config.trustedHosts ? config.trustedHosts : []
  for (let i = 0; i < trustedHosts.length; i++) {
    assertTrustedAuthority(trustedHosts[i])
  }
  bypassCookieWhenHostFencePasses(ctx.connection)
}
