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
      // 変数を検出
      const variables = detectVariables(selectedText);
      
      // 方程式かどうかを確認（=を含むか）
      const isEquation = selectedText.includes('=');
      
      if (variables.length > 0 && !isEquation) {
        // 変数を含む式の場合はインタラクティブなポップアップを表示
        handleVariableExpression(tab, selectedText, variables);
      } else if (isEquation && variables.length > 0) {
        // 方程式の場合は解を求める
        handleEquation(tab, selectedText, variables);
      } else {
        // 通常の数式の場合は従来通り計算
        const result = math.evaluate(selectedText);
        handleRegularExpression(tab, selectedText, result);
      }
    } catch (error) {
      showError(tab, error.message);
    }
  }
});

// 変数を含む式を処理する関数
function handleVariableExpression(tab, expression, variables) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (text, vars) => {
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
      
      // 変数入力フィールドのスタイル
      const inputStyle = `
        padding: 4px 8px;
        border-radius: 3px;
        border: 1px solid ${brightness > 128 ? '#555' : '#ccc'};
        background: ${brightness > 128 ? '#444' : '#f8f8f8'};
        color: ${brightness > 128 ? '#fff' : '#333'};
        width: 80px;
        margin-left: 5px;
      `;
      
      // 変数入力フィールドを生成
      let variableInputs = '';
      vars.forEach(variable => {
        variableInputs += `
          <div style="margin-top: 8px; display: flex; align-items: center;">
            <label for="var-${variable}">${variable} = </label>
            <input type="number" id="var-${variable}" style="${inputStyle}" step="any">
          </div>
        `;
      });
      
      popup.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <strong>計算結果:</strong>
          <span style="cursor: pointer; color: ${brightness > 128 ? '#AAA' : '#999'};" id="closePopup">✕</span>
        </div>
        <div style="margin: 10px 0;">
          <div>${text} = <span id="result">□</span></div>
          ${variableInputs}
        </div>
      `;
      
      document.body.appendChild(popup);
      
      // 変数の値が変更されたときに結果を更新する関数（メッセージパッシングを使用）
      const updateResult = () => {
        const scope = {};
        let allFilled = true;
        
        // 各変数の値を取得
        vars.forEach(variable => {
          const input = document.getElementById(`var-${variable}`);
          const value = parseFloat(input.value);
          
          if (!isNaN(value)) {
            scope[variable] = value;
          } else {
            allFilled = false;
          }
        });
        
        // すべての変数に値が入力されている場合は結果を計算
        if (allFilled) {
          // バックグラウンドスクリプトにメッセージを送信して計算
          chrome.runtime.sendMessage({
            type: 'evaluate-with-variables',
            expression: text,
            variables: scope
          }, response => {
            if (response.success) {
              document.getElementById('result').textContent = response.result;
            } else {
              document.getElementById('result').textContent = 'エラー';
              console.error('計算エラー:', response.error);
            }
          });
        }
      };
      
      // 各変数の入力フィールドにイベントリスナーを追加
      vars.forEach(variable => {
        const input = document.getElementById(`var-${variable}`);
        input.addEventListener('input', updateResult);
      });
      
      // ✕ボタンでポップアップを閉じる
      document.getElementById('closePopup').addEventListener('click', () => {
        if (document.body.contains(popup)) {
          document.body.removeChild(popup);
        }
      });
    },
    args: [expression, variables]
  });
}

// 方程式を処理する関数
function handleEquation(tab, equation, variables) {
  try {
    // 方程式を左辺と右辺に分割
    const [leftSide, rightSide] = equation.split('=').map(side => side.trim());
    
    // 変数を検出
    const variable = variables[0]; // 最初の変数を使用
    
    // 方程式を解く
    const solutions = solveEquation(leftSide, rightSide, variable);
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text, variable, sols) => {
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
        
        // 解の表示を生成
        let solutionsHTML = '';
        if (Array.isArray(sols)) {
          if (sols.length === 0) {
            solutionsHTML = '解なし';
          } else {
            sols.forEach((sol, index) => {
              solutionsHTML += `<div>${variable} = ${sol}</div>`;
            });
          }
        } else {
          solutionsHTML = `<div>${variable} = ${sols}</div>`;
        }
        
        popup.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <strong>計算結果:</strong>
            <span style="cursor: pointer; color: ${brightness > 128 ? '#AAA' : '#999'};" id="closePopup">✕</span>
          </div>
          <div style="margin-bottom: 5px;">${text}</div>
          <div>${solutionsHTML}</div>
        `;
        
        document.body.appendChild(popup);
        
        // ✕ボタンでポップアップを閉じる
        document.getElementById('closePopup').addEventListener('click', () => {
          if (document.body.contains(popup)) {
            document.body.removeChild(popup);
          }
        });
      },
      args: [equation, variable, solutions]
    });
  } catch (error) {
    showError(tab, `方程式を解くエラー: ${error.message}`);
  }
}

