# 前后端分离计算器系统 · 后端

基于 **Node.js + Express + SQLite** 实现的计算器后端服务。负责表达式校验、解析、计算、
历史记录持久化，并以 JSON API 的形式对前端提供服务。

> 核心原则：**所有计算都在后端完成**。前端只发送表达式字符串，永远不发送计算结果。
> 项目中不使用 `eval` / `new Function` / `exec` 等任何动态执行用户输入的机制。

---

## 一、项目简介

| 项目 | 说明 |
| --- | --- |
| 项目名称 | 前后端分离计算器系统 —— 后端 |
| 主要职责 | 表达式解析与计算、输入校验、异常处理、历史记录增删查查、标准化 API 响应 |
| 计算方式 | 自研词法分析 + 递归下降语法分析（不使用 eval） |
| 数据存储 | SQLite（通过 Node.js 内置 `node:sqlite` 模块，无需安装数据库服务） |

---

## 二、技术栈

| 层次 | 技术 | 说明 |
| --- | --- | --- |
| 运行时 | Node.js >= 22.5.0 | 需要该版本以上，因为用到了内置的 `node:sqlite` |
| Web 框架 | Express 4 | 提供路由与中间件 |
| 数据库 | SQLite | 单文件数据库，通过 `node:sqlite` 的 `DatabaseSync` 同步 API 访问 |
| 测试 | `node:test` + `node:assert` | Node.js 内置测试框架，无需额外依赖 |

整个项目**只有 Express 一个第三方依赖**。

---

## 三、运行环境

- Node.js **>= 22.5.0**（推荐 22 LTS 或更高；本项目在 Node 24.19 上开发与测试）
- 操作系统：Windows / macOS / Linux 均可
- 无需单独安装 MySQL / SQLite 等数据库

检查版本：

```bash
node -v
```

---

## 四、安装方法

```bash
# 1. 进入后端项目目录
cd calculator_backend

# 2. 安装依赖
npm install
```

---

## 五、启动方法

```bash
# 方式一：直接启动（默认 3000 端口）
npm start

# 方式二：开发模式，修改代码后自动重启
npm run dev

# 方式三：指定端口
node src/server.js 8080

# 方式四：通过环境变量指定端口
PORT=8080 npm start
```

启动成功后终端会输出：

```text
==================================================
  前后端分离计算器系统 - 后端服务已启动
  本机地址：http://localhost:3000
  接口前缀：http://localhost:3000/api
  数据库文件：<项目路径>/data/calculator.db
  按 Ctrl + C 停止服务
==================================================
```

验证是否启动成功：

```bash
curl http://localhost:3000/api/health
# {"success":true,"message":"calculator backend is running"}
```

---

## 六、配置说明

后端**不需要任何配置文件**，通过以下方式调整行为：

| 配置项 | 方式 | 默认值 | 说明 |
| --- | --- | --- | --- |
| 服务端口 | 环境变量 `PORT` 或命令行参数 | `3000` | 命令行参数优先级更高 |
| 数据库目录 | 环境变量 `CALC_DATA_DIR` | `<项目根>/data` | 一般无需修改，测试时会用到 |
| 数据库文件名 | 环境变量 `CALC_DB_NAME` | `calculator.db` | 一般无需修改 |

前端通过修改自己的 `src/js/config.js` 中的 `API_BASE` 来指向本后端地址。

---

## 七、数据库初始化方法

**不需要手动初始化**。服务第一次启动时会自动完成：

1. 若 `data/` 目录不存在则自动创建；
2. 若数据库文件不存在则自动创建 `data/calculator.db`；
3. 自动执行建表语句（`CREATE TABLE IF NOT EXISTS`，幂等操作，重复启动不会报错）；
4. 自动创建索引 `idx_history_created_at`。

### 表结构

```sql
CREATE TABLE IF NOT EXISTS calculation_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 主键，自增
  expression  TEXT    NOT NULL,                   -- 计算表达式，如 "(1+2)*3"
  result      REAL    NOT NULL,                   -- 计算结果，如 9
  created_at  TEXT    NOT NULL                    -- 计算时间，"YYYY-MM-DD HH:mm:ss"
);

CREATE INDEX IF NOT EXISTS idx_history_created_at
  ON calculation_history (created_at DESC, id DESC);
```

