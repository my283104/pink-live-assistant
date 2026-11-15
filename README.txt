粉兔直播助手 Pink Live 1.0

这是抖音每日直播数据记录 PWA：
- 每天一条记录（同一天重复保存会更新）
- 核心字段：成交金额、转化率（百分比）、场观
- 首页今日看板、月度汇总、金额/场观/转化率趋势
- 历史记录修改
- 导出 CSV 和 JSON
- 本地浏览器存储，不需要账号或服务器数据库

iPhone 安装：
1. 将整个文件夹部署到支持 HTTPS 的静态网站（例如 GitHub Pages）。
2. iPhone 用 Safari 打开部署网址。
3. 点分享 -> 添加到主屏幕。
4. 从主屏幕图标启动。

注意：
- 目前尚未部署到公开 HTTPS 地址；下载后可以先在电脑浏览器打开 index.html 体验。
- 账单数据保存在当前设备、当前浏览器的 localStorage。清理 Safari 网站数据或更换设备可能丢失，请定期导出 JSON/CSV。
- 离线缓存需通过 HTTPS 服务访问后才启用。
- 机器人预留数据结构示例：
  { "date":"YYYY-MM-DD", "platform":"douyin", "currency":"CNY",
    "amount":0, "conversion_rate":0, "views":0, "note":"",
    "updated_at":"ISO-8601", "schema_version":1 }
- 当前没有后端 API；未来需新增同步/API 层，并处理设备身份验证、冲突和备份。
