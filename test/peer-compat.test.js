import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  Config,
  HostConnectionService
} from '@deepseek-ai/dsh-client-connection'

const require = createRequire(import.meta.url)
const expectedVersions = new Map([
  ['@deepseek-ai/dsh-api-remotes', '0.1.5-rc.2'],
  ['@deepseek-ai/dsh-client-connection', '0.1.5-rc.2'],
  ['@deepseek-ai/dsh-client-locale', '0.1.5-rc.2'],
  ['@deepseek-ai/dsh-client-ui-settings', '0.1.5-rc.2'],
  ['@deepseek-ai/dsh-client-ui-settings-general', '0.1.5-rc.2'],
  ['@deepseek-ai/dsh-client-ui-theme', '0.1.5-rc.2']
])

for (const [packageName, expectedVersion] of expectedVersions) {
  const packageJson = require(packageName + '/package.json')
  assert.equal(packageJson.version, expectedVersion, packageName)
}

const cordisPackageJson = require('@deepseek-ai/cordis/package.json')
assert.match(cordisPackageJson.version, /^4\./)

assert.equal(typeof Config, 'function')
assert.equal(typeof HostConnectionService, 'function')
assert.equal(typeof HostConnectionService.prototype.requestRejection, 'function')
assert.equal(typeof HostConnectionService.prototype.authorizeIndex, 'function')

console.log('peer-compat.test.js ok')
