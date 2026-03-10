/* ══════════════════════════════════════════
   WEB AUDIO — FILE-BASED AUDIO SYSTEM
   Sources: OpenGameArt.org (CC0 / CC-BY)
══════════════════════════════════════════ */
let audioCtx = null;
let _analyser = null;
const audioBuffers = {};

const SFX_FILES = {
  club:            'assets/sfx/club.wav',
  rockThrower:     'assets/sfx/stone.wav',
  spear:           'assets/sfx/spear.wav',
  swordsman:       'assets/sfx/sword.wav',
  archer:          'assets/sfx/bow.wav',
  cavalry:         'assets/sfx/horse.wav',
  boar:            'assets/sfx/boar.ogg',
  saberToothTiger: 'assets/sfx/tiger.ogg',
  mammoth:         'assets/sfx/mammoth.ogg',
};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  _analyser = audioCtx.createAnalyser();
  _analyser.fftSize = 1024;
  _analyser.smoothingTimeConstant = 0.7;
  _analyser.connect(audioCtx.destination);
}

async function loadSound(key) {
  if (audioBuffers[key]) return audioBuffers[key];
  initAudio();
  try {
    const resp = await fetch(SFX_FILES[key]);
    const arrayBuf = await resp.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuf);
    audioBuffers[key] = decoded;
    return decoded;
  } catch (err) {
    console.warn('Could not load sound:', key, err);
    return null;
  }
}

function playBuffer(buffer) {
  const src  = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.85;
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(_analyser);
  src.start();
  return buffer.duration;
}
