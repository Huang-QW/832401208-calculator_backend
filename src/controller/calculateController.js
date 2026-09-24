/**
 * 计算接口控制器：POST /api/calculate
 *
 * 职责边界（很重要，这是"前后端分离"的核心体现）：
 *   - 后端负责：接收表达式 -> 校验 -> 解析 -> 计算 -> 落库 -> 返回结果
 *   - 前端只负责：把表达式发过来，把返回的结果显示出来
 *   - 前端永远不会自己算出结果再发过来
 */

'use strict';

const { ExpressionError, calculate } = require('../service/calculator');
const { saveHistory } = require('../service/history');

/**
 * 处理计算请求。
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function handleCalculate(req, res, next) {
  try {
    const { expression } = req.body || {};

    if (expression === undefined || expression === null) {
      return res.status(400).json({
        success: false,
        message: '缺少参数 expression',
      });
    }

    // 1. 解析并计算（内部会做完整校验，抛出中文错误提示）
    const { expression: normalized, result } = calculate(expression);

    // 2. 计算成功后写入数据库，返回带 id 与时间的记录
    const record = saveHistory(normalized, result);

    // 3. 返回标准化的成功响应
    return res.status(200).json({
      success: true,
      id: record.id,
      expression: record.expression,
      result: record.result,
      createdAt: record.createdAt,
    });
  } catch (error) {
    if (error instanceof ExpressionError) {
      // 用户输入问题 -> 400，属于可预期的业务异常
      return res.status(400).json({
        success: false,
        expression: typeof req.body?.expression === 'string' ? req.body.expression : null,
        message: error.message,
      });
    }
    // 其他异常交给全局错误处理中间件 -> 500
    return next(error);
  }
}

module.exports = { handleCalculate };
