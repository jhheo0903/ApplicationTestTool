// background.js
// 사이드 패널이 모든 탭에서 동작하도록 설정
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 아이콘 클릭 시 → 탭 ID 저장 + 사이드 패널 열기
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.session.set({ activeTabId: tab.id, activeWindowId: tab.windowId });
  chrome.sidePanel.open({ tabId: tab.id });
});

// 탭 전환 시 activeTabId 업데이트
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  chrome.storage.session.set({ activeTabId: tabId, activeWindowId: windowId });
});

// 탭 URL 변경 시에도 업데이트
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    chrome.storage.session.set({ activeTabId: tabId, activeWindowId: tab.windowId });
  }
});
