// Runs only on the study timer page. Hands the saved totals to the page.
function push() {
  try {
    chrome.storage.local.get('days', ({ days }) => {
      if (days) window.postMessage({ source: 'padhlo-tracker', type: 'screentime', days }, '*');
    });
  } catch (e) { /* extension was reloaded; a page refresh fixes it */ }
}
push();
setInterval(push, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) push(); });
window.addEventListener('message', (e) => {
  if (e.source === window && e.data && e.data.source === 'padhlo-page' && e.data.type === 'request') push();
});
