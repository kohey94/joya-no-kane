// --- DOM要素の取得 ---
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const accTotal = document.getElementById('acc-total') as HTMLElement;
const rotG = document.getElementById('rot-g') as HTMLElement;
const statusDisplay = document.getElementById('status-display') as HTMLElement;
const body = document.body;

// --- 変数 ---
let audioCtx: AudioContext;
let bellBuffer: AudioBuffer | null = null;
let isTouching = false; // タッチ中フラグ

// --- iOS用型定義ハック ---
interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}
interface DeviceMotionEventiOS extends DeviceMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// --- 1. アプリ起動処理 ---
startBtn.addEventListener('click', async () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  audioCtx = new AudioContextClass();
  
  try {
    const response = await fetch('/bell.mp3');
    const arrayBuffer = await response.arrayBuffer();
    bellBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    console.log("🔔 音源ロード完了");
  } catch (e) {
    alert("音源エラー: " + e);
    return;
  }

  const DeviceMotion = window.DeviceMotionEvent as unknown as DeviceMotionEventiOS;
  if (typeof DeviceMotion.requestPermission === 'function') {
    try {
      const permission = await DeviceMotion.requestPermission();
      if (permission === 'granted') {
        startSensors();
      } else {
        alert('センサーの使用が拒否されました🥲');
      }
    } catch (e) {
      alert('権限リクエストエラー: ' + e);
    }
  } else {
    startSensors();
  }
});

// --- 2. センサー監視と判定ロジック ---
function startSensors() {
  startBtn.style.display = 'none';
  statusDisplay.innerText = "画面を親指で押し続けて！";

  // --- タッチイベント ---
  const onTouchStart = (e: Event) => {
    // e.preventDefault(); // 必要ならコメントアウト解除
    isTouching = true;
    body.style.backgroundColor = "#2d2d2d";
    statusDisplay.innerText = "🟢 構えOK！振れ！";
    statusDisplay.style.color = "#4f4";
  };

  const onTouchEnd = () => {
    isTouching = false;
    body.style.backgroundColor = "#1a1a1a";
    statusDisplay.innerText = "👆 画面を押さえてください";
    statusDisplay.style.color = "#ccc";
  };

  window.addEventListener('touchstart', onTouchStart);
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('mousedown', onTouchStart);
  window.addEventListener('mouseup', onTouchEnd);

  // --- センサー監視 ---
  let currentGamma = 0;
  let lastPlayTime = 0;

  // A. 傾き
  window.addEventListener('deviceorientation', (event) => {
    currentGamma = event.gamma || 0;
    rotG.innerText = currentGamma.toFixed(1);
  });

  // B. 加速度（振る動作）
  window.addEventListener('devicemotion', (event) => {
    const acc = event.acceleration; 
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    const totalSpeed = Math.sqrt(x*x + y*y + z*z);
    
    if (accTotal) accTotal.innerText = totalSpeed.toFixed(1);

    // --- 🔔 判定ロジック ---
    // 強弱計算は不要なので、閾値(20)を超えたら「鳴らす」だけ
    if (isTouching && totalSpeed > 20 && Math.abs(currentGamma) > 60) {
      const now = Date.now();
      if (now - lastPlayTime > 500) { // 連打防止間隔 (0.5秒)
        playConstantBell(); 
        lastPlayTime = now;
      }
    }
  });
}

// --- 3. 音と振動（常に一定） ---
function playConstantBell() {
  if (!bellBuffer) return;

  const source = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();

  source.buffer = bellBuffer;

  // 常に一定の音量（大きめ）
  gainNode.gain.value = 1.5; 

  // 常に一定の音程（原音）
  source.playbackRate.value = 1.0;

  // 接続（フィルターも削除してシンプルに）
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(0);

  // --- 振動（常に一定） ---
  if (navigator.vibrate) {
    // タッチ中なので長めの振動が通りやすい
    // 「ブゥゥーン」という重い振動
    navigator.vibrate(2000);
  }
}