# 代码规范（后端）

> **规范来源**
>
> 本文档以 **[Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)**
> 为主要依据，并参考 **[Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)**
> 与 Node.js 官方文档，结合本项目（Node.js + Express + SQLite）的实际情况做了裁剪与补充。
>
> - Google JavaScript Style Guide：<https://google.github.io/styleguide/jsguide.html>
> - Airbnb JavaScript Style Guide：<https://github.com/airbnb/javascript>
> - Node.js 官方文档：<https://nodejs.org/api/>

---

## 1. 文件与目录

| 规则 | 说明 |
| --- | --- |
| 文件名使用小写字母 + 中划线或驼峰 | 本项目采用小驼峰：`calculateController.js`、`database.js` |
| 一个文件只导出一个主要模块 | 通过 `module.exports` 导出，避免同名冲突 |
| 目录按职责划分 | `routes` / `controller` / `service` / `model` 四层 |
| 测试文件放在 `tests/` 下，命名为 `*.test.js` | 便于 `node --test` 自动识别 |

## 2. 文件头与严格模式

每个 JS 文件顶部使用块注释说明**这个文件是干什么的**，随后紧跟 `'use strict';`：

```js
/**
 * 表达式计算模块。
 * 设计目标：不使用 eval，支持优先级、括号、一元正负号。
 */

'use strict';
```

## 3. 命名

| 类型 | 规范 | 示例 |
| --- | --- | --- |
| 变量 / 函数 | 小驼峰 | `expression`、`parsePrimary` |
| 类 | 大驼峰 | `ExpressionError` |
| 常量 | 全大写下划线 | `MAX_EXPRESSION_LENGTH`、`DB_FILE` |
| 私有含义的变量 | 不加下划线，用作用域表达 | 模块内的 `let db` 即为私有 |
| 布尔变量 | 用 `is` / `has` / `can` 开头 | `isFinite`、`hasError` |
| 数据库字段 | 蛇形命名 | `created_at` |
| API 返回字段 | 小驼峰 | `createdAt` |

数据库的蛇形命名与 API 的驼峰命名之间的转换，**只允许发生在 service 层**（见 `toHistoryItem`）。

## 4. 格式化

| 项目 | 规定 |
| --- | --- |
| 缩进 | 2 个空格，禁止使用 Tab |
| 行宽 | 不超过 100 个字符 |
| 分号 | 语句末尾必须写分号 |
| 引号 | 字符串统一使用单引号，JSON 与模板字符串除外 |
| 尾随逗号 | 多行数组 / 对象 / 参数列表末尾保留尾随逗号 |
| 空行 | 逻辑块之间空一行；函数之间空一行 |
| 大括号 | 即使是单行 `if` 也必须写大括号 |

```js
// 正确
if (right === 0) {
  throw new ExpressionError('除数不能为 0');
}

// 禁止
if (right === 0) throw new ExpressionError('除数不能为 0');
```

## 5. 注释

- **所有导出的函数都必须写 JSDoc**，说明参数与返回值：

  ```js
  /**
   * 保存一条计算历史。
   * @param {string} expression 标准化后的表达式
   * @param {number} result 计算结果
   * @returns {{id: number, expression: string, result: number, createdAt: string}}
   */
  ```

- 注释解释**为什么**这么做，而不是复述代码在做什么；
- 复杂的算法（如递归下降解析）必须逐层说明设计思路；
- 禁止提交被注释掉的死代码。

## 6. 模块

- 统一使用 CommonJS（`require` / `module.exports`），与 Express 生态保持一致；
- 内置模块使用 `node:` 前缀：`require('node:fs')`、`require('node:sqlite')`；
- 引入顺序分组，组间空行：① Node 内置模块 → ② 第三方模块 → ③ 本地模块。

```js
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const express = require('express');

const { calculate } = require('../service/calculator');
```

- 导出对象时按**字母顺序**排列属性，便于查找（本项目 `module.exports` 均遵循此规则）。

## 7. 变量与函数

- 默认使用 `const`，需要重新赋值时才用 `let`，**禁止使用 `var`**；
- 函数保持单一职责，超过约 40 行考虑拆分；
- 优先使用箭头函数处理回调；需要函数提升（互相递归引用）时使用函数声明；
- 使用 `Number.parseInt(value, 10)` 并显式传入进制。

## 8. 错误处理

这是本项目最重视的一条：

- 区分**业务异常**与**系统异常**：
  - 用户输入问题 → 抛 `ExpressionError` → 400；
  - 其他 → 交给全局错误中间件 → 500；
- 禁止吞掉异常（空 `catch` 块）；
- 错误信息面向用户，使用中文且明确指出问题所在；
- 所有控制器使用 `try / catch`，异步操作交给 `next(error)`。

```js
try {
  const { expression, result } = calculate(req.body.expression);
  // ...
} catch (error) {
  if (error instanceof ExpressionError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return next(error);
}
```

## 9. 安全

| 规则 | 说明 |
| --- | --- |
| **禁止 `eval` / `new Function` / `exec`** | 绝不把用户输入当代码执行 |
| 表达式长度限制 | 最多 200 字符，防止超长输入消耗资源 |
| 请求体大小限制 | `express.json({ limit: '16kb' })` |
| SQL 全部使用参数绑定 | `db.prepare('... WHERE id = ?').run(id)`，禁止字符串拼接 SQL |
| ID 参数必须校验 | `parseId()` 保证是正整数 |
| 分页大小设上限 | `MAX_PAGE_SIZE = 100` |

## 10. 数据库

- 建表语句集中在 `model/database.js`，使用 `CREATE TABLE IF NOT EXISTS` 保证幂等；
- 连接只初始化一次（单例），避免重复打开文件句柄；
- 列名、表名使用蛇形命名；
- 高频查询字段建立索引。

## 11. API 设计

- 统一前缀 `/api`，统一 JSON 响应；
- 响应体始终带 `success` 布尔字段；
- 失败时带面向用户的 `message` 字段；
- 正确使用 HTTP 状态码（200 / 400 / 404 / 500）；
- 路由按资源组织，`DELETE` 操作必须真正删除数据库记录。

## 12. 日志

- 启动信息、请求日志输出到标准输出；
- 系统错误使用 `console.error` 输出完整堆栈；
- 禁止在响应体里返回堆栈信息（防止泄露内部实现）。