// 通常の数式を処理する関数
function handleRegularExpression(tab, expression, result) {
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
    args: [expression, result]
  });
}

// エラーを表示する関数
function showError(tab, errorMessage) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (errorMsg) => {
      alert("計算エラー: " + errorMsg);
    },
    args: [errorMessage]
  });
}

// 選択されたテキストから変数を検出する関数
function detectVariables(expression) {
  // 数字、演算子、括弧、空白以外の文字を変数として検出
  const variables = new Set();
  
  // 方程式の場合は = を除去して処理
  const cleanExpression = expression.replace(/=/g, ' ');
  
  // 変数として有効な文字（アルファベット）を抽出
  const matches = cleanExpression.match(/[a-zA-Z]+/g);
  
  if (matches) {
    matches.forEach(match => {
      // 数学関数名（sin, cos, tan, log など）を除外
      const mathFunctions = ['sin', 'cos', 'tan', 'log', 'exp', 'sqrt', 'abs', 'min', 'max'];
      if (!mathFunctions.includes(match.toLowerCase())) {
        // 各文字を変数として追加
        for (const char of match) {
          variables.add(char);
        }
      }
    });
  }
  
  return Array.from(variables);
}

// 方程式を解く関数
function solveEquation(leftSide, rightSide, variable) {
  // 方程式を標準形に変形: 左辺 - 右辺 = 0
  const equation = `(${leftSide})-(${rightSide})`;
  
  try {
    // 式を評価して係数を取得
    // 線形方程式 (ax + b = 0) の場合
    
    // x = 0 のときの値（定数項）
    const b = math.evaluate(equation, { [variable]: 0 });
    
    // x = 1 のときの値から係数を計算
    const a_plus_b = math.evaluate(equation, { [variable]: 1 });
    const a = a_plus_b - b;
    
    // 線形方程式の場合 (ax + b = 0)
    if (Math.abs(a) > 1e-10) { // 0でない場合
      return -b / a;
    }
    
    // 二次方程式の場合を試す (ax² + bx + c = 0)
    // x = 2 のときの値から二次の係数を推定
    const a_times_4_plus_b_times_2_plus_c = math.evaluate(equation, { [variable]: 2 });
    
    // 連立方程式を解いて係数を求める
    // f(0) = c
    // f(1) = a + b + c
    // f(2) = 4a + 2b + c
    const c = b; // f(0) = c
    const a_plus_b_plus_c = a_plus_b; // f(1) = a + b + c
    
    // a + b = a_plus_b_plus_c - c
    const a_plus_b_calculated = a_plus_b_plus_c - c;
    
    // 4a + 2b + c = a_times_4_plus_b_times_2_plus_c
    // 4a + 2b = a_times_4_plus_b_times_2_plus_c - c
    const four_a_plus_two_b = a_times_4_plus_b_times_2_plus_c - c;
    
    // 2(a + b) = 2a + 2b
    const two_a_plus_two_b = 2 * a_plus_b_calculated;
    
    // 4a + 2b - 2a - 2b = 2a
    const two_a = four_a_plus_two_b - two_a_plus_two_b;
    const a_quadratic = two_a / 2;
    
    // a + b = a_plus_b_calculated
    // b = a_plus_b_calculated - a
    const b_quadratic = a_plus_b_calculated - a_quadratic;
    
    // 二次方程式の判別式
    const discriminant = b_quadratic * b_quadratic - 4 * a_quadratic * c;
    
    if (Math.abs(a_quadratic) > 1e-10 && discriminant >= 0) {
      // 二次方程式の解
      if (discriminant === 0) {
        // 重解
        return -b_quadratic / (2 * a_quadratic);
      } else {
        // 異なる2つの解
        const x1 = (-b_quadratic + Math.sqrt(discriminant)) / (2 * a_quadratic);
        const x2 = (-b_quadratic - Math.sqrt(discriminant)) / (2 * a_quadratic);
        return [x1, x2];
      }
    }
    
    // 解なし、または特殊なケース
    return "解を求められません";
  } catch (error) {
    console.error("方程式を解く際にエラーが発生しました:", error);
    return "解を求められません";
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "test-calculate") {
    try {
      const result = math.evaluate(message.expression);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  } else if (message.type === "evaluate-with-variables") {
    try {
      // 変数を含む式を評価
      const result = math.evaluate(message.expression, message.variables);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});
