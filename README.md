# 🚗 车载嵌入式求职冲刺营

面向嵌入式软件工程师求职的**个人复习站点**：左侧导航 + 知识点卡片（每个知识点配「用例 / 示例代码」）+ 全站搜索 + 打卡进度（保存在浏览器本地）+ 暗色模式。纯静态、零依赖，托管在 GitHub Pages 即可在线访问。

## 站点结构

```
tbox-prep-site/
├── index.html          # 入口页面
├── assets/
│   ├── style.css       # 样式（亮/暗双主题、响应式）
│   └── app.js          # 导航 / 路由 / Markdown 渲染 / 搜索 / 打卡
├── content/            # ★ 所有内容都是 Markdown，直接编辑即可
│   ├── 00-overview.md      # 总览与时间线
│   ├── 01-target.md        # 目标定位与目标公司
│   ├── 02-c.md             # C 语言与数据结构（含面经补充题）
│   ├── 13-memory.md        # C 语言内存分布与管理（内存四区/堆栈/malloc/碎片）
│   ├── 11-cpp.md           # C++ 面试题
│   ├── 03-os.md            # 操作系统与 Linux
│   ├── 04-net.md           # 网络与 MQTT
│   ├── 12-embedded.md      # 嵌入式基础（总线/中断/外设/ARM/BootLoader）
│   ├── 05-auto.md          # 车载协议与 OTA
│   ├── 14-ota.md           # ★ OTA 专项（学习 + 复习：分区/回滚/安全/刷写/排查/自测题）
│   ├── 06-algo.md          # 算法与手写题
│   ├── 07-projects.md      # 项目故事库
│   ├── proj-pcc.md         # 项目复习：预见性巡航 PCC
│   ├── proj-gnss.md        # 项目复习：GNSS 固件升级
│   ├── proj-adas.md        # 项目复习：主动安全系统
│   ├── proj-bus.md         # 项目复习：云公交一体机
│   ├── proj-market.md      # 项目复习：市场问题分析
│   ├── proj-ota.md         # 项目复习：OTA 链路排查
│   ├── 08-interview.md     # 自测题库
│   ├── 09-resume.md        # 优化版简历
│   └── 10-checkin.md       # 每日打卡表
└── README.md
```

## 本地预览

> ⚠️ 直接双击 `index.html` 会因浏览器安全限制无法加载内容，请用本地服务器：

```bash
# 方式一：Node（本机已装 node）
node serve.js
# 然后浏览器打开 http://127.0.0.1:8765

# 方式二：VS Code 装 Live Server 插件，右键 index.html → Open with Live Server
```

（`serve.js` 是一个零依赖的极简静态服务器，约 40 行。）

## 部署到 GitHub Pages（免费在线访问）

### 方式一：一键脚本（推荐，全程浏览器授权，无需输入密码）

在 `tbox-prep-site` 目录打开 PowerShell 终端，运行：

```powershell
.\deploy-github.ps1
```

脚本会自动：登录 GitHub（打开浏览器完成授权）→ 创建公开仓库 `tbox-prep` → 推送全部文件 → 开启 GitHub Pages。完成后输出网站地址。

### 方式二：手动操作

1. 在 GitHub 新建一个仓库（Public，名字如 `tbox-prep`），**不要**勾选初始化 README
2. 在仓库根目录执行（或把 `tbox-prep-site/` 内容直接上传到仓库根目录）：

```bash
git init -b main
git add .
git commit -m "init: 求职冲刺营站点"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

3. 仓库 Settings → Pages → **Build and deployment** → Source 选 **Deploy from a branch** → 分支 `main`、目录 `/ (root)` → Save
4. 等 1~2 分钟，访问：`https://<你的用户名>.github.io/<仓库名>/`

之后每次改完 `content/*.md`：

```bash
git add . && git commit -m "update" && git push
```

## 内容格式约定（编辑 content/*.md 时遵守）

- `## 模块名`：小节标题；`### 知识点`：知识点卡片（自动加左侧强调线）
- `> 引用`：提示卡（用于"要点总结 / 注意事项"）
- `` ```c `` 代码块：带语言标签和「复制」按钮
- `- [ ] 待办` / `- [x] 已完成`：**自动变成可点击的打卡项**，进度条在页面顶部，状态存浏览器 localStorage
- 行内 `**加粗**` 和 `` `代码` `` 都会被渲染

## 知识点的推荐写法

每个知识点尽量包含四行：

```
**一句话要点**：面试能直接背的 1-2 句
**面试怎么问**：真实面试问法
**用例 / 示例**：C 代码示例或真实场景
**关联项目**：对应你自己的哪个项目（PCC / GNSS升级 / eMMC-eSIM / …）
```
