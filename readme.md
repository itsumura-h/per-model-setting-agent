# Per Model Setting Agent

## ビルド

```bash
pnpm install
pnpm run build
```

`pnpm run build` は `src/ui` の Vite build と `src/extension.ts` の esbuild bundle を実行し、`src/ui/dist` と `dist/extension.js` を作成します。

## VSIX 作成

```bash
pnpm run package:vsix
```

このコマンドは以下を順に実行します。

1. `src/ui` を production build
2. `src/extension.ts` を `dist/extension.js` に bundle
3. `vsce package` で `.vsix` を生成

## VS Code への読み込み

```bash
code --install-extension per-model-setting-agent-0.0.1.vsix
```

VS Code に入ると Activity Bar に `Per Model Setting Agent` のアイコンが表示されます。

- クリックすると左側のサイドバーに UI が開きます
- UI を右 pane に移したい場合は、表示されたビューのタイトル部分を掴んで Secondary Side Bar にドラッグします
- 右 pane が見えていない場合は `View: Toggle Secondary Side Bar Visibility` を実行してください
- 代わりに `Per Model Setting Agent: Move UI to Secondary Side Bar` コマンドも使えます

コマンドパレットから `Per Model Setting Agent: Open Demo` を実行して開くこともできます。
