# dsh-trusted-host-proxy-403-fix

English | [中文](README.zh.md)

A standalone [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin for the `web` profile. Version `0.7.0` is pinned to `@deepseek-ai/dsh@0.1.5-rc.2`.

DSH 0.1.2+ adds a process-token or signed-cookie gate to Web pages and API requests. In reverse-proxy deployments that already authenticate users with Cloudflare Access or an equivalent layer and constrain the public authority with `--trusted-host`, this plugin skips only the cookie `401` for requests that pass the trusted Host, Origin, and Fetch Metadata fence. It also keeps settings, locale, and theme persistence in host mode.

This plugin is not an authentication layer. Untrusted Host headers, cross-site requests, and mismatched Origins remain rejected.

## Security boundary

- Keep `dsh web` bound to a loopback address; never expose it directly to the public network.
- Add only canonical `host[:port]` values actually used by clients to `--trusted-host`. Schemes, paths, user info, and wildcards are invalid.
- Protect public entry points with Cloudflare Access, an authenticating reverse proxy, or equivalent network isolation.
- A browser Origin must have the same host and port as the Host header. `sec-fetch-site: cross-site` and `Origin: null` are rejected.
- Existing cookies, process tokens, redirects, and non-`401` responses keep their original behavior.

## Settings persistence

For pages admitted by that boundary, the client half enables the same host-backed persistence used by a loopback page:

- It keeps `connection.isLoopback` and `ctx.remote.$host.isLoopback` in the host-settings-capable state.
- It upgrades the shared Settings mirror from memory to host and calls `load()`.
- It upgrades the Locale and Theme controllers to host persistence.

Credentials state in Settings → Models, language, appearance, and Composer Enter preferences therefore survive refreshes and DSH process restarts.

## Effective configuration viewer

On a trusted reverse-proxy page, the Host desktop's **Open configuration file** action is replaced with **View effective config**:

- It reads namespace values resolved by the running DSH process through the existing `settings.describe()` boundary.
- It supports YAML / JSON views, refresh, and copy.
- Keys, tokens, and passwords remain redacted by the DSH server-side schema. The plugin never reads or returns the raw `settings.yaml` document.
- The view represents effective values, not the source file's comments or original formatting.

## Install

Install the published npm version:

```bash
dsh plugin --profile web add dsh-trusted-host-proxy-403-fix@0.7.0
```

Install the GitHub Release tarball:

```bash
dsh plugin --profile web add https://github.com/roojay/dsh-trusted-host-proxy-403-fix/releases/download/v0.7.0/dsh-trusted-host-proxy-403-fix-0.7.0.tgz
```

Test a local checkout before release:

```bash
cd /absolute/path/to/dsh-trusted-host-proxy-403-fix
npm install --ignore-scripts --no-package-lock
dsh plugin --profile web add "$PWD"
```

Install peer dependencies before linking a local checkout. Keep `trustedHosts: !!js ctx.webRuntime.trustedHosts` in `cordis.patch.yml`; do not hard-code an authority there.

Fully restart the Web process after installing or changing the source, and continue passing the public authority:

```bash
dsh web --port 3080 --trusted-host app.example.com
```

## Verify

Inspect the merged profile first:

```bash
dsh --profile web --dump-config
```

Then verify the index boundary through the server loopback address:

```bash
# Trusted Host: the index loads without a DSH cookie.
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/ \
  -H 'Host: app.example.com'

# Untrusted Host: the index must not load.
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/ \
  -H 'Host: evil.example'

# Wrong Origin: API requests remain forbidden.
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/settings.describe \
  -H 'Host: app.example.com' \
  -H 'Origin: https://evil.example' \
  -H 'content-type: application/json' \
  -d '{}'
```

After authenticating at the front end, also verify in a real browser that sessions open, messages can be sent, Settings → Models can read and save credentials, locale/theme preferences survive a hard refresh and a full process restart, and **View effective config** contains only redacted current values.

## Develop

```bash
npm install --ignore-scripts --no-package-lock
npm test
npm pack
```

Tests pin the DSH `0.1.5-rc.2` peer versions and assert the `HostConnectionService.requestRejection` and `authorizeIndex` contracts so an upstream API change fails closed instead of silently weakening the boundary or breaking existing behavior.

## License

MIT. Request-fence logic follows the MIT-licensed `@deepseek-ai/dsh-client-connection` implementation.
