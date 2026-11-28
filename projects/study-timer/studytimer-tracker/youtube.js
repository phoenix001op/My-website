// Runs on YouTube only. Answers "which channel is this tab showing?" when the tracker asks.
// Nothing is polled or stored here, so it adds no load to YouTube.
function channelName() {
  const p = location.pathname;
  if (p.startsWith('/shorts')) return 'Shorts';
  if (p.startsWith('/watch')) {
    const a = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, ytd-video-owner-renderer ytd-channel-name a');
    const t = a && a.textContent.trim();
    if (t) return t;
    const meta = document.querySelector('[itemprop="author"] [itemprop="name"]');
    return meta ? (meta.getAttribute('content') || meta.textContent || '').trim() || null : null;
  }
  const h = p.match(/^\/(@[^/]+)/);
  if (h) {
    const t = document.querySelector('ytd-channel-name #text, #channel-name #text');
    return (t && t.textContent.trim()) || decodeURIComponent(h[1]);
  }
  return null; // home, search, playlists: counted as plain youtube.com
}
try {
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg && msg.type === 'padhlo-channel') reply({ channel: channelName() });
  });
} catch (e) { /* extension was reloaded */ }
