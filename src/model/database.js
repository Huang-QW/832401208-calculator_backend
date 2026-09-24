/**
 * 数据库连接与初始化模块。
 *
 * 使用 Node.js 内置的 node:sqlite 模块（Node >= 22.5），
 * 不依赖任何第三方原生扩展，因此无需额外安装 MySQL / SQLite 服务。
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/** 数据文件存放目录：<项目根>/data，可用环境变量 CALC_DATA_DIR 覆盖（测试用） */
const DATA_DIR = process.env.CALC_DATA_DIR || path.join(__dirname, '..', '..', 'data');

/** SQLite 数据库文件路径 */
const DB_FILE = path.join(DATA_DIR, process.env.CALC_DB_NAME || 'calculator.db');

/** 建表语句：计算历史表 */
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS calculation_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    expression  TEXT    NOT NULL,
    result      REAL    NOT NULL,
    created_at  TEXT    NOT NULL
  );
`;

/** 索引：按时间倒序查询历史时使用 */
const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_history_created_at
    ON calculation_history (created_at DESC, id DESC);
`;

/** @type {import('node:sqlite').DatabaseSync | null} */
let db = null;

/**
 * 初始化数据库连接并创建表结构（幂等，重复调用安全）。
 * @returns {import('node:sqlite').DatabaseSync} 数据库连接对象
 */
function initDatabase() {
  if (db) {
    return db;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(CREATE_TABLE_SQL);
  db.exec(CREATE_INDEX_SQL);
  return db;
}

/**
 * 获取数据库连接（若尚未初始化则自动初始化）。
 * @returns {import('node:sqlite').DatabaseSync}
 */
function getDatabase() {
  return db || initDatabase();
}

/**
 * 关闭数据库连接，用于进程退出或测试收尾。
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  DB_FILE,
  closeDatabase,
  getDatabase,
  initDatabase,
};
