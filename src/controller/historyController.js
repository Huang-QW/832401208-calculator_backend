/**
 * 历史记录接口控制器：查询 / 删除单条 / 清空。
 */

'use strict';

const { ExpressionError } = require('../service/calculator');
const {
  clearHistory,
  deleteHistoryById,
  listHistory,
  parseId,
} = require('../service/history');

/**
 * GET /api/history?page=1&pageSize=10&keyword=1%2B2
 * 分页 + 关键字搜索查询历史记录。
 */
function handleListHistory(req, res, next) {
  try {
    const { page, pageSize, keyword } = req.query;
    const data = listHistory({ page, pageSize, keyword });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/history/:id
 * 删除指定的一条历史记录。
 */
function handleDeleteHistory(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const deleted = deleteHistoryById(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `未找到 ID 为 ${id} 的历史记录`,
      });
    }
    return res.status(200).json({
      success: true,
      message: '删除成功',
      id,
    });
  } catch (error) {
    if (error instanceof ExpressionError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return next(error);
  }
}

/**
 * DELETE /api/history
 * 清空全部历史记录（扩展功能）。
 */
function handleClearHistory(req, res, next) {
  try {
    const deleted = clearHistory();
    return res.status(200).json({
      success: true,
      message: `已清空全部历史记录，共删除 ${deleted} 条`,
      deleted,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  handleClearHistory,
  handleDeleteHistory,
  handleListHistory,
};
