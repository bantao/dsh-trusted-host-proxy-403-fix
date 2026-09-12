import { Config } from '@deepseek-ai/dsh-client-connection'
import { assertTrustedAuthority, isTrustedApiRequest } from './trust.js'

export const name = 'dsh-trusted-host-proxy-403-fix'
export const inject = ['connection']
export { Config }

/**
 * DSH 0.1.2 replaced the privileged-method empty-trustedHosts 403 with a
 * process-token / signed-cookie gate. This deployment already authenticates
 * at Cloudflare Access; `--trusted-host` is the Host/Origin fence, not a
 * second login. Skip the cookie 401 only when the same Host / Origin fence
 * passes, so reverse-proxy and loopback health checks keep working without
 * admitting arbitrary Host headers on the index route.
 *
 * Do not inject `remote` or the removed `apiProxy` service.
 * @param {object} connection - live Host Connection service.
 * @param {string[]} trustedHosts - validated --trusted-host authorities.
 */
export function bypassCookieWhenHostFencePasses(connection, trustedHosts = []) {
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
    if (rejection === 401 && isTrustedApiRequest(request, trustedHosts)) return undefined
    return rejection
  }

  connection.authorizeIndex = function (req, res) {
    let writeHeadArgs
    let endArgs
    let ended = false
    const tap = {
      writeHead(...args) {
        writeHeadArgs = args
        return this
      },
      end(...args) {
        ended = true
        endArgs = args
        return this
      }
    }
    const ok = originalAuthorize(req, tap)
    if (ok) return true
    if (
      writeHeadArgs !== undefined &&
      writeHeadArgs[0] === 401 &&
      isTrustedApiRequest(req, trustedHosts)
    ) return true
    if (writeHeadArgs !== undefined) res.writeHead(...writeHeadArgs)
    if (ended) res.end(...endArgs)
    return false
  }
}

export function apply(ctx, config) {
  const trustedHosts = config && config.trustedHosts ? config.trustedHosts : []
  for (let i = 0; i < trustedHosts.length; i++) {
    assertTrustedAuthority(trustedHosts[i])
  }
  bypassCookieWhenHostFencePasses(ctx.connection, trustedHosts)
}
