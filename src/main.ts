// --- DOM要素の取得 ---
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const accTotal = document.getElementById('acc-total') as HTMLElement;
const rotG = document.getElementById('rot-g') as HTMLElement;
const statusDisplay = document.getElementById('status-display') as HTMLElement;
const body = document.body;

// --- 変数 ---
let audioCtx: AudioContext;
let bellBuffer: AudioBuffer | null = null;
let isTouching = false;

// --- 1. アプリ起動処理 ---
startBtn.addEventListener('click', async () => {
  
  // iOS向けにセンサー許可を最初にリクエストする
  const DeviceMotion = window.DeviceMotionEvent as any;
  const DeviceOrientation = window.DeviceOrientationEvent as any;

  if (typeof DeviceMotion.requestPermission === 'function') {
    try {
      // 加速度センサーの許可
      const motionState = await DeviceMotion.requestPermission();
      if (motionState !== 'granted') {
        alert('加速度センサーが許可されませんでした');
        return;
      }

      // ジャイロセンサーの許可
      // iOSのバージョンによっては片方で両方OKになるが、念のため両方書く
      if (typeof DeviceOrientation.requestPermission === 'function') {
        const orientationState = await DeviceOrientation.requestPermission();
        if (orientationState !== 'granted') {
          alert('ジャイロセンサーが許可されませんでした');
          return;
        }
      }

    } catch (e) {
      console.error(e);
      alert('権限リクエストエラー: ' + e);
      return;
    }
  }

  // 音源関連
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  audioCtx = new AudioContextClass();
  
  loadSound();
  startSensors();
});


// 音源ロード関数
async function loadSound() {
  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const response = await fetch('/bell.mp3');
    const arrayBuffer = await response.arrayBuffer();
    bellBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    console.log("音源ロード完了");
  } catch (e) {
    console.error("音源エラー", e);
  }
}

// --- センサー監視と判定ロジック ---
function startSensors() {
  startBtn.style.display = 'none';
  statusDisplay.innerText = "画面を親指で押し続けて！";

  // --- タッチイベント ---
  const onTouchStart = () => {
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

  window.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('mousedown', onTouchStart);
  window.addEventListener('mouseup', onTouchEnd);

  // --- センサー監視 ---
  let currentGamma = 0;
  let lastPlayTime = 0;

  // 傾き (DeviceOrientation)
  window.addEventListener('deviceorientation', (event) => {
    currentGamma = event.gamma || 0;
    rotG.innerText = currentGamma.toFixed(1);
  });

  // 加速度 (DeviceMotion)
  window.addEventListener('devicemotion', (event) => {
    const acc = event.acceleration; 
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    const totalSpeed = Math.sqrt(x*x + y*y + z*z);
    
    if (accTotal) accTotal.innerText = totalSpeed.toFixed(1);

    // --- 判定ロジック ---
    if (isTouching && totalSpeed > 20 && Math.abs(currentGamma) > 60) {
      const now = Date.now();
      if (now - lastPlayTime > 500) { 
        playConstantBell(); 
        lastPlayTime = now;
      }
    }
  });
}

// --- 3. 音と振動（常に一定） ---
function playConstantBell() {
  if (!bellBuffer) return;

  // iOS対応: 再生直前にも念のため resume
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const source = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();

  source.buffer = bellBuffer;
  gainNode.gain.value = 1.5; 
  source.playbackRate.value = 1.0;

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(0);

  if (navigator.vibrate) {
    navigator.vibrate(2000);
  }
}