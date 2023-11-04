# AtCoder 通知 Bot

## 初期設定

このプロジェクトでは Typescript と Node.js を使用しています。下記のコマンドを実行してインストールしてください

```bash
npm install
tsc
```

## env ファイルの設定

下記のように設定してください

```env
TOKEN=<YOUR DISCORD BOT TOKEN>
DEV_TOKEN=<YOUR DEV DISCORD BOT TOKEN>
ATCODER_SESSION=<YOUR ATCODER SESSION CODE(REVEL_SESSION)>
```

## 実行方法

```bash
npm start     # 本番環境の場合
npm run debug # 開発環境の場合
```