### 想重置数据库？

直接删除 `data/` 目录后重新启动服务即可（会丢失全部历史记录）：

```bash
rm -rf data
npm start
```

---

## 八、API 接口说明

所有接口统一前缀 `/api`，请求与响应均为 JSON（UTF-8）。

### 通用响应格式

成功：

```json
{ "success": true, "...": "各接口自有字段" }
```

失败：

```json
{ "success": false, "message": "中文错误提示" }
```

### 1. 计算

```http
POST /api/calculate
Content-Type: application/json
```

请求体：

```json
{ "expression": "(1+2)*3" }
```

成功响应 `200`：

```json
{
  "success": true,
  "id": 12,
  "expression": "(1+2)*3",
  "result": 9,
  "createdAt": "2026-09-23 16:06:30"
}
```

失败响应 `400`：

```json
{ "success": false, "expression": "10/0", "message": "除数不能为 0" }
```

### 2. 查询历史记录

```http
GET /api/history?page=1&pageSize=10&keyword=1%2B2
```

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `page` | 否 | `1` | 页码，从 1 开始 |
| `pageSize` | 否 | `10` | 每页条数，最大 100 |
| `keyword` | 否 | 空 | 表达式关键字模糊搜索（扩展功能） |

成功响应 `200`：

```json
{
  "success": true,
  "data": {
    "list": [
      { "id": 12, "expression": "(1+2)*3", "result": 9, "createdAt": "2026-09-23 16:06:30" }
    ],
    "total": 20,
    "page": 1,
    "pageSize": 10,
    "totalPages": 2
  }
}
```

### 3. 删除指定历史记录

```http
DELETE /api/history/12
```

- 成功：`200` `{ "success": true, "message": "删除成功", "id": 12 }`
- 记录不存在：`404` `{ "success": false, "message": "未找到 ID 为 12 的历史记录" }`
- ID 非法：`400` `{ "success": false, "message": "历史记录 ID 必须是正整数" }`

### 4. 清空全部历史记录（扩展功能）

```http
DELETE /api/history
```

响应 `200`：`{ "success": true, "message": "已清空全部历史记录，共删除 20 条", "deleted": 20 }`

### 5. 健康检查

```http
GET /api/health
```

### 状态码约定

| 状态码 | 含义 |
| --- | --- |
| `200` | 成功 |
| `204` | CORS 预检请求通过 |
| `400` | 参数错误 / 表达式非法 / 除以零 |
| `404` | 接口不存在，或要删除的记录不存在 |
| `500` | 服务器内部错误 |

---

## 九、支持的表达式规则

| 能力 | 示例 |
| --- | --- |
| 加减乘除 | `12+8`、`12-8`、`6*7`、`84/4` |
| 运算符优先级 | `1+2*3` → `7`、`8-3*2` → `2` |
| 括号（含嵌套） | `(1+2)*3` → `9`、`((1+2)*(3+4))` → `21` |
| 一元正负号 | `-5+8` → `3`、`3*-2` → `-6`、`-(3+4)` → `-7` |
| 小数 | `1.5+2.25` → `3.75`、`.5+.5` → `1` |
| 浮点误差修正 | `0.1+0.2` → `0.3`（而不是 `0.30000000000000004`） |
| 全角符号自动转换 | `（1+2）×3` → `9`，`×` `÷` `−` `＋` 均可识别 |
| 空白字符忽略 | ` 1 + 2 ` → `1+2` |

### 错误提示一览

| 输入 | 提示 |
| --- | --- |
| 空字符串 / 纯空白 | 表达式不能为空 |
| `1+a` | 包含非法字符："a" |
| `1.2.3` | 数字格式错误：小数点重复 |
| `12.` | 数字格式错误："12." 小数点后缺少数字 |
| `(1+2` | 缺少右括号 ")" |
| `1+2)` | 多余的右括号 ")" |
| `()` | 括号内不能为空 |
| `1+` | 表达式不完整，末尾缺少数字或括号 |
| `1+*2` | 运算符 "*" 的位置不正确 |
| `2(3+4)` | 缺少运算符，请检查表达式 |
| `10/0`、`1/(2-2)` | 除数不能为 0 |
| 超过 200 字符 | 表达式过长，最多支持 200 个字符 |
| 结果溢出 | 计算失败：结果超出可表示范围 |

