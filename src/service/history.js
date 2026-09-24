/**
 * 计算历史服务：负责计算历史表的增、查、删。
 *
 * 所有对数据库的读写都集中在这一层，控制器只做参数校验与响应封装，
 * 这样以后换数据库（比如 MySQL）时只需要改这一层。
 */

'use strict';

const { getDatabase } = require('../model/database');
const { ExpressionError } = require('./calculator');

/** 一页最多返回多少条，防止前端传个超大 pageSize 把库拖垮 */
const MAX_PAGE_SIZE = 100;

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 10;

/**
 * 把 Date 格式化为 "YYYY-MM-DD HH:mm:ss"（本地时间），与作业要求中的示例格式一致。
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * 把数据库行转换为对外返回的对象（蛇形命名 -> 驼峰命名）。
 * @param {{id: number, expression: string, result: number, created_at: string}} row
 * @returns {{id: number, expression: string, result: number, createdAt: string}}
 */
function toHistoryItem(row) {
  return {
    id: row.id,
    expression: row.expression,
    result: row.result,
    createdAt: row.created_at,
  };
}

/**
 * 保存一条计算历史。
 * @param {string} expression 标准化后的表达式
 * @param {number} result 计算结果
 * @returns {{id: number, expression: string, result: number, createdAt: string}}
 */
function saveHistory(expression, result) {
  const db = getDatabase();
  const createdAt = formatDateTime(new Date());
  const info = db
    .prepare('INSERT INTO calculation_history (expression, result, created_at) VALUES (?, ?, ?)')
    .run(expression, result, createdAt);

  return {
    id: Number(info.lastInsertRowid),
    expression,
    result,
    createdAt,
  };
}

/**
 * 分页查询计算历史，可按表达式关键字模糊搜索。
 * @param {{page?: number|string, pageSize?: number|string, keyword?: string}} [options]
 * @returns {{list: Array, total: number, page: number, pageSize: number, totalPages: number}}
 */
function listHistory(options = {}) {
  const db = getDatabase();

  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const rawPageSize = Number.parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
  const keyword = typeof options.keyword === 'string' ? options.keyword.trim() : '';

  const where = keyword ? 'WHERE expression LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`] : [];

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM calculation_history ${where}`)
    .get(...params);

  const rows = db
    .prepare(
      `SELECT id, expression, result, created_at
         FROM calculation_history
         ${where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  return {
    list: rows.map(toHistoryItem),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
  };
}

/**
 * 按 ID 删除一条历史记录。
 * @param {number|string} id
 * @returns {boolean} 是否真的删掉了一条记录
 */
function deleteHistoryById(id) {
  const db = getDatabase();
  const info = db.prepare('DELETE FROM calculation_history WHERE id = ?').run(Number(id));
  return Number(info.changes) > 0;
}

/**
 * 清空全部历史记录。
 * @returns {number} 被删除的记录条数
 */
function clearHistory() {
  const db = getDatabase();
  const info = db.prepare('DELETE FROM calculation_history').run();
  return Number(info.changes);
}

/**
 * 校验路径参数中的 id 是否为合法的正整数。
 * @param {string} rawId
 * @returns {number}
 * @throws {ExpressionError} id 非法时
 */
function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ExpressionError('历史记录 ID 必须是正整数');
  }
  return id;
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clearHistory,
  deleteHistoryById,
  formatDateTime,
  listHistory,
  parseId,
  saveHistory,
};
