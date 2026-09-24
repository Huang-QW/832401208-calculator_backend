/**
 * 路由定义：把 URL 映射到控制器函数。
 */

'use strict';

const express = require('express');

const { handleCalculate } = require('../controller/calculateController');
const {
  handleClearHistory,
  handleDeleteHistory,
  handleListHistory,
} = require('../controller/historyController');

const router = express.Router();

/** 健康检查，用于部署后确认服务是否活着 */
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'calculator backend is running' });
});

/** 计算 */
router.post('/calculate', handleCalculate);

/** 历史记录：查询 / 清空 */
router.get('/history', handleListHistory);
router.delete('/history', handleClearHistory);

/** 历史记录：删除单条（放在 /history 之后，避免路由歧义） */
router.delete('/history/:id', handleDeleteHistory);

module.exports = router;
