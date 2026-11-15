# Pink Live Windows 同步端（部署说明）

数据目录：D:\PinkLive\
数据库：D:\PinkLive\pink_live.sqlite3

## 重要
此目录中的 server.py 是同步接收端原型，尚未与 iPhone APP 连接。不要直接将本地 8765 端口映射到公网。请先完成 HTTPS 隧道、认证、手机端同步、冲突处理及恢复测试。

## Windows 10 / Python 3.12
1. 从 GitHub 下载本目录的 server.py 和 backup.py，放在 D:\PinkLive\app\。
2. 打开 PowerShell：
   cd D:\PinkLive\app
   $env:PINK_LIVE_DB = 'D:\PinkLive\pink_live.sqlite3'
   $env:PINK_LIVE_TOKEN = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   python .\server.py
3. 这是临时测试启动方式，关闭终端后服务停止。不要把 token 发送给任何人，也不要提交到 GitHub。正式运行需将 token 安全保存到电脑凭据存储，并设置开机自启。
4. 本地测试可运行 backup.py 生成一致性备份（支持 WAL 数据库）。
5. Cloudflare Tunnel 需要稳定的域名与安全访问控制。仅有临时 Quick Tunnel URL 不适合作为持久同步地址。

## 备份
python .\backup.py
默认备份目录 D:\PinkLive\backups。建议在 Windows 任务计划程序中每天运行，并另外保留离线副本。当前脚本仅保留最近 30 份备份。

## 数据保护
- 现有 iPhone 本地数据不受这些新文件影响。
- 电脑端还没有收到任何手机数据。
- 此服务器原型只接受新日期记录，遇到同日期内容不同会返回 conflicts，不会覆盖。
- 完整部署前须加入更新冲突处理、HTTPS、同步状态提示和恢复流程。
