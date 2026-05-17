# StormLooper

ブラウザで動く Web Audio API ベースのルーパーアプリ。ビルド不要、依存ライブラリなし。

![StormLooper screenshot](ss.png)

## 特徴

- **複数ループトラック** — トラックを自由に追加可能
- **3種類の入力ソース** — 🎤 MIC（マイク録音）/ 🎹 SYNTH（シンセ録音）/ 📂 FILE（音声ファイル読み込み）
- **ビート同期録音** — REC を押すと次の小節頭まで待機し、カウントダウン小節から録音終了までメトロノームが鳴り続ける
- **バー同期再生** — ループは常に次の小節頭から開始
- **LENGTH / TIMING** — ループ周期と再生位相を独立して制御
- **ドラッグで音量・パン設定** — 縦軸が音量（上=0dB）、横軸がステレオパン
- **ラジアル波形** — LENGTH・TIMING を反映したリング状波形表示
- **内蔵シンセ** — オシレーター・ADSR・共振 LPF・PC キーボード演奏対応
- **シーン機能** — Ctrl+Alt+0〜9 で保存、Ctrl+0〜9 でリコール
- **マスター DELAY / FILTER / VOL / METRO VOL** — ヘッダーのスライダーで一括調整

## 動作環境

Web Audio API と ES Modules に対応したモダンブラウザ（Chrome 80+、Firefox 75+、Safari 14+）。  
ES Modules の制約により、ローカルの HTTP サーバー経由で開く必要があります。

```bash
npx serve .          # Node.js
python -m http.server 8080  # Python
```

ブラウザで `http://localhost:3000`（ポートはサーバーに応じて変更）を開き、**START** をクリックしてください。

## 使い方

### ループを録音する

1. **＋ Add Track** でトラックを追加
2. ソースを選択（FILE はファイルピッカーが即時開く。複数マイクがある場合は INPUT セレクターで選択可）
3. MIC / SYNTH の場合は **REC** をクリック
   - 次の小節頭まで待機（`⏳ WAIT`）したあと、カウントダウン小節からメトロノームが開始
   - 録音中もメトロノームは鳴り続ける
4. 演奏が終わったら **STOP REC** → 次の小節から自動再生
   - 録音末尾が小節境界の 0.5 拍以内に収まる場合は自動的にトリミング

### LENGTH と TIMING

| 設定 | 効果 |
|------|------|
| LENGTH | ループ周期を録音長さとは独立して指定（1Beat〜16Bars / Auto） |
| TIMING | 再生位相を −64〜+64 拍の範囲でシフト（+N = N 拍遅れて再生、−N = N 拍先読み） |

変更は次の小節境界で反映されます。

### キーボードショートカット

| キー | 動作 |
|------|------|
| `1`〜`9` / `0` | トラック 1〜9 / 10 の再生トグル |
| `Space` | 選択トラックの REC トグル |
| `A S D F G H J K` | シンセ白鍵（C D E F G A B C） |
| `W E T Y U` | シンセ黒鍵（C# D# F# G# A#） |
| `Ctrl+Alt+0〜9` | シーン保存 |
| `Ctrl+0〜9` | シーン呼び出し |

BPM フィールドにフォーカス中は ↑↓ で ±1、Shift + ◀▶ で ±10。

## ファイル構成

```
js/
├── main.js        # 起動・配線
├── styles.js      # CSS（<style> タグとして挿入）
├── AudioEngine.js # AudioContext・マスターゲイン・コンプレッサー
├── Transport.js   # BPM クロック・スケジューラー
├── LoopTrack.js   # ループトラック・LoopScheduler・波形
├── Recorder.js    # ビート同期録音（MediaRecorder）
├── Metronome.js   # オーディオ精度のクリック音・音量制御
├── Synth.js       # オシレーターシンセ
└── UI.js          # DOM をすべて JS で生成
```

## ライセンス

MIT
