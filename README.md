# 豊中市 学校給食献立 Web・API

豊中市が公開している学校給食予定献立表（Excel）を月別JSONへ変換し、Webページと読み取り専用APIで提供する非公式プロジェクトです。

- 公開予定URL: [https://toyonaka-lunch.ogtm.dev](https://toyonaka-lunch.ogtm.dev)
- GitHub: [ogatomo21/toyonaka-school-lunch](https://github.com/ogatomo21/toyonaka-school-lunch)

> [!IMPORTANT]
> 本プロジェクトは豊中市公式ではありません。献立や給食実施日は変更される場合があります。最終的な情報は各学校および豊中市の案内を確認してください。

## 主な機能

- 学校区分・月ごとの給食献立表示
- PC・スマートフォン、ライト・ダークモード対応
- 月別JSONを返すHono API
- 豊中市公式ページ・Excelからのデータ自動取得
- 毎週金曜日18:00（日本時間）のGitHub Actions自動更新
- 複数月Excelの分割、曜日検証、重複検出、タグ・飲料抽出

## 対応区分

- [中学校 Aブロック](https://www.city.toyonaka.osaka.jp/kosodate/gakkou/kyushoku/kondate/chugaku_gimukou/tyugakuR8A.html)
- [中学校 Bブロック](https://www.city.toyonaka.osaka.jp/kosodate/gakkou/kyushoku/kondate/chugaku_gimukou/tyugakuR8B.html)
- [中学校 Cブロック](https://www.city.toyonaka.osaka.jp/kosodate/gakkou/kyushoku/kondate/chugaku_gimukou/tyugakuR8C.html)
- [庄内よつば学園（後期課程）](https://www.city.toyonaka.osaka.jp/kosodate/gakkou/kyushoku/kondate/chugaku_gimukou/tyuugakuyotubakouki.html)
- [小学校 A献立](https://www.city.toyonaka.osaka.jp/kosodate/gakkou/kyushoku/kondate/shogaku_gimuzen/R8Akondate.html)
- [小学校 B献立](https://www.city.toyonaka.osaka.jp/kosodate/gakkou/kyushoku/kondate/shogaku_gimuzen/R8Bkondate.html)

食品名、使用量、栄養価、半製品・加工品の配合表は出力対象外です。

## 技術構成

- Cloudflare Workers / Workers Static Assets
- Hono
- Plain HTML / Vanilla JavaScript
- Tailwind CSS v3
- Python 3 / openpyxl
- GitHub Actions

## ローカルセットアップ

PowerShellでプロジェクトルートを開いて実行します。

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
npm install
npm run types:generate
npm run dev
```

Wranglerが表示するローカルURLをブラウザで開きます。

## 献立データの更新

全区分を更新します。

```powershell
python .\fetch_lunch.py
```

特定区分だけを更新する場合は `--source` を使用します。複数回指定できます。

```powershell
python .\fetch_lunch.py --source middle-a --source elementary-a
```

主なsource ID:

| source ID | 区分 |
| --- | --- |
| `middle-a` | 中学校 Aブロック |
| `middle-b` | 中学校 Bブロック |
| `middle-c` | 中学校 Cブロック |
| `middle-yotsuba` | 庄内よつば学園（後期課程） |
| `elementary-a` | 小学校 A献立 |
| `elementary-b` | 小学校 B献立 |

データは `data/<source-id>/YYYY-MM.json`、取得元索引は `data/index.json` に保存されます。公式ページからリンクされなくなった過去月のJSONは削除しません。

## API

| メソッド | パス | 内容 |
| --- | --- | --- |
| `GET` | `/api` | API情報 |
| `GET` | `/api/sources` | 取得元、対象校、利用可能月 |
| `GET` | `/api/lunches/{source}/{year}/{month}` | 指定月の献立 |
| `GET` | `/api/lunches?source=middle-a&month=2026-09` | クエリ形式で指定月の献立 |

例:

```text
https://toyonaka-lunch.ogtm.dev/api/lunches/middle-a/2026/9
https://toyonaka-lunch.ogtm.dev/api/lunches?source=elementary-a&month=2026-09
```

APIは読み取り専用でCORSを許可しています。不正なパラメーターや存在しないデータは、統一されたJSONエラーを返します。

## 自動更新

`.github/workflows/update-data.yml` は毎週金曜日18:00（日本時間）に起動します。GitHub ActionsのcronはUTCのため、設定値は金曜日09:00 UTCの `0 9 * * 5` です。`workflow_dispatch` による手動実行にも対応しています。

1. 6つの公式ページから献立Excelを取得
2. Pythonテスト、型検査、APIテスト、Worker dry-runを実行
3. `data` に差分がある場合だけ `github-actions[bot]` がcommit・push

Cloudflare Workers BuildsをGitHubリポジトリへ接続すると、このpushを契機に更新版を自動デプロイできます。

## テスト・ビルド

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
npm run check
npm test
npm run build
npm run deploy:dry
```

## Cloudflare Workersへの公開

`wrangler.jsonc` には `toyonaka-lunch.ogtm.dev` をCustom Domainとして設定しています。`ogtm.dev` が同じCloudflareアカウントの有効なZoneに含まれ、同名の競合DNSレコードがないことを確認してください。

```powershell
npx wrangler login
npm run deploy:dry
npm run deploy
```

`npm run deploy` を実行するとWorker本体の公開とCustom Domainの設定が行われます。このリポジトリのテストやdry-runだけでは本番環境は変更されません。

## データと免責事項

- 献立データの著作権・利用条件は原資料の提供元に従います。
- 本リポジトリは原資料を機械的に変換しており、内容の完全性・即時性を保証しません。
- アレルギー対応や給食実施判断には利用せず、必ず学校からの案内を確認してください。

## License

ソースコードは [MIT License](LICENSE) で公開します。

Copyright © 2026 Tomoya Ogawa
