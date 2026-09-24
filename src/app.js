/**
 * Express 应用装配：中间件 + 路由 + 统一错误处理。
 *
 * 单独抽出 app.js 的好处：测试时可以直接引入 app 而不启动端口。
 */

'use strict';

const express = require('express');

const { initDatabase } = require('./model/database');
const apiRouter = require('./routes/api');

/**
 * 跨域中间件。
 * 前后端分离部署时前端与后端不同源，必须允许跨域，否则浏览器会拦截请求。
 * 这里手写而不用 cors 包，是为了少一个依赖、也让代码更透明。
 */
function corsMiddleware(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
}

/**
 * 简单的请求日志中间件，方便调试。
 */
function logMiddleware(req, res, next) {
  const startAt = Date.now();
  res.on('finish', () => {
    const cost = Date.now() - startAt;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${cost}ms)`);
  });
  next();
}

/**
 * 创建 Express 应用。
 * @returns {import('express').Express}
 */
function createApp() {
  initDatabase();

  const app = express();

  app.use(corsMiddleware);
  app.use(logMiddleware);
  app.use(express.json({ limit: '16kb' }));

  app.use('/api', apiRouter);

  // 根路径给个提示，避免访问 / 时看到 404 一头雾水
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: '前后端分离计算器系统 - 后端服务',
      endpoints: [
        'POST   /api/calculate',
        'GET    /api/history?page=1&pageSize=10&keyword=xx',
        'DELETE /api/history/:id',
        'DELETE /api/history',
        'GET    /api/health',
      ],
    });
  });

  // 404：请求了不存在的接口
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `接口不存在：${req.method} ${req.originalUrl}` });
  });

  // 统一错误处理：任何未捕获的异常都在这里变成标准 JSON，而不是 HTML 错误页
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ success: false, message: '请求体不是合法的 JSON' });
    }
    console.error('[server error]', error);
    return res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  });

  return app;
}

module.exports = { createApp };
