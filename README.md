# 朝曦家办 · 客户全流程小助手

面向客户经理的销售侧智能助手：从闲聊识别客户信息，逐步补全五维画像（主体 / 行业 / 资产 / 事件 / 约束），
匹配痛点库并确认，再匹配 SKU、输出落地步骤与供应商配合事项，最终可导出一份可编辑的客户方案网页。

> 这是一个**独立系统**，不依赖任何其他内部平台，也不与其他项目共用架构或数据。

## 直接使用

已部署为静态站点，浏览器打开即可，无需安装：

```
https://<用户名>.github.io/<仓库名>/
```

## 内置样例

首次打开会自动载入一条完整的样例客户对话（客户名已脱敏），覆盖从需求识别到方案输出的全流程，
共 44 条消息，含引导提问、痛点确认、SKU 推荐、方案落地步骤表、供应商需配合事项表。

**该样例每次打开都会自动还原**，任何人改动或删除都不影响下一位访问者看到的内容。
想自己走一遍流程，请新建客户对话。

## 想体验 AI 生成功能

样例对话是纯本地渲染，**不需要任何配置即可查看**。

如果要自己新建对话、让 AI 实际生成内容，需要在页面右下角「API 设置」中填入自己的
DeepSeek API Key（或任意 OpenAI 兼容服务的地址与 Key）。

**本仓库不包含任何 API Key。** 每位使用者填写的 Key 只保存在自己浏览器的 localStorage 中，
不会上传，也不会进入本仓库。

## 数据存储

- 客户对话保存在**访问者自己浏览器的 IndexedDB** 中，不上传服务器
- 换浏览器或换设备看不到此前的对话
- 页面内提供「导出备份 / 导入备份」用于迁移

## 目录说明

| 内容 | 说明 |
|------|------|
| `客户全流程小助手.html` / `index.html` | 页面主体（两者内容相同，后者用于根路径访问） |
| `assistant_app.js` / `.css` | 主应用逻辑与样式 |
| `assistant_plan.js` / `assistant_sop.js` | 方案与落地步骤模块 |
| `demo_seed.json` | 内置样例对话 |
| `pain_points_db.json`、`pain_point_export_*.xlsx` | 痛点库 |
| `全量SKU知识卡片-*.xlsx`、`sku_wide_questions_15.json` | SKU 知识卡片与宽表核心问题 |
| `sku_landing_sop_15.json`、`sku_landing_supplier_15.json`、`sku_supplier_summary_15.json` | 落地步骤与供应商配合事项 |
| `sku_ppt_content_15.json`、`sku_ppt_images/` | SKU 方案图文（文字页转结构化文本，关系结构图保留为图片） |
| `sku_long_images/` | SKU 长图素材 |

## 更新方式

本目录由源项目的 `build_publish.py` 生成，请勿直接手改。
在源项目目录下运行：

```bash
python -X utf8 build_publish.py
```

然后在本目录提交推送：

```bash
git add -A && git commit -m "更新" && git push
```

构建脚本会保留 `.git`、`.gitignore` 与本 README，并在构建时自动清空硬编码的 API Key、
排除真实客户档案与访问日志。
