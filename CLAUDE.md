# CLAUDE.md: ISCIIA 2026 の講演サイトとスライド

このリポジトリで作業するセッションへの引き継ぎです。ユーザー（講演者 Seiki Ubukata）とのやり取りで決まった方針と、仕組み・確認の手順をまとめています。方針が変わったら、ここも直してください。

## 講演とリポジトリ

- 正式な表記: Keynote, China-Japan Bilateral Symposium on Advanced Computational Intelligence, ISCIIA 2026（北京）。
  2026-10-30 11:50–12:20（北京時間）。題目は "Uncertainty, Topology, and Graphs in Prototype-Based Learning"。副題は使わない。
- 公開: GitHub Pages が `main` のルートをそのまま配信する（ビルドなし、`.nojekyll`）。
  講演サイト https://subukata.github.io/isciia2026/ 、スライド https://subukata.github.io/isciia2026/slides/
- 中国本土から開けるよう、外部ホスト（Google Fonts、CDN など）に頼らない。必要なものは `slides/vendor/` に同梱する。
- 主なファイル:
  - `index.html`: 講演サイト（1 ファイル、CSS も中）
  - `slides/index.html`: スライドの文・式・スタイル（各シーンは `<section class="scene" data-id=...>`）
  - `slides/js/main.js`: 進行、配置（split、式の行、文の大きさ）、タイマー
  - `slides/js/scenes-*.js`: 各シーンの図
  - `slides/data.js`: 保存済みの実験結果（生成物。手で編集しない）
  - `open_local.cmd`: オフラインで発表するとき用（Windows、Python の簡易サーバー）
  - `backup/slide-notes.md`: 削除したスライドノートの控え
  - `tools/`: 確認と PDF 書き出しのスクリプト
- もとは別リポジトリ（`paper/2026_ISCIIA_招待講演/slides/mirror/build_mirror.py`）から作ったミラー。その後はこのリポジトリを直接直しているので、ミラーを作り直すとここの変更が上書きされる。

## ユーザーとのやり取り

- 日本語で、短く。
- 流れ: 作業ブランチで直す → ローカルで確認（下記） → push → PR を作って squash マージ → 公開ページで確認。
  ユーザーの指示（2026-10-29）: 修正が完了し確認も済んだら、ユーザーに尋ねずにマージまで進める。
- マージ済みのブランチで続けるときは、最新の `main` から作り直す。
- ページ番号は段階ごとの通し番号（2026-10-30 から。右下の数字、URL の `#番号`、「番号 + Enter」で移動）。
  ユーザーは段階のことを「シーン」とも呼ぶ。段階が変わるたびに番号が 1 つ増える（`main.js` の `firstPage`・`pageOf`）。
  - 古い URL 形式 `#5.2`（場面 5 の 2 段階目）も開ける。
  - 順は `main.js` の `talk` 配列の順で、HTML の section の並びとは違う。
  - 下のメモの「ページ n」はこの番号（2026-10-30 時点、全 45 ページ）。場面 id も併記する。
  - ユーザーは公開版を見て番号を言うことが多い。未公開の変更で番号がずれていないか気をつける。

## スライドの書き方（ユーザーの指摘から）

- 聴衆がすぐわかる、短く言い切る文にする。指摘への言い訳や弁解に読める言い回しは避ける。
  - 悪い例: "A clustering is not only its prototypes but also its assignment: ..."
  - 良い例: "Goal: Find prototypes and assign each data point to a cluster. / We need one measure of clustering quality."
- 折り返しで語が 1 つだけ行に残る（"is." など）なら言い換える。
- 式に出てこない記号はその段階で説明しない。説明不要と言われた記号（`r_c`）は書かない。
- 更新式は「∝」や中間の記号（SOM-OLP の `q_ci` など）を使わず、書き下す（ページ 31、場面 `bcd` の u の式）。
- 発表時間が限られている（30 分枠）。枝分かれは削る: GRCM はスライドから外し、LRCM・PRCM から直接 ExRCM へ
  （ページ 16、場面 `family`。`scenes-part1.js` の `SHOWN`。GRCM のコードは残してある）。講演サイトの論文・手法の一覧には GRCM が残っている。
- 補足に逃がした話題は本編で触れない: Heskes の SOM は補足なので、計算コスト（O(nC) と O(nC²) の比較）も本編に出さない。
- 実データは 1 枚（ページ 32、場面 `real`）: 左に Iris、右に Digits。SOM-OLP の地図だけで、Batch SOM の結果は出さない
  （元の場面 `iris`・`digits` はコードと section を残してあるが、デッキには入れていない）。
  地図は調整済みの λ（格子点のあいだ）と小さい λ = 0.02（格子点の上）のあいだを、止まらずに行き来し続ける
  （片道 3.5 秒の余弦。毎フレーム `S.place` で位置を置く）。
  Digits の小さい λ の結果は worker が 3 つ目に計算する（デッキを開いて約 13 秒で 3 つとも終わる）。
