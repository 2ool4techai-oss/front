// Forward messages from content script to devtools panel
chrome.runtime.onMessage.addListener((message, sender) => {
  // In a real extension we'd use chrome.runtime.connect for panel
  // For MVP: store in chrome.storage.session
  void sender;
  try {
    chrome.storage.session.set({ lastSignalUpdate: message });
  } catch { /* ignore */ }
});
