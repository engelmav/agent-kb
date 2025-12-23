/**
 * Playwright Remote Control Server
 * 
 * A HTTP server that provides remote control capabilities for a Playwright-managed browser.
 * Allows external processes to control browser navigation, element interaction, and capture
 * screenshots via simple HTTP/curl commands.
 * 
 * Features:
 * - Browser navigation via POST /navigate
 * - Element clicking via POST /click (by selector or coordinates)
 * - Text input via POST /type
 * - Screenshot capture via GET /screenshot
 * 
 * Usage:
 *   node playwright_remote_control.js
 *   
 * Examples:
 *   curl -X POST http://localhost:3001/navigate -d '{"url":"https://google.com"}'
 *   curl -X POST http://localhost:3001/click -d '{"selector":"button"}'
 *   curl -X POST http://localhost:3001/type -d '{"text":"search query","selector":"input"}'
 *   curl http://localhost:3001/screenshot > screenshot.png
 */

const { chromium } = require('playwright');
const http = require('http');

let cdpClient = null;
let page = null;

// Start browser with CDP
(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  page = await context.newPage();
  cdpClient = await context.newCDPSession(page);
  await cdpClient.send('Page.enable');
  
  console.log('Playwright browser ready with CDP access');
})();

// HTTP server for navigation and screenshots
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/navigate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        await cdpClient.send('Page.navigate', { url });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, navigated_to: url }));
        console.log(`Navigated to: ${url}`);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/type') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text, selector } = JSON.parse(body);
        
        if (selector) {
          // Type in specific element
          await cdpClient.send('Runtime.evaluate', {
            expression: `document.querySelector('${selector}').focus()`
          });
        }
        
        // Type the text
        for (const char of text) {
          await cdpClient.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            text: char
          });
          await cdpClient.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            text: char
          });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, typed: text }));
        console.log(`Typed: ${text}`);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/click') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { x, y, selector } = JSON.parse(body);
        
        if (selector) {
          // Click by CSS selector
          const result = await cdpClient.send('Runtime.evaluate', {
            expression: `document.querySelector('${selector}').click()`
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, clicked: selector }));
          console.log(`Clicked element: ${selector}`);
        } else if (x && y) {
          // Click by coordinates
          await cdpClient.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: x,
            y: y,
            button: 'left',
            clickCount: 1
          });
          await cdpClient.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: x,
            y: y,
            button: 'left',
            clickCount: 1
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, clicked_at: { x, y } }));
          console.log(`Clicked at coordinates: ${x}, ${y}`);
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/screenshot') {
    try {
      const screenshot = await cdpClient.send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(screenshot.data, 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(buffer);
      console.log('Screenshot captured');
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3001, () => {
  console.log('Playwright navigation server running on http://localhost:3001');
  console.log('POST /navigate with {"url": "https://example.com"}');
  console.log('POST /type with {"text": "hello", "selector": "input"}');
  console.log('POST /click with {"selector": "button"} or {"x": 100, "y": 200}');
  console.log('GET /screenshot to capture current page');
});