- 項の説明は「何をする項か」を一言で。例: data fit はプロトタイプをデータに合わせる、lattice distance は潜在位置を格子点に合わせる、entropy は帰属の曖昧さを調整する。
- 目的関数 J の推移グラフ（メーター）は使わない（どの段階にも出さない）。
- スライドノート（`<aside class="notes">`）は使わない。
- 図はできるだけ大きく。空きがあれば使う（下記の `data-beside`、`data-wide`）。下の文字を小さくしない。
- 冗長な続きのページはまとめる（例: ページ 19、場面 `roughset`。近傍の定義・Idea・3 点の近傍の図を 1 ページに。
  ページ 29、場面 `latent`。SOM-OLP の新しい変数 v の説明を、Batch SOM との比較の図のページに入れ、`bcd` の motive を外した）。
- わかりにくいスライド、時間の足りない話題は補足に移す（例: 協調フィルタリングの例、場面 `cfex`、2026-10-30）。
  - `talk` の中で `{ ...scene, supplement: true }` にする。
  - section を `data-part="5"` と `data-lit="<部>"` にし、タイトルを "Supplement: ..." にする。
  - 補足の目次（`supp` の文、`scenes-outline.js` のチップ）も直す。
- スライドの文は英語。用語はスライド間でそろえる（data point、prototype、membership など）。
  所属は「is in」ではなく「belongs to」で書く（i belongs to c）。k-means の J は「the sum of within-cluster squared errors」と呼ぶ。

## 仕組みのメモ

- ステージは 1600 × 900 単位で、1rem = 20 単位。
- 段階: 要素の `data-steps="0,1"`（0 始まりで、デッキ上の段階）。
  - シーンの段階を減らすときは `remap(scene, map)` を使い、使わない段階のコードは残す（このリポジトリの流儀）。
  - `withMotive`（最初に問題提起の箱）、`withIdea`（式の前に言葉の段階）。
- `data-split`: 指定した段階で「左に文、右に図」の配置にする。式が文の列に入らなければ、式は専用の行になる（`eq-row`）。
- `data-beside`（`eqband` に付ける）: 式の行でも、図を式の右に置く（例: ページ 6、場面 `kmeans`）。式が 2 行に折り返すときは、
  最後の行の右に置く（例: ページ 31。1 行目に長い u の式、2 行目に v と b）。
  `data-beside` の帯は必ず式の行になる（題目下の一文が全幅になる。例: ページ 22、場面 `objective`。式と図の高さは CSS の `top` で調整できる）。
- `data-wide="720"` など（文の要素に付ける）: `data-split` の段階で、文の列幅を指定する（既定 560）。
  式の行がある段階と、式のない段階の両方で効く。
  広げると図が狭くなり、図のラベルが切れることがあるので必ず目で見る。
- 文は空きに合わせて自動で大きくなる（`main.js` の `fitWords`）。窮屈に見えても、実は拡大されているだけのことがある。
- 右上の QR（`#corner-qr`）は 4.8rem（96 単位）。Ours タグはその左（`right: 5.6rem`）。
  題目が長いと Ours タグとぶつかるので、題目の右端は 1380 単位あたりまで（ページ 31 は字幅を詰めている）。

## 確認（push の前に必ず）

1. リポジトリのルートで `python3 -m http.server 8765`
2. `node tools/check_deck.js --shots <保存先> 6 35 ...`（ページ番号）
   - 全段階を順に送り、エラー・止まった図・メーターの有無を報告する。
   - 指定したページは 1600 × 900 の PNG に保存する。
3. 変えた段階のスクリーンショットを目で見る（文のはみ出し、図のラベル切れ、重なり、孤立した語）。
4. マージ後は `https://subukata.github.io/isciia2026/slides/?t=<時刻>` で公開版を確認する。
- キャッシュの注意: GitHub Pages は `max-age=600`。ふつうの再読み込みでは HTML だけ新しくなり、JS は古いまま使われる。
  新旧が混ざると、図が段階ごとにずれて見える。ユーザーには強制再読み込み（Ctrl+Shift+R）を案内する。`open_local.cmd` でも同じことが起こる。

## PDF

- `node tools/export_pdf.js <出力.pdf>`: 段階ごとに 1 ページ、16:9（1200 × 675 pt）。各ページ 1920 × 1080 の JPEG、約 13 MB。
  Python の Pillow が必要。以前の無損失 3200 × 1800 版（約 25 MB、Chromium で印刷して pypdf で整える）は、
  ユーザーの環境で開けなかった（2026-10-29）。PDF は軽く素直な作り（JPEG・DeviceRGB・色プロファイルなし）にする。
