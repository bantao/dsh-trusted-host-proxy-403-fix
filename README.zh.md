# dsh-trusted-host-proxy-403-fix

[English](README.md) | 中文

适用于 `web` profile 的独立 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。`0.6.0` 精确适配 `@deepseek-ai/dsh@0.1.5-rc.2`。

DSH 0.1.2+ 会对 Web 页面和 API 增加进程 Token／签名 Cookie 校验。对于已经在 DSH 前面部署 Cloudflare Access 等身份认证、同时通过 `--trusted-host` 限定公开主机名的反向代理场景，本插件只跳过受信 Host 请求的 Cookie `401`，并保持远程设置、语言和主题的 host 持久化。

本插件不是身份认证层，也不会绕过 DSH 的 Host、Origin 或 Fetch Metadata 校验。非受信 Host、跨站请求和错误 Origin 仍会被拒绝。

## 安全边界

- `dsh web` 必须继续只监听回环地址，不能直接暴露到公网。
- `--trusted-host` 只填写客户端实际使用的规范 `host[:port]`，不能带协议、路径、用户信息或通配符。
- 公网入口必须由 Cloudflare Access、认证反向代理或等效网络隔离保护。
- 浏览器请求的 `Origin` 主机和端口必须与 `Host` 一致；`sec-fetch-site: cross-site` 和 `Origin: null` 会被拒绝。
- 插件不会改变已有 Cookie、进程 Token、重定向或非 `401` 响应。

## 设置持久化

浏览器半区会让已通过上述边界的反向代理页面使用与本机页面一致的 host 持久化：

- 将 `connection.isLoopback` 和 `ctx.remote.$host.isLoopback` 保持为可使用 host 设置的状态。
- 将共享 Settings mirror 从 memory 升级为 host，并调用 `load()` 恢复设置。
- 将 Locale 与 Theme 控制器升级为 host 持久化。

这样可以保证设置 → 模型中的凭据状态、语言、外观和 Composer Enter 等选项在刷新或 DSH 进程重启后仍然保留。

## 安装

从 npm 安装正式版本：

```bash
dsh plugin --profile web add dsh-trusted-host-proxy-403-fix@0.6.0
```

从 GitHub Release 安装：

```bash
dsh plugin --profile web add https://github.com/roojay/dsh-trusted-host-proxy-403-fix/releases/download/v0.6.0/dsh-trusted-host-proxy-403-fix-0.6.0.tgz
```

开发或发布前测试本地源码：

```bash
cd /absolute/path/to/dsh-trusted-host-proxy-403-fix
npm install --ignore-scripts --no-package-lock
dsh plugin --profile web add "$PWD"
```

本地源码必须先安装 peer dependencies。`cordis.patch.yml` 中的 `trustedHosts` 必须保持为 `!!js ctx.webRuntime.trustedHosts`，不要写死域名。

安装或切换来源后需完整重启 Web 进程，并继续传入公开主机名：

```bash
dsh web --port 3080 --trusted-host app.example.com
```

## 验证

先检查合并后的 profile：

```bash
dsh --profile web --dump-config
```

再从服务器回环地址验证首页边界：

```bash
# 受信 Host：无 DSH Cookie 时仍应加载首页
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/ \
  -H 'Host: app.example.com'

# 非受信 Host：不得加载首页
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/ \
  -H 'Host: evil.example'

# 错误 Origin：API 请求仍应为 403
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/settings.describe \
  -H 'Host: app.example.com' \
  -H 'Origin: https://evil.example' \
  -H 'content-type: application/json' \
  -d '{}'
```

通过前置身份认证后，还应在真实浏览器中确认：会话列表可打开、消息可发送、设置 → 模型可读取和保存凭据，语言与主题在硬刷新和完整重启后保持不变。

## 开发

```bash
npm install --ignore-scripts --no-package-lock
npm test
npm pack
```

测试会固定核对 DSH `0.1.5-rc.2` 的 peer 版本以及 `HostConnectionService.requestRejection`、`authorizeIndex` 接口，防止上游接口漂移后静默放行或破坏原有功能。

## 许可证

MIT。请求校验逻辑参考 `@deepseek-ai/dsh-client-connection` 的 MIT 实现。
