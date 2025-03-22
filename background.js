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
            
            // ウェブサイトの背景色を検出して適応するカラースキームを決定
            const getBackgroundColor = () => {
              // body要素の背景色を取得
              const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
              
              // 背景色が透明または未設定の場合はhtml要素をチェック
              if (bodyBgColor === 'rgba(0, 0, 0, 0)' || bodyBgColor === 'transparent') {
                return window.getComputedStyle(document.documentElement).backgroundColor;
              }
              
              return bodyBgColor;
            };
            
            // 背景色の明るさを判定（RGBから輝度を計算）
            const getBrightness = (color) => {
              // RGB形式から数値を抽出
              const rgb = color.match(/\d+/g);
              if (!rgb || rgb.length < 3) return 128; // デフォルト値
              
              // 輝度計算（人間の目は緑に最も敏感で、青に最も鈍感）
              return (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114);
            };
            
            const bgColor = getBackgroundColor();
            const brightness = getBrightness(bgColor);
            
            // 明るさに基づいてポップアップの色を設定
            if (brightness > 128) {
              // 暗い背景用のスタイル
              popup.style.background = '#333333';
              popup.style.color = '#FFFFFF';
              popup.style.border = '1px solid #555555';
            } else {
              // 明るい背景用のスタイル
              popup.style.background = '#FFFFFF';
              popup.style.color = '#333333';
              popup.style.border = '1px solid #CCCCCC';
            }
            
            // 共通のスタイル（視認性を高めるための追加スタイル）
            popup.style.borderRadius = '5px';
            popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.2) inset';
            popup.style.fontFamily = 'sans-serif';
            popup.style.fontSize = '14px';
            
            popup.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <strong>計算結果:</strong>
                <span style="cursor: pointer; color: ${brightness > 128 ? '#AAA' : '#999'};" id="closePopup">✕</span>
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "test-calculate") {
    try {
      const result = math.evaluate(message.expression);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});
