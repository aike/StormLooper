# StormLooper

ブラウザで動く Web Audio API ベースのルーパーアプリ。即興的にループを重ねていくのに特化したUIデザインで、ライブパフォーマンスやアイデアスケッチに適した設計となっている。

![StormLooper screenshot](ss.png)

## Live demo

デモモード  
https://aike.github.io/StormLooper/?demo=1  
  
Playモード  
https://aike.github.io/StormLooper/  


## 特徴

- **2次元ミキサー** — 上下左右のドラッグで音量・パン設定
- **トラック数無制限** — トラックを自由に追加可能
- **3種類の入力ソース** — 🎤 MIC（入力デバイスから録音）/ 🎹 SYNTH（内蔵ソフトシンセ）/ 📂 FILE（音声ファイル読み込み）
- **録音のUndo** — 直前の録音を取り消し可能(z/Ctrl+z/Cmd+z)
- **内蔵音源** — 外部デバイスがない場合も内蔵シンセサイザーで録音可能
- **シーン機能** — Ctrl+Alt+0〜9 でミキサー状態の保存、Ctrl+0〜9 でリコール
- **FX** — マスターFXとしてフィルターとコンプレッサー、センドFXとしてディレイを搭載

## 動作環境

Web Audio API と ES Modules に対応したモダンブラウザ（Chrome 80+、Firefox 75+、Safari 14+）。  
ES Modules の制約により、ローカルで利用する場合も HTTP サーバー経由で開く必要があります。

```bash
npx serve .                 # Node.js
python -m http.server 8080  # Python
```

ブラウザで `http://localhost:3000`（ポートはサーバーに応じて変更）を開き、**START** をクリックしてください。

## 使い方

### ループを録音する

1. **Add Track** ボタンでトラックを追加（ショートカット `N`）
2. ソースを選択（FILE はファイルピッカーが即時開く。入力デバイスが複数がある場合は INPUT セレクターで選択可）
3. MIC / SYNTH の場合は **REC** をクリック（ショートカット `Space`）
4. 演奏が終わったら **STOP REC**（ショートカット `Space`）
5. 録音完了後に **Z** または **Ctrl+Z** を押すと録音が Undo され、直前の録音データが復元される

### LENGTH と TIMING

| 設定 | 効果 |
|------|------|
| LENGTH | ループ周期を録音長さとは独立して指定（1Beat〜16Bars / Auto）。初期値は 1 Bar |
| TIMING | 再生開始位置を −64〜+64 拍の範囲でシフト（+N = N 拍遅れて再生、−N = N 拍先読み） |

変更は次の小節境界で反映されます。

### シーン操作

ミキサーの状態をシーンとして保存・呼び出しすることができます。  
`Ctrl+Alt+0〜9`で10種類のシーンを保存、`Ctrl+0〜9`で呼び出しが可能です。


### キーボードショートカット

| キー | 動作 |
|------|------|
| `Space` | 選択トラックの REC トグル |
| `Z` / `Ctrl+Z` | 直前の録音を Undo |
| `N` | トラック追加 |
| `Enter` | Stop All / Start All |
| `1`〜`9` / `0` | トラック 1〜9 / 10 のミュート切替・再生トグル |
| `Ctrl+Alt+0〜9` | シーン保存 |
| `Ctrl+0〜9` | シーン呼び出し |
| `A S D F G H J K` | シンセ白鍵（C D E F G A B C） |
| `W E T Y U` | シンセ黒鍵（C# D# F# G# A#） |

## ファイル構成

```
js/
├── main.js        # 起動時処理
├── styles.js      # CSS
├── AudioEngine.js # 信号処理関係
├── Transport.js   # BPM クロック・スケジューラー
├── LoopTrack.js   # ループトラック・LoopScheduler・波形
├── Recorder.js    # 録音機能
├── Metronome.js   # メトロノーム
├── Synth.js       # 内蔵シンセサイザー
└── UI.js          # ユーザインタフェース
```

## ライセンス

MIT
