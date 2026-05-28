const out = document.getElementById('out');
const sceneIdEl = document.getElementById('sceneId');
const latEl = document.getElementById('lat');
const lngEl = document.getElementById('lng');
const radiusEl = document.getElementById('radius');
const buildBtn = document.getElementById('buildBtn');
const downloadBtn = document.getElementById('downloadBtn');

function log(value) {
  out.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function build() {
  const payload = {
    sceneId: sceneIdEl.value.trim(),
    lat: Number(latEl.value),
    lng: Number(lngEl.value),
    radius: Number(radiusEl.value),
  };

  log({ status: 'building', payload });

  const res = await fetch('/api/build', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  log({ http: res.status, ...json });
}

buildBtn.addEventListener('click', () => {
  void build();
});

downloadBtn.addEventListener('click', () => {
  window.location.href = '/api/build/download';
});
