/**
 * 表达式计算模块（本项目最核心的代码）。
 *
 * 设计目标：
 *   1. 不使用 eval / new Function / exec 等任何"把用户输入当代码执行"的手段，
 *      避免任意代码执行漏洞。
 *   2. 支持运算符优先级、括号、一元正负号、小数。
 *   3. 对非法输入给出明确的中文错误提示，而不是抛出一个看不懂的异常。
 *
 * 实现方式：经典的两步走
 *   第一步 词法分析（tokenize）：把 "1+2*3" 切成 [1, +, 2, *, 3] 这样的记号。
 *   第二步 语法分析（递归下降 parse）：按文法规则一边解析一边求值。
 *
 * 文法（EBNF）：
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary)*
 *   unary      := ('+' | '-') unary | primary
 *   primary    := number | '(' expression ')'
 *
 * 这个文法的层级天然实现了优先级：
 *   expression 层处理加减（优先级低），term 层处理乘除（优先级高），
 *   primary 层处理括号（优先级最高）。所以不需要额外的优先级表。
 */

'use strict';

/** 计算器业务异常：凡是"用户输入有问题"，都抛这个错误类型 */
class ExpressionError extends Error {
  /**
   * @param {string} message 面向用户的中文错误提示
   */
  constructor(message) {
    super(message);
    this.name = 'ExpressionError';
  }
}

/** 表达式最大长度，防止超长输入拖垮服务 */
const MAX_EXPRESSION_LENGTH = 200;

/** 结果保留的有效数字位数，用于消除浮点误差（0.1 + 0.2 -> 0.3） */
const PRECISION = 12;

/** 全角 / 特殊符号 → 半角统一化映射表 */
const NORMALIZE_MAP = {
  '×': '*', '✕': '*', '✖': '*', '＊': '*', '·': '*',
  '÷': '/', '／': '/',
  '−': '-', '–': '-', '—': '-', 'ー': '-', '－': '-',
  '＋': '+',
  '（': '(', '）': ')',
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  '．': '.', '。': '.',
  '　': ' ', '\t': ' ',
};

/**
 * 把用户输入标准化：去掉空白、统一全角符号。
 * @param {string} raw 原始表达式
 * @returns {string} 标准化后的表达式（不含空白字符）
 * @throws {ExpressionError} 输入为空或过长时
 */
function normalize(raw) {
  if (typeof raw !== 'string') {
    throw new ExpressionError('表达式必须是字符串');
  }
  if (raw.trim() === '') {
    throw new ExpressionError('表达式不能为空');
  }
  if (raw.length > MAX_EXPRESSION_LENGTH) {
    throw new ExpressionError(`表达式过长，最多支持 ${MAX_EXPRESSION_LENGTH} 个字符`);
  }

  let text = '';
  for (const char of raw) {
    const mapped = NORMALIZE_MAP[char] || char;
    if (mapped !== ' ') {
      text += mapped;
    }
  }
  if (text === '') {
    throw new ExpressionError('表达式不能为空');
  }
  return text;
}

/**
 * 词法分析：把字符串切成记号数组。
 * @param {string} text 标准化后的表达式
 * @returns {Array<{type: string, value: string, position: number}>}
 * @throws {ExpressionError} 出现非法字符或数字格式错误时
 */
function tokenize(text) {
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    // 数字：支持 12 / 3.14 / .5
    if (char >= '0' && char <= '9') {
      let number = '';
      let dotCount = 0;
      while (index < text.length && ((text[index] >= '0' && text[index] <= '9') || text[index] === '.')) {
        if (text[index] === '.') {
          dotCount += 1;
          if (dotCount > 1) {
            throw new ExpressionError('数字格式错误：小数点重复');
          }
        }
        number += text[index];
        index += 1;
      }
      if (number.endsWith('.')) {
        throw new ExpressionError(`数字格式错误："${number}" 小数点后缺少数字`);
      }
      tokens.push({ type: 'number', value: number, position: index - number.length });
      continue;
    }

    // 以小数点开头的数字，如 .5
    if (char === '.') {
      let number = '.';
      index += 1;
      while (index < text.length && text[index] >= '0' && text[index] <= '9') {
        number += text[index];
        index += 1;
      }
      if (number === '.') {
        throw new ExpressionError('数字格式错误：小数点后缺少数字');
      }
      tokens.push({ type: 'number', value: number, position: index - number.length });
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', value: char, position: index });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'rparen', value: char, position: index });
      index += 1;
      continue;
    }

    throw new ExpressionError(`包含非法字符："${char}"`);
  }

  if (tokens.length === 0) {
    throw new ExpressionError('表达式不能为空');
  }
  return tokens;
}

