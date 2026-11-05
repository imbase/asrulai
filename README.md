# ASRUL AI 美股雷达 · 公开榜单站

这个仓库是**纯公开**的：只有前端展示页面和每日榜单数据（`data/*.json`）。
选股策略代码不在这个仓库里，也不在任何公开的地方——策略在本机/私有环境跑批，
每天只把结果 JSON 推送到这里。

域名 `asrulai.com` 通过根目录的 `CNAME` 文件绑定（GitHub Pages）。

## 数据格式（数据契约）

`data/YYYY-MM-DD.json` 与 `data/latest.json` 的结构：

```json
{
  "date": "2026-11-05",
  "generated_at": "2026-11-05T06:05:00+08:00",
  "market": "美股",
  "radars": [
    {
      "id": "radar-a",
      "name": "雷达 A · 动量突破",
      "picks": [
        {
          "rank": 1,
          "code": "NVDA",
          "name": "英伟达",
          "score": 94.2,
          "reason": "放量突破前高，机构评级持续上调",
          "tags": ["放量突破", "机构增持"]
        }
      ]
    }
  ]
}
```

- `sample: true` 存在时页面会显示"示例数据"提示条，正式数据不要带这个字段
- `reason`、`tags` 可留空，前端会自动显示"—"

## 部署（GitHub Pages + 自定义域名）

1. 本仓库 → Settings → Pages → Source 选 **GitHub Actions**
2. 域名解析处（你注册 asrulai.com 的平台）添加 4 条 A 记录，指向：
   `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`
3. Settings → Pages → Custom domain 填 `asrulai.com`，勾选 Enforce HTTPS
4. 之后每次 `push` 到 `main`（包括每天推送新榜单），Actions 会自动重新部署

## 每日数据从哪来？

本机雷达跑批完成后，运行私有目录里的 `push_results.py result.json` 即可。
推送用的 Token 只对本仓库有 Contents 读写权限——即使泄露，
最坏情况也只是有人往公开仓库写垃圾数据，策略永远安全。
