const pendingTabs = new Set();

chrome.action.onClicked.addListener(async (sourceTab) => {
  if (!sourceTab.url || !/^https?:/i.test(sourceTab.url)) {
    await chrome.action.setBadgeText({ tabId: sourceTab.id, text: "!" });
    setTimeout(() => chrome.action.setBadgeText({ tabId: sourceTab.id, text: "" }), 1800);
    return;
  }

  const copy = await chrome.tabs.create({ url: sourceTab.url, active: true });
  pendingTabs.add(copy.id);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!pendingTabs.has(tabId) || changeInfo.status !== "complete") return;
  pendingTabs.delete(tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["editor.js"] });
  } catch (error) {
    console.warn("Could not start Page Markup Copy:", error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => pendingTabs.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "download-markup" || !sender.tab?.windowId) return;

  (async () => {
    try {
      const screenshot = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      let url = screenshot;
      let filename = `page-markup-${stamp}.png`;

      if (message.format === "jpeg") {
        const response = await fetch(screenshot);
        const bitmap = await createImageBitmap(await response.blob());
        const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = surface.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, surface.width, surface.height);
        context.drawImage(bitmap, 0, 0);
        url = await surface.convertToBlob({ type: "image/jpeg", quality: 0.92 })
          .then(blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); }));
        filename = `page-markup-${stamp}.jpg`;
      }

      if (message.format === "word") {
        const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><img src="${screenshot}" style="max-width:100%;height:auto" alt="Annotated page"></body></html>`;
        url = `data:application/msword;charset=utf-8,${encodeURIComponent(html)}`;
        filename = `page-markup-${stamp}.doc`;
      }

      await chrome.downloads.download({ url, filename, saveAs: true });
      sendResponse({ ok: true });
    } catch (error) {
      console.error("Could not export markup:", error);
      sendResponse({ ok: false, error: error.message });
    }
  })();
  return true;
});
