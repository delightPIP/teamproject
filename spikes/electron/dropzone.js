const zone = document.getElementById('zone');
const logEl = document.getElementById('log');
const log = (m) => { logEl.textContent = `${new Date().toLocaleTimeString()} ${m}\n` + logEl.textContent; };
window.collector.onLog(log);

// 창 전체에서 기본 동작(파일 열기로 이동)을 막는다
for (const t of ['dragover', 'drop']) window.addEventListener(t, (e) => e.preventDefault());

zone.addEventListener('dragenter', () => zone.classList.add('over'));
zone.addEventListener('dragleave', () => zone.classList.remove('over'));
zone.addEventListener('drop', async (e) => {
  zone.classList.remove('over');
  const dt = e.dataTransfer;
  const t0 = performance.now();
  log(`drop types=[${[...dt.types].join(', ')}] files=${dt.files.length}`);
  try {
    let result;
    if (dt.files.length > 0) {
      result = await window.collector.dropFiles([...dt.files]);
    } else {
      const uriList = dt.getData('text/uri-list');
      const text = dt.getData('text/plain');
      result = await window.collector.dropText({ uriList, text });
    }
    log(`저장 완료 ${(performance.now() - t0).toFixed(0)}ms → ${JSON.stringify(result)}`);
  } catch (err) {
    log(`실패: ${err.message}`);
  }
});
