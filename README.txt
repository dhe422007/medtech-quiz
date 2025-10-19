medtech-quiz (臨床生理 v15.2.8)
----------------------------------
同梱ファイル:
- index.html
- app.js
- sw.js
- manifest.webmanifest
- tools/xlsx-to-questions.html

使い方:
1) tools/xlsx-to-questions.html をローカルで開き、Excel(臨床生理_過去問_2019-2025.xlsx)をドロップ
2) 生成された questions.json をリポジトリ直下に置く
3) 画像は assets/images/ に配置（image列が拡張子なしでもOK。png/jpg/jpeg/webp/gif/svgを順に自動試行）
4) GitHub Pages を ?v=cs15.2.8 を付けて開くか、Service Worker を更新してください
