importScripts('lib/math.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "calculateExpression",
    title: "数式を計算する",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "calculateExpression") {
      const selectedText = info.selectionText;
      
      try {
        const result = math.evaluate(selectedText);
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text, res) => {
            // 結果を表示するための小さなポップアップを作成
            const popup = document.createElement('div');
            popup.style.position = 'fixed';
            popup.style.top = '20px';
            popup.style.right = '20px';
            popup.style.zIndex = '10000';
            popup.style.padding = '10px';
            popup.style.background = '#f0f0f0';
            popup.style.border = '1px solid #ccc';
            popup.style.borderRadius = '5px';
            popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            popup.style.fontFamily = 'sans-serif';
            popup.style.fontSize = '14px';
            
            popup.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <strong>計算結果:</strong>
                <span style="cursor: pointer; color: #999;" id="closePopup">✕</span>
                </div>
                <div>${text} = <strong>${res}</strong></div>
            `;
            
            document.body.appendChild(popup);
            // ✕ボタンでポップアップを閉じる
            document.getElementById('closePopup').addEventListener('click', () => {
                if (document.body.contains(popup)) {
                document.body.removeChild(popup);
                }
            });
            },
            args: [selectedText, result]
        });
      } catch (error) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (errorMsg) => {
            alert("計算エラー: " + errorMsg);
          },
          args: [error.message]
        });
      }
    }
  });
