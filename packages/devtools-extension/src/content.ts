// Relay messages from page to devtools panel via chrome.runtime
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'drishti-devtools') return;
  try {
    (chrome as unknown as { runtime: { sendMessage: (msg: unknown) => void } })
      .runtime.sendMessage(event.data);
  } catch { /* extension context may be invalidated */ }
});
