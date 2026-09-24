/**
 * API 集成测试：直接启动 Express 应用（随机端口），用真实 HTTP 请求验证
 * 计算接口与历史记录接口，包括数据库的增、查、删是否真的生效。
 *
 * 使用独立的临时数据库目录，不会污染 data/calculator.db。
 *
 * 运行：npm test
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

// 必须在 require app 之前设置，database.js 会在首次连接时读取该变量
const TMP_DATA_DIR = path.join(__dirname, '.tmp-data');
fs.rmSync(TMP_DATA_DIR, { force: true, recursive: true });
process.env.CALC_DATA_DIR = TMP_DATA_DIR;

const { createApp } = require('../src/app');
const { closeDatabase } = require('../src/model/database');

/** @type {import('node:http').Server} */
let server;
/** @type {string} 形如 http://127.0.0.1:52341 */
let baseUrl;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // 必须先关闭数据库连接，否则 SQLite 文件句柄会让临时目录删不掉
  closeDatabase();
  fs.rmSync(TMP_DATA_DIR, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
});

/**
 * 发送请求并解析 JSON。
 * @param {string} method
 * @param {string} urlPath
 * @param {object} [body]
 * @returns {Promise<{status: number, body: any}>}
 */
async function request(method, urlPath, body) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

describe('POST /api/calculate', () => {
  it('加法：12+8 = 20', async () => {
    const { status, body } = await request('POST', '/api/calculate', { expression: '12+8' });
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.expression, '12+8');
    assert.equal(body.result, 20);
    assert.ok(body.id > 0);
    assert.match(body.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('复合表达式：(1+2)*3 = 9', async () => {
    const { body } = await request('POST', '/api/calculate', { expression: '(1+2)*3' });
    assert.equal(body.result, 9);
  });

  it('除以零返回 400 + 中文提示', async () => {
    const { status, body } = await request('POST', '/api/calculate', { expression: '10/0' });
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.match(body.message, /除数不能为 0/);
  });

  it('非法表达式返回 400', async () => {
    const { status, body } = await request('POST', '/api/calculate', { expression: '1+*2' });
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  it('缺少 expression 参数返回 400', async () => {
    const { status, body } = await request('POST', '/api/calculate', {});
    assert.equal(status, 400);
    assert.match(body.message, /缺少参数/);
  });

  it('计算失败时不会写入历史记录', async () => {
    const before = await request('GET', '/api/history');
    await request('POST', '/api/calculate', { expression: 'abc' });
    const afterCount = await request('GET', '/api/history');
    assert.equal(afterCount.body.data.total, before.body.data.total);
  });
});

describe('GET /api/history', () => {
  it('从数据库读回历史记录（含表达式、结果、时间）', async () => {
    const { status, body } = await request('GET', '/api/history?page=1&pageSize=5');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.total >= 2);
    const first = body.data.list[0];
    assert.ok(typeof first.id === 'number');
    assert.ok(typeof first.expression === 'string');
    assert.ok(typeof first.result === 'number');
    assert.match(first.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('支持关键字搜索', async () => {
    await request('POST', '/api/calculate', { expression: '777+1' });
    const { body } = await request('GET', `/api/history?keyword=${encodeURIComponent('777')}`);
    assert.equal(body.data.total, 1);
    assert.equal(body.data.list[0].expression, '777+1');
  });

  it('支持分页', async () => {
    const { body } = await request('GET', '/api/history?page=1&pageSize=2');
    assert.equal(body.data.pageSize, 2);
    assert.ok(body.data.list.length <= 2);
    assert.ok(body.data.totalPages >= 1);
  });
});

describe('DELETE /api/history/:id', () => {
  it('删除指定记录后，数据库中确实少了一条', async () => {
    const created = await request('POST', '/api/calculate', { expression: '999-1' });
    const id = created.body.id;

    const totalBefore = (await request('GET', '/api/history')).body.data.total;
    const deleted = await request('DELETE', `/api/history/${id}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.success, true);

    const after = await request('GET', '/api/history');
    assert.equal(after.body.data.total, totalBefore - 1);
    assert.ok(!after.body.data.list.some((item) => item.id === id));
  });

  it('删除不存在的记录返回 404', async () => {
    const { status, body } = await request('DELETE', '/api/history/99999999');
    assert.equal(status, 404);
    assert.equal(body.success, false);
  });

  it('非法 ID 返回 400', async () => {
    const { status } = await request('DELETE', '/api/history/abc');
    assert.equal(status, 400);
  });
});

describe('DELETE /api/history（清空）', () => {
  it('清空后历史记录为 0 条', async () => {
    const { status, body } = await request('DELETE', '/api/history');
    assert.equal(status, 200);
    assert.equal(body.success, true);

    const after = await request('GET', '/api/history');
    assert.equal(after.body.data.total, 0);
  });
});

describe('其他', () => {
  it('GET /api/health 健康检查', async () => {
    const { status, body } = await request('GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });

  it('不存在的接口返回 404 JSON', async () => {
    const { status, body } = await request('GET', '/api/not-exist');
    assert.equal(status, 404);
    assert.equal(body.success, false);
  });

  it('OPTIONS 预检请求返回 204 且带跨域头', async () => {
    const response = await fetch(`${baseUrl}/api/calculate`, { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
});
