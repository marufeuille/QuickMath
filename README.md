# QuickMath

![Demo](resource/demo.gif)

## これは何？

- ブラウザ上で表示された数式を右クリックから計算するだけの chrome extension です
- どのようなウェブサイトの背景色でも計算結果が見やすく表示されるよう、適応型カラースキームを採用しています

## 特徴

- 選択したテキストを数式として計算
- ウェブサイトの背景色を自動検出し、最適なコントラストでポップアップを表示
- 明るい背景では暗いポップアップ、暗い背景では明るいポップアップを表示

## 使い方

1. ウェブページ上で計算したい数式を選択
2. 選択した部分を右クリック
3. 「数式を計算する」をクリック
4. 結果がポップアップで表示されます

## 使用している技術類

- [Math.js](https://github.com/josdejong/mathjs)
- [ICOOON MONO](https://icooon-mono.com/license/)

## テスト

拡張機能の動作確認には以下のテストページが利用できます：

- `extension_test/test_page.html` - 基本的な数式のテスト
- `extension_test/test_backgrounds.html` - 様々な背景色での表示テスト
