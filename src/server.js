/**
 * 服务入口：启动 HTTP 服务。
 *
 * 端口优先级：命令行参数 > 环境变量 PORT > 默认 3000
 * 启动方式：npm start   （或 npm run dev 开启文件变更自动重启）
 */

'use strict';

const { createApp } = require('./app');
const { DB_FILE } = require('./model/database');

const DEFAULT_PORT = 3000;

/**
 * 解析启动端口。
 * @returns {number}
 */
function resolvePort() {
  const argPort = Number.parseInt(process.argv[2], 10);
  if (Number.isInteger(argPort) && argPort > 0 && argPort < 65536) {
    return argPort;
  }
  const envPort = Number.parseInt(process.env.PORT, 10);
  if (Number.isInteger(envPort) && envPort > 0 && envPort < 65536) {
    return envPort;
  }
  return DEFAULT_PORT;
}

const port = resolvePort();
const app = createApp();

app.listen(port, () => {
  console.log('==================================================');
  console.log('  前后端分离计算器系统 - 后端服务已启动');
  console.log(`  本机地址：http://localhost:${port}`);
  console.log(`  接口前缀：http://localhost:${port}/api`);
  console.log(`  数据库文件：${DB_FILE}`);
  console.log('  按 Ctrl + C 停止服务');
  console.log('==================================================');
});
