# ObjToSchematic

画像や3DモデルをMinecraftのブロックに変換するツールです。3Dモデルをボクセル化し、Minecraftの設計図ファイル（.schematic, .litematic, .nbt, .schem）としてエクスポートできます。

## 特徴

- **3Dモデルインポート**: OBJ, GLTF形式の3Dモデルをサポート
- **画像から3D生成**: Stability AI APIを使って画像から3Dモデルを生成
- **ボクセル化**: 高度なアルゴリズムで3DモデルをMinecraftブロックに変換
- **複数フォーマットエクスポート**: Minecraftの各種設計図形式に対応
- **リアルタイムプレビュー**: Webブラウザ上で3Dモデルをプレビュー

## 必要条件

- Node.js 16.8.0以上
- Python 3.7以上
- npm

## インストール

1. リポジトリをクローン:
```bash
git clone https://github.com/your-username/ObjToSchematic.git
cd ObjToSchematic
```

2. Node.js依存関係をインストール:
```bash
npm install
```

3. Pythonバックエンドの依存関係をインストール:
```bash
pip install flask flask-cors
```

## 使用方法

### 開発サーバーの起動

```bash
npm start
```

ブラウザで `http://localhost:8080` にアクセスしてツールを使用できます。

### Pythonバックエンドの起動

```bash
python python_backend/app.py
```

### ビルド

```bash
npm run dist
```

## Stability AI APIの設定

画像から3Dモデルを生成するには、Stability AIのAPIキーが必要です：

1. [Stability AI](https://stability.ai/) でアカウントを作成
2. APIキーを取得
3. アプリケーションのUIでAPIキーを入力

**注意**: APIキーはデフォルトで設定されていません。セキュリティのため、自分で取得して入力してください。

## 機能説明

### 3Dモデルインポート
- OBJ/GLTFファイルをアップロード
- 自動的にボクセル化
- リアルタイムプレビュー

### 画像から3D生成
- PNG/JPEG画像をアップロード
- Stability AI APIで3Dモデルを生成
- プロンプトで形状を指定可能

### ボクセル化設定
- 解像度調整
- 色精度設定
- ブロック割り当てアルゴリズム

### エクスポート
- .schematic: クラシックMinecraft設計図
- .litematic: Litematicaモッド用
- .nbt: NBT形式
- .schem: WorldEditスキーマ

## 開発

### テスト実行
```bash
npm test
```

### リンター実行
```bash
npm run lint
```

### アトラスビルド
```bash
npm run atlas
```

## ライセンス

BSD-3-Clause License

## 貢献

プルリクエストやイシューを歓迎します！

## 謝辞

- [Three.js](https://threejs.org/) - 3Dレンダリング
- [Stability AI](https://stability.ai/) - 画像から3D生成API
- [Minecraft](https://www.minecraft.net/) - 素晴らしいゲーム