/**
 * 语法分析 + 求值（递归下降）。
 * @param {Array} tokens 记号数组
 * @returns {number} 计算结果
 * @throws {ExpressionError} 语法错误或除以零时
 */
function parse(tokens) {
  /** 当前读到的记号下标 */
  let position = 0;

  /** 看下一个记号，但不消费 */
  const peek = () => tokens[position];

  const current = () => {
    const token = tokens[position];
    if (!token) {
      throw new ExpressionError('表达式不完整，末尾缺少数字或括号');
    }
    return token;
  };

  /** 消费一个记号并返回 */
  const consume = () => tokens[position++];

  // ---------- primary：数字 或 ( expression ) ----------
  const parsePrimary = () => {
    const token = current();

    if (token.type === 'number') {
      consume();
      return Number(token.value);
    }

    if (token.type === 'lparen') {
      consume();
      if (current().type === 'rparen') {
        throw new ExpressionError('括号内不能为空');
      }
      const value = parseExpression();
      const nextToken = tokens[position];
      if (!nextToken) {
        // 例如 "(1+2"，读到结尾都没等到右括号
        throw new ExpressionError('缺少右括号 ")"');
      }
      if (nextToken.type !== 'rparen') {
        if (nextToken.type === 'number' || nextToken.type === 'lparen') {
          throw new ExpressionError('缺少运算符，请检查表达式');
        }
        throw new ExpressionError('缺少右括号 ")"');
      }
      consume();
      return value;
    }

    if (token.type === 'operator') {
      throw new ExpressionError(`运算符 "${token.value}" 的位置不正确`);
    }

    throw new ExpressionError('表达式不完整，末尾缺少数字或括号');
  };

  // ---------- unary：一元正负号 ----------
  const parseUnary = () => {
    const token = current();
    if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      consume();
      const value = parseUnary();
      return token.value === '-' ? -value : value;
    }
    return parsePrimary();
  };

  // ---------- term：乘除（优先级高） ----------
  const parseTerm = () => {
    let left = parseUnary();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'operator' || (token.value !== '*' && token.value !== '/')) {
        break;
      }
      if (token.value === '/') {
        consume();
        const right = parseUnary();
        if (right === 0) {
          throw new ExpressionError('除数不能为 0');
        }
        left /= right;
      } else {
        consume();
        left *= parseUnary();
      }
    }
    return left;
  };

  // ---------- expression：加减（优先级低） ----------
  function parseExpression() {
    let left = parseTerm();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'operator' || (token.value !== '+' && token.value !== '-')) {
        break;
      }
      consume();
      const right = parseTerm();
      left = token.value === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = parseExpression();

  // 表达式必须被完整消费，否则说明有多余内容
  if (position < tokens.length) {
    const token = tokens[position];
    if (token.type === 'rparen') {
      throw new ExpressionError('多余的右括号 ")"');
    }
    if (token.type === 'number' || token.type === 'lparen') {
      throw new ExpressionError('缺少运算符，请检查表达式');
    }
    throw new ExpressionError(`运算符 "${token.value}" 的位置不正确`);
  }

  return result;
}

/**
 * 消除浮点误差并校验结果范围。
 * 例如 0.1 + 0.2 在 JS 中等于 0.30000000000000004，这里收敛为 0.3。
 * @param {number} value 原始结果
 * @returns {number} 处理后的结果
 * @throws {ExpressionError} 结果不是有限数（如溢出为 Infinity）时
 */
function normalizeResult(value) {
  if (!Number.isFinite(value)) {
    throw new ExpressionError('计算失败：结果超出可表示范围');
  }
  return Number(value.toPrecision(PRECISION));
}

/**
 * 对外暴露的唯一入口：计算一个数学表达式。
 * @param {string} rawExpression 原始表达式，如 "(1+2)*3"
 * @returns {{expression: string, result: number}} 标准化后的表达式与结果
 * @throws {ExpressionError} 任何用户输入导致的错误
 */
function calculate(rawExpression) {
  const expression = normalize(rawExpression);
  const tokens = tokenize(expression);
  const result = normalizeResult(parse(tokens));
  return { expression, result };
}

module.exports = {
  ExpressionError,
  MAX_EXPRESSION_LENGTH,
  calculate,
  normalize,
  tokenize,
};
