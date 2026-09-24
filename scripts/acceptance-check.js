/**
 * 手工验收脚本：对已启动的后端服务发起真实 HTTP 请求，
 * 打印每个接口的返回，用于人工核对 / 写博客时截图。
 *
 * 用法：先启动后端（npm start），再执行 node scripts/acceptance-check.js
 */

'use strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000/api';

/**
 * 发起请求并打印结果。
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 */
async function call(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text };
}

/**
 * 打印一行结果。
 * @param {string} label
 * @param {{status: number, text: string}} result
 */
function print(label, result) {
  console.log(`[${String(result.status).padEnd(3)}] ${label.padEnd(34)} ${result.text}`);
}

async function main() {
  console.log('========== 1. 健康检查 ==========');
  print('GET /api/health', await call('GET', '/health'));

  console.log('\n========== 2. 正常计算 ==========');
  const okCases = [
    '12+8', '1+2*3', '(1+2)*3', '10/2+7', '8-3*2',
    '-5+8', '3*-2', '1.5+2.25', '0.1+0.2', '((1+2)*(3+4))', '（1+2）×3',
  ];
  for (const expression of okCases) {
    print(`POST ${expression}`, await call('POST', '/calculate', { expression }));
  }

  console.log('\n========== 3. 异常处理 ==========');
  const badCases = ['10/0', '1/(2-2)', '1+*2', '(1+2', '1+2)', '()', 'hi', '1.2.3', '1+', ''];
  for (const expression of badCases) {
    print(`POST ${JSON.stringify(expression)}`, await call('POST', '/calculate', { expression }));
  }
  print('POST 缺少参数', await call('POST', '/calculate', {}));

  console.log('\n========== 4. 历史记录查询 ==========');
  print('GET /api/history', await call('GET', '/history?page=1&pageSize=5'));
  print('GET /api/history?keyword=1%2B2', await call('GET', '/history?keyword=1%2B2'));

  console.log('\n========== 5. 删除单条 ==========');
  const created = await call('POST', '/calculate', { expression: '555+1' });
  const id = JSON.parse(created.text).id;
  print(`DELETE /api/history/${id}`, await call('DELETE', `/history/${id}`));
  print('DELETE 不存在的 ID', await call('DELETE', '/history/99999999'));
  print('DELETE 非法 ID', await call('DELETE', '/history/abc'));
  print('GET 确认已删除', await call('GET', '/history?keyword=555'));

  console.log('\n========== 6. 清空历史（扩展功能） ==========');
  print('DELETE /api/history', await call('DELETE', '/history'));
  print('GET 确认已清空', await call('GET', '/history'));
}

main().catch((error) => {
  console.error('验收脚本执行失败：', error.message);
  process.exitCode = 1;
});
