/**
 * 计算模块单元测试。
 * 覆盖作业要求中的全部计算场景：四则运算、优先级、括号、一元正负号、小数、
 * 非法表达式、除以零。
 *
 * 运行：npm test
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ExpressionError, calculate } = require('../src/service/calculator');

/**
 * 断言表达式计算结果。
 * @param {string} expression
 * @param {number} expected
 */
function expectResult(expression, expected) {
  const actual = calculate(expression);
  assert.equal(actual.result, expected, `${expression} 应等于 ${expected}，实际为 ${actual.result}`);
}

/**
 * 断言表达式抛出带指定提示的错误。
 * @param {string} expression
 * @param {string} messagePart 期望出现在提示中的片段
 */
function expectError(expression, messagePart) {
  assert.throws(
    () => calculate(expression),
    (error) => {
      assert.ok(error instanceof ExpressionError, `应抛出 ExpressionError，实际为 ${error.name}`);
      assert.ok(
        error.message.includes(messagePart),
        `错误提示应包含 "${messagePart}"，实际为 "${error.message}"`,
      );
      return true;
    },
  );
}

describe('基础四则运算', () => {
  it('加法', () => expectResult('12+8', 20));
  it('减法', () => expectResult('12-8', 4));
  it('乘法（* 与 × 均可）', () => {
    expectResult('6*7', 42);
    expectResult('6×7', 42);
  });
  it('除法（/ 与 ÷ 均可）', () => {
    expectResult('84/4', 21);
    expectResult('84÷4', 21);
  });
});

describe('复合表达式：运算符优先级', () => {
  it('1+2*3 = 7', () => expectResult('1+2*3', 7));
  it('8-3*2 = 2', () => expectResult('8-3*2', 2));
  it('10/2+7 = 12', () => expectResult('10/2+7', 12));
  it('2+3*4-6/2 = 11', () => expectResult('2+3*4-6/2', 11));
});

describe('括号', () => {
  it('(1+2)*3 = 9', () => expectResult('(1+2)*3', 9));
  it('嵌套括号', () => expectResult('((1+2)*(3+4))', 21));
  it('缺少右括号', () => expectError('(1+2', '缺少右括号'));
  it('多余右括号', () => expectError('1+2)', '多余的右括号'));
  it('空括号', () => expectError('()', '括号内不能为空'));
});

describe('一元正负号', () => {
  it('-5+8 = 3', () => expectResult('-5+8', 3));
  it('3*-2 = -6', () => expectResult('3*-2', -6));
  it('3*+2 = 6', () => expectResult('3*+2', 6));
  it('-(3+4) = -7', () => expectResult('-(3+4)', -7));
  it('--5 = 5', () => expectResult('--5', 5));
});

describe('小数与浮点误差', () => {
  it('小数运算', () => expectResult('1.5+2.25', 3.75));
  it('0.1+0.2 = 0.3（消除浮点误差）', () => expectResult('0.1+0.2', 0.3));
  it('省略整数位的 .5', () => expectResult('.5+.5', 1));
  it('小数点重复', () => expectError('1.2.3', '小数点重复'));
  it('小数点后缺少数字', () => expectError('12.', '小数点后缺少数字'));
});

describe('非法表达式', () => {
  it('空表达式', () => expectError('', '表达式不能为空'));
  it('纯空白', () => expectError('   ', '表达式不能为空'));
  it('非法字符', () => expectError('1+a', '非法字符'));
  it('末尾缺操作数', () => expectError('1+', '表达式不完整'));
  it('运算符连续', () => expectError('1+*2', '位置不正确'));
  it('缺少运算符', () => expectError('2(3+4)', '缺少运算符'));
  it('表达式过长', () => expectError('1+'.repeat(120) + '1', '过长'));
  it('非字符串入参', () => expectError(123, '必须是字符串'));
});

describe('除以零', () => {
  it('10/0 报错', () => expectError('10/0', '除数不能为 0'));
  it('1/(2-2) 报错', () => expectError('1/(2-2)', '除数不能为 0'));
});

describe('标准化', () => {
  it('去除空白并统一全角符号', () => {
    assert.equal(calculate(' 1 ＋ 2 × 3 ').expression, '1+2*3');
    assert.equal(calculate('（1+2）×3').expression, '(1+2)*3');
    assert.equal(calculate('（1+2）×3').result, 9);
  });
});