---

## 十、项目结构

```text
calculator_backend/
├── src/
│   ├── server.js                    # 入口：解析端口并启动 HTTP 服务
│   ├── app.js                       # 装配 Express：中间件、路由、错误处理
│   ├── routes/
│   │   └── api.js                   # 路由表，URL -> 控制器
│   ├── controller/
│   │   ├── calculateController.js   # 处理 POST /api/calculate
│   │   └── historyController.js     # 处理历史记录的查询与删除
│   ├── service/
│   │   ├── calculator.js            # 【核心】表达式词法分析 + 递归下降求值
│   │   └── history.js               # 历史记录的增删查（SQL 都写在这里）
│   └── model/
│       └── database.js              # 数据库连接与建表
├── tests/
│   ├── calculator.test.js           # 计算模块单元测试（34 项）
│   └── api.test.js                  # 接口集成测试（16 项）
├── scripts/
│   └── acceptance-check.js          # 手工验收脚本，打印各接口实际返回
├── data/                            # SQLite 数据文件目录（自动生成，已 gitignore）
├── package.json
├── codestyle.md                     # 代码规范
└── README.md
```

### 分层职责

```text
HTTP 请求
   ↓
routes/api.js         只做 URL 映射
   ↓
controller/           取参数、调用 service、决定 HTTP 状态码与响应体
   ↓
service/              业务逻辑：解析计算 / 拼 SQL
   ↓
model/database.js     数据库连接
   ↓
SQLite 文件
```

这样分层的好处是：控制器里没有一行 SQL，service 里没有一个 `req` / `res`，
两者可以独立修改和测试。

---

## 十一、测试

```bash
# 运行全部测试
npm test

# 也可以单独运行某个测试文件
node --test tests/calculator.test.js
node --test tests/api.test.js
```

测试覆盖：四则运算、优先级、括号、一元正负号、小数、浮点误差修正、
全部错误分支、除以零、以及 API 的增查删与状态码。

### 手工验收脚本

先启动服务，另开一个终端执行：

```bash
node scripts/acceptance-check.js
# 或指定其他后端地址
BASE_URL=http://localhost:8080/api node scripts/acceptance-check.js
```

它会依次请求所有接口并把返回结果打印出来，方便逐条核对。

---

## 十二、与前端对接说明

1. 先启动本后端，确认 `http://localhost:3000/api/health` 能正常返回；
2. 打开前端工程 `calculator_frontend`，按需修改 `src/js/config.js`：

   ```js
   // 本地开发用的后端地址
   const LOCAL_API_BASE = 'http://127.0.0.1:3000/api';

   // 线上部署后的后端地址（换成你自己的服务地址）
   const PROD_API_BASE = 'https://calculator-backend-arto.onrender.com/api';
   ```

   页面会根据当前访问的域名自动在两者之间切换，
   所以同一份前端代码在本地和线上都能直接用，不需要改代码。

3. 启动前端后，页面右上角会显示「后端已连接」；
4. 若显示「后端未连接」，请检查后端是否启动、端口/域名是否一致、是否被防火墙拦截。

后端已开启 CORS（`Access-Control-Allow-Origin: *`），因此前端部署在任何域名或端口都能访问。

> **注意**：本项目后端已部署在 Render 免费实例上，
> 15 分钟无访问会休眠，冷启动需要 30~60 秒。
> 如果前端一开始显示「后端未连接」，等一会儿刷新即可。

---

## 十三、部署提示

后端可部署到任意支持 Node.js 的 PaaS 平台（如 Render、Railway、Fly.io）或自己的服务器：

```bash
# 生产环境建议用 PORT 环境变量指定平台分配的端口
PORT=8080 node src/server.js
```

注意事项：

- SQLite 数据文件位于 `data/` 目录，容器化部署时建议挂载持久化卷，否则重启后历史记录会丢失；
- 若使用免费实例，注意服务休眠会导致首次请求较慢；
- 部署后请把前端 `src/js/config.js` 中的 `API_BASE` 改成线上后端地址。
