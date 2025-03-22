// Puppeteer を使って背景ハンドラーの動作を検証するテストスクリプトです。
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const extensionPath = path.resolve(__dirname, '..'); // 拡張のルートディレクトリを仮定します

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ]
  });

  const page = await browser.newPage();
  await page.goto(`file://${path.join(__dirname, 'test_page.html')}`);
  
  // 背景コンテキスト（サービスワーカー）を取得
  console.log('拡張機能のターゲットを検索中...');
  const targets = await browser.targets();
  
  // すべてのターゲットとその情報を表示（デバッグ用）
  targets.forEach(target => {
    console.log(`Target: ${target.url()}, Type: ${target.type()}`);
  });
  
  // 拡張機能のサービスワーカーを検索
  const extensionPrefix = 'chrome-extension://';
  const backgroundTarget = targets.find(target => 
    (target.type() === 'service_worker' || target.type() === 'background_page') && 
    target.url().startsWith(extensionPrefix)
  );
  
  if (!backgroundTarget) {
    console.error('拡張機能の背景コンテキストが見つかりませんでした。');
    await browser.close();
    process.exit(1);
  }
  
  console.log(`背景コンテキストを検出: ${backgroundTarget.url()}, Type: ${backgroundTarget.type()}`);
  
  // サービスワーカーかページかに応じて適切なコンテキストを取得
  let backgroundContext;
  if (backgroundTarget.type() === 'service_worker') {
    backgroundContext = await backgroundTarget.worker();
  } else {
    backgroundContext = await backgroundTarget.page();
  }
  
  if (!backgroundContext) {
    console.error('背景コンテキストを取得できませんでした。');
    await browser.close();
    process.exit(1);
  }

  // ヘルパー関数: 背景のテストハンドラーを呼び出します
  async function testCalculate(expression) {
    return await backgroundContext.evaluate((expr) => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'test-calculate', expression: expr }, resolve);
      });
    }, expression);
  }

  // 正しい数式のテスト ("2+2")
  let resp = await testCalculate("2+2");
  if (resp.success !== true || resp.result !== 4) {
    throw new Error(`正しい数式 "2+2" のテストに失敗しました: ${JSON.stringify(resp)}`);
  } else {
    console.log('"2+2" のテスト成功:', resp);
  }

  // 誤った数式のテスト ("2++2")
  resp = await testCalculate("2++2");
  if (resp.success !== false || !resp.error) {
    throw new Error(`誤った数式 "2++2" のテストに失敗しました: ${JSON.stringify(resp)}`);
  } else {
    console.log('"2++2" のテスト成功:', resp);
  }

  console.log("すべてのテストが成功しました。");
  await browser.close();
})();
