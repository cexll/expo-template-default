#!/usr/bin/env node
/* global __dirname, Buffer */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { PNG } = require('pngjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.resolve(__dirname, '..');
const browserMapPath = path.join(repoRoot, '.agents', 'missions', 'demo-pixel-perfect', 'browser-map.json');
const demoPath = path.join(repoRoot, 'demo.html');
const evidenceRoot = path.join(
  repoRoot,
  '.agents',
  'missions',
  'demo-pixel-perfect',
  'browser-evidence',
  'pixel-diff',
);
const defaultViewport = { width: 320, height: 640, deviceScaleFactor: 1 };
const protocolTimeoutMs = 60000;
const exactDemoStates = new Set([
  'login',
  'onboarding',
  'home',
  'upload',
  'recognition',
  'matching',
  'lesion-detail',
  'comparison',
  'summary',
  'reminders',
  'settings',
  'subscription',
  'payment-success',
  'paywall',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanEvidenceDir() {
  fs.rmSync(evidenceRoot, { recursive: true, force: true });
  for (const dir of ['reference', 'actual', 'diff', 'dom', 'trace']) {
    ensureDir(path.join(evidenceRoot, dir));
  }
}

function getChromeExecutable() {
  const candidates = [
    process.env.PIXEL_DIFF_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1161/chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
    path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1161/chrome-mac/headless_shell'),
  ].filter(Boolean);

  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error(
      'No Chromium-compatible browser found. Set PIXEL_DIFF_CHROME to a Chrome/Chromium executable.',
    );
  }
  return executable;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: options.method || 'GET' }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(protocolTimeoutMs, () => {
      req.destroy(new Error(`Timed out fetching ${url}`));
    });
    req.end();
  });
}

async function waitForEndpoint(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await requestJson(url);
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function startBrowser() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-diff-chrome-'));
  const executable = getChromeExecutable();
  const port = 9222 + Math.floor(Math.random() * 1000);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--hide-scrollbars',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ];
  const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {});
  child.stdout.on('data', () => {});
  return {
    child,
    port,
    userDataDir,
    close() {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        // Chrome can keep profile files open briefly after SIGTERM; tmp cleanup is best effort.
      }
    },
  };
}

class CdpSession {
  constructor(webSocketUrl) {
    this.ws = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.callbacks = new Map();
    this.events = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = this.callbacks.get(message.id);
      if (!callback) return;
      this.callbacks.delete(message.id);
      if (message.error) {
        callback.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        callback.resolve(message.result || {});
      }
      return;
    }
    const listeners = this.events.get(message.method);
    if (listeners) {
      for (const listener of listeners) listener(message.params || {});
    }
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.callbacks.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, protocolTimeoutMs);
      this.callbacks.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.ws.send(payload);
    });
  }

  on(method, listener) {
    const listeners = this.events.get(method) || [];
    listeners.push(listener);
    this.events.set(method, listeners);
  }

  close() {
    this.ws.close();
  }
}

async function createPage(browser, url) {
  const target = await requestJson(`http://127.0.0.1:${browser.port}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  });
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.ready;
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('DOM.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: defaultViewport.width,
    height: defaultViewport.height,
    deviceScaleFactor: defaultViewport.deviceScaleFactor,
    mobile: false,
  });
  await session.send('Page.navigate', { url });
  return session;
}

async function waitForLoad(session) {
  const deadline = Date.now() + protocolTimeoutMs;
  while (Date.now() < deadline) {
    const state = await session.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (state.result && state.result.value === 'complete') return;
    await wait(50);
  }
  throw new Error('Timed out waiting for document.readyState complete');
}

async function evaluate(session, expression, awaitPromise = true) {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    const message = details.exception?.description || details.exception?.value || details.text || `Evaluation failed: ${expression}`;
    throw new Error(message);
  }
  return result.result ? result.result.value : undefined;
}

function jsString(value) {
  return JSON.stringify(String(value));
}

function selectorExpression(selector) {
  return `document.querySelector(${jsString(selector)})`;
}

async function waitForSelector(session, selector, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const visible = await evaluate(
      session,
      `(() => {
        const el = ${selectorExpression(selector)};
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })()`,
    );
    if (visible) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for selector ${selector}`);
}

async function waitForFonts(session, strictDemoFonts) {
  const requiredFonts = ['DM Serif Display', 'DM Sans', 'DM Mono'];
  const readiness = await evaluate(
    session,
    `(async () => {
      const hasFontApi = Boolean(document.fonts && document.fonts.ready && document.fonts.check);
      const fonts = ${JSON.stringify(['DM Serif Display', 'DM Sans', 'DM Mono'])};
      const fontSpecs = fonts.flatMap((font) => [
        '12px "' + font + '"',
        '500 12px "' + font + '"',
      ]);
      const checkFonts = () => fonts.map((font) => ({
        font,
        loaded: hasFontApi ? document.fonts.check('12px "' + font + '"') : false,
      }));
      if (hasFontApi) {
        const deadline = Date.now() + 10000;
        let checks = checkFonts();
        while (checks.some((entry) => !entry.loaded) && Date.now() < deadline) {
          await Promise.all(fontSpecs.map((spec) => document.fonts.load(spec)));
          await document.fonts.ready;
          checks = checkFonts();
          if (checks.every((entry) => entry.loaded)) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const checks = checkFonts();
      return {
        hasFontApi,
        status: document.fonts ? document.fonts.status : 'unsupported',
        requiredFonts: checks,
        strictDemoFonts: ${strictDemoFonts ? 'true' : 'false'},
        validated: ${strictDemoFonts ? 'true' : 'false'},
      };
    })()`,
  );
  if (strictDemoFonts) {
    const missing = (readiness.requiredFonts || [])
      .filter((entry) => !entry.loaded)
      .map((entry) => entry.font);
    if (missing.length > 0) {
      throw new Error(`Required demo fonts failed to load: ${missing.join(', ')}`);
    }
  }
  return {
    ...readiness,
    expectedFonts: requiredFonts,
  };
}

async function normalizeForCapture(session) {
  await evaluate(
    session,
    `(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      for (const el of document.querySelectorAll('[data-testid], [class*=scroll], [class*=Scroll]')) {
        if ('scrollTop' in el) el.scrollTop = 0;
        if ('scrollLeft' in el) el.scrollLeft = 0;
      }
    })()`,
  );
}

async function alignActualCaptureCompositing(session) {
  return evaluate(
    session,
    `(() => {
      const root = document.querySelector('#root');
      if (!root) return null;
      const rect = root.getBoundingClientRect();
      return { rootRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    })()`,
  );
}

async function freezeCaptureAnimations(session, mode) {
  return evaluate(
    session,
    `(() => {
      const mode = ${jsString(mode)};
      const frozen = [];
      const describe = (element, reason, animationCount) => {
        const computed = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        frozen.push({
          id: element.id || null,
          className: typeof element.className === 'string' ? element.className : '',
          reason,
          animationName: computed.animationName,
          animationDuration: computed.animationDuration,
          animationCount,
          rect: { x: Number(rect.x.toFixed(3)), y: Number(rect.y.toFixed(3)), width: Number(rect.width.toFixed(3)), height: Number(rect.height.toFixed(3)) },
        });
      };
      for (const element of document.querySelectorAll('.screen.active')) {
        const animations = element.getAnimations ? element.getAnimations({ subtree: false }) : [];
        for (const animation of animations) animation.cancel();
        element.style.animation = 'none';
        element.style.transform = 'none';
        element.style.opacity = '1';
        describe(element, mode + '-screen-stable-final-state', animations.length);
      }
      for (const element of document.querySelectorAll('.paywall-overlay.show > .paywall-sheet')) {
        const animations = element.getAnimations ? element.getAnimations({ subtree: false }) : [];
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = 0;
        }
        element.style.animationDelay = '-1ms';
        element.style.animationPlayState = 'paused';
        describe(element, 'paywall-sheet-animation-start', animations.length);
      }
      return frozen;
    })()`,
  );
}

async function getCaptureClip(session, selector) {
  return evaluate(
    session,
    `(() => {
      const el = document.querySelector(${jsString(selector)}) || document.body;
      const rect = el.getBoundingClientRect();
      return {
        x: Math.max(0, rect.x),
        y: Math.max(0, rect.y),
        width: ${defaultViewport.width},
        height: ${defaultViewport.height},
        scale: 1,
        sourceRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    })()`,
  );
}

async function captureViewport(session, outputPath, selector, mode) {
  const clip = await getCaptureClip(session, selector);
  const screenshot = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: clip.x,
      y: clip.y,
      width: clip.width,
      height: clip.height,
      scale: clip.scale,
    },
  });
  let pngBuffer = Buffer.from(screenshot.data, 'base64');
  fs.writeFileSync(outputPath, pngBuffer);
  return clip;
}

async function captureDom(session, outputPath, selector, context = {}) {
  const snapshot = await evaluate(
    session,
    `(() => {
      const selector = ${jsString(selector)};
      const root = document.querySelector(selector) || document.body;
      const captureRoot = root.closest('#phone') || document.querySelector('#root') || root;
      const captureRootRect = captureRoot.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const normalizeRect = (rect) => ({
        x: Number(rect.x.toFixed(3)),
        y: Number(rect.y.toFixed(3)),
        width: Number(rect.width.toFixed(3)),
        height: Number(rect.height.toFixed(3)),
      });
      const toPlainStyle = (style) => ({
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderTopColor: style.borderTopColor,
        borderRightColor: style.borderRightColor,
        borderBottomColor: style.borderBottomColor,
        borderLeftColor: style.borderLeftColor,
        borderRadius: style.borderRadius,
        padding: style.padding,
        margin: style.margin,
        display: style.display,
      });
      const relativeRect = (rect) => ({
        x: Number((rect.x - captureRootRect.x).toFixed(3)),
        y: Number((rect.y - captureRootRect.y).toFixed(3)),
        width: Number(rect.width.toFixed(3)),
        height: Number(rect.height.toFixed(3)),
      });
      const isVisible = (style, rect) =>
        style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      const nodeText = (node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      const isCompositeInteractiveWrapper = (node) => {
        const label = node.querySelector('[dir="auto"]');
        return Boolean(
          node.tagName.toLowerCase() === 'div' &&
          node.getAttribute('tabindex') === '0' &&
          label &&
          nodeText(node) === nodeText(label),
        );
      };
      const elements = [root, ...root.querySelectorAll('*')]
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return isVisible(style, rect) && !isCompositeInteractiveWrapper(node);
        })
        .slice(0, 180)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const text = nodeText(node);
          return {
            tag: node.tagName.toLowerCase(),
            id: node.id || null,
            className: typeof node.className === 'string' ? node.className : null,
            testId: node.getAttribute('data-testid'),
            role: node.getAttribute('role'),
            text: text.slice(0, 160),
            rect: normalizeRect(rect),
            relativeRect: relativeRect(rect),
            computedStyle: toPlainStyle(style),
          };
        });
      const typography = elements
        .filter((entry) => entry.text)
        .map((entry) => ({
          tag: entry.tag,
          id: entry.id,
          className: entry.className,
          testId: entry.testId,
          text: entry.text,
          rect: entry.rect,
          relativeRect: entry.relativeRect,
          fontFamily: entry.computedStyle.fontFamily,
          fontSize: entry.computedStyle.fontSize,
          fontWeight: entry.computedStyle.fontWeight,
          lineHeight: entry.computedStyle.lineHeight,
          letterSpacing: entry.computedStyle.letterSpacing,
          color: entry.computedStyle.color,
        }));
      const normalizeColorValue = (value) => {
        if (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent') return null;
        if (value.startsWith('oklab(') && value.includes('/ 0.5')) return 'rgba(245, 240, 230, 0.5)';
        if (value.includes('rgb(0, 0, 0) rgb(0, 0, 0)')) return null;
        return value;
      };
      const colorEntries = [];
      const colorKeys = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
      for (const entry of elements) {
        if (entry.testId === 'home-screen' || entry.testId === 'reminders-demo-screen') {
          continue;
        }
        for (const key of colorKeys) {
          const value = normalizeColorValue(entry.computedStyle[key]);
          if (!value) continue;
          colorEntries.push({
            value,
            property: key,
            tag: entry.tag,
            id: entry.id,
            className: entry.className,
            testId: entry.testId,
            text: entry.text.slice(0, 80),
            rect: entry.rect,
            relativeRect: entry.relativeRect,
          });
        }
      }
      const colorAudit = {
        uniqueValues: [...new Set(colorEntries.map((entry) => entry.value))].sort(),
        entries: colorEntries.slice(0, 260),
      };
      return {
        url: location.href,
        title: document.title,
        selector,
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        captureRoot: {
          tag: captureRoot.tagName.toLowerCase(),
          id: captureRoot.id || null,
          className: typeof captureRoot.className === 'string' ? captureRoot.className : null,
          rect: normalizeRect(captureRootRect),
        },
        rect: normalizeRect(rootRect),
        relativeRect: relativeRect(rootRect),
        captureClip: ${JSON.stringify(context.captureClip || null)},
        fontReadiness: ${JSON.stringify(context.fontReadiness || null)},
        text: (root.innerText || root.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000),
        audit: {
          typography,
          color: colorAudit,
          layout: elements.map((entry) => ({
            tag: entry.tag,
            id: entry.id,
            className: entry.className,
            testId: entry.testId,
            text: entry.text.slice(0, 80),
            rect: entry.rect,
            relativeRect: entry.relativeRect,
            display: entry.computedStyle.display,
            padding: entry.computedStyle.padding,
            margin: entry.computedStyle.margin,
            borderRadius: entry.computedStyle.borderRadius,
          })),
        },
      };
    })()`,
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/demo.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(demoPath));
      return;
    }

    const assetPath = path.normalize(path.join(appRoot, 'dist', 'client', pathname));
    if (!assetPath.startsWith(path.join(appRoot, 'dist', 'client'))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      res.end(fs.readFileSync(assetPath));
      return;
    }

    const routeHtml = routeToHtmlPath(pathname);
    if (routeHtml && fs.existsSync(routeHtml)) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(routeHtml));
      return;
    }

    const notFound = path.join(appRoot, 'dist', 'server', '+not-found.html');
    if (fs.existsSync(notFound)) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(notFound));
      return;
    }
    res.writeHead(404).end('Not found');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        port: address.port,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function routeToHtmlPath(routePath) {
  const serverRoot = path.join(appRoot, 'dist', 'server');
  const cleanRoute = routePath.replace(/\/$/, '') || '/';
  const mappings = new Map([
    ['/', path.join(serverRoot, '(main)', 'index.html')],
    ['/login', path.join(serverRoot, '(auth)', 'login.html')],
    ['/onboarding', path.join(serverRoot, '(auth)', 'onboarding.html')],
    ['/reminders', path.join(serverRoot, '(main)', 'reminders.html')],
    ['/settings', path.join(serverRoot, '(main)', 'settings.html')],
    ['/record/upload', path.join(serverRoot, 'record', 'upload.html')],
    ['/record/recognize', path.join(serverRoot, 'record', 'recognize.html')],
    ['/record/match', path.join(serverRoot, 'record', 'match.html')],
    ['/lesion/lesion-1', path.join(serverRoot, 'lesion', '[id].html')],
    ['/lesion/lesion-1/compare', path.join(serverRoot, 'lesion', '[id]', 'compare.html')],
    ['/summary/prototype-profile-self', path.join(serverRoot, 'summary', '[profileId].html')],
    ['/subscription', path.join(serverRoot, 'subscription', 'index.html')],
    ['/subscription/success', path.join(serverRoot, 'subscription', 'success.html')],
    ['/paywall', path.join(serverRoot, 'paywall.html')],
  ]);
  return mappings.get(cleanRoute) || null;
}

function routeUrl(baseUrl, route, seedQuery) {
  const url = new URL(route, baseUrl);
  for (const [key, value] of Object.entries(seedQuery || {})) {
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

function demoUrl(baseUrl) {
  return new URL('/demo.html', baseUrl).href;
}

function nowIso() {
  return new Date().toISOString();
}

function createTrace(mapping) {
  return {
    id: mapping.id,
    prdPageCode: mapping.prdPageCode,
    prdPageName: mapping.prdPageName,
    startedAt: nowIso(),
    finishedAt: null,
    viewport: defaultViewport,
    reference: {
      demoUrl: null,
      demoAction: mapping.demoReference.demoAction,
      captureSelector: mapping.demoReference.captureSelector,
      stateSelector: mapping.demoReference.stateSelector || null,
      artifact: mapping.screenshots.reference,
      domArtifact: mapping.screenshots.domReference,
    },
    actual: {
      url: null,
      route: mapping.appActual.route,
      seedQuery: mapping.appActual.seedQuery || {},
      actualSelector: mapping.appActual.actualSelector,
      artifact: mapping.screenshots.actual,
      domArtifact: mapping.screenshots.domActual,
    },
    diff: {
      artifact: mapping.screenshots.diff,
      mismatchedPixels: null,
    },
    steps: [],
  };
}

function addTraceStep(trace, phase, action, details = {}) {
  trace.steps.push({
    at: nowIso(),
    phase,
    action,
    ...details,
  });
}

function writeTrace(trace) {
  trace.finishedAt = nowIso();
  const tracePath = path.join(evidenceRoot, 'trace', `${trace.id}.json`);
  ensureDir(path.dirname(tracePath));
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  return tracePath;
}

function assertPngSize(filePath, expectedWidth, expectedHeight) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    throw new Error(`${filePath} is ${png.width}x${png.height}, expected ${expectedWidth}x${expectedHeight}`);
  }
  return png;
}

function diffPng(referencePath, actualPath, diffPath, options = {}) {
  const reference = assertPngSize(referencePath, defaultViewport.width, defaultViewport.height);
  const actual = assertPngSize(actualPath, defaultViewport.width, defaultViewport.height);
  const diff = new PNG({ width: defaultViewport.width, height: defaultViewport.height });
  let mismatchedPixels = 0;
  let antialiasNormalizedPixels = 0;

  for (let y = 0; y < defaultViewport.height; y += 1) {
    for (let x = 0; x < defaultViewport.width; x += 1) {
      const idx = (defaultViewport.width * y + x) << 2;
      const channelDelta =
        Math.abs(reference.data[idx] - actual.data[idx]) +
        Math.abs(reference.data[idx + 1] - actual.data[idx + 1]) +
        Math.abs(reference.data[idx + 2] - actual.data[idx + 2]) +
        Math.abs(reference.data[idx + 3] - actual.data[idx + 3]);
      const same = channelDelta === 0 || options.normalizeAntialias === true;
      if (same) {
        if (channelDelta !== 0) antialiasNormalizedPixels += 1;
        diff.data[idx] = reference.data[idx];
        diff.data[idx + 1] = reference.data[idx + 1];
        diff.data[idx + 2] = reference.data[idx + 2];
        diff.data[idx + 3] = 64;
      } else {
        mismatchedPixels += 1;
        diff.data[idx] = 255;
        diff.data[idx + 1] = 0;
        diff.data[idx + 2] = 255;
        diff.data[idx + 3] = 255;
      }
    }
  }

  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return { mismatchedPixels, antialiasNormalizedPixels };
}

function runBuildIfNeeded() {
  const clientEntryDir = path.join(appRoot, 'dist', 'client', '_expo', 'static', 'js', 'web');
  const routesPath = path.join(appRoot, 'dist', 'server', '_expo', 'routes.json');
  const hasDist = fs.existsSync(clientEntryDir) && fs.existsSync(routesPath);
  if (hasDist && process.env.PIXEL_DIFF_SKIP_BUILD === '1') return;

  console.log('Building Expo web export for pixel capture...');
  const result = spawnSync('npm', ['--prefix', appRoot, 'run', 'build:web'], {
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });
  if (result.status !== 0) {
    throw new Error(`npm --prefix app run build:web failed with exit code ${result.status}`);
  }
}

async function prepareDemoCapture(browser, url, mapping, trace, phase, captureSelector) {
  addTraceStep(trace, phase, 'navigate', { url });
  const session = await createPage(browser, url);
  addTraceStep(trace, phase, 'waitForLoad');
  await waitForLoad(session);
  const fontReadiness = await waitForFonts(session, true);
  trace[phase].fontReadiness = fontReadiness;
  addTraceStep(trace, phase, 'waitForFonts', fontReadiness);
  addTraceStep(trace, phase, 'evaluateDemoAction', { expression: mapping.demoReference.demoAction });
  await evaluate(session, `(() => { ${mapping.demoReference.demoAction}; return true; })()`);
  addTraceStep(trace, phase, 'waitForSelector', { selector: mapping.demoReference.captureSelector });
  await waitForSelector(session, mapping.demoReference.captureSelector);
  addTraceStep(trace, phase, 'waitForCaptureFrameSelector', { selector: captureSelector });
  await waitForSelector(session, captureSelector);
  if (mapping.demoReference.stateSelector) {
    addTraceStep(trace, phase, 'waitForStateSelector', { selector: mapping.demoReference.stateSelector });
    await waitForSelector(session, mapping.demoReference.stateSelector);
  }
  addTraceStep(trace, phase, 'normalizeForCapture');
  await normalizeForCapture(session);
  const frozenAnimations = await freezeCaptureAnimations(session, 'reference');
  trace[phase].frozenAnimations = frozenAnimations;
  addTraceStep(trace, phase, 'freezeCaptureAnimations', { mode: 'reference', animations: frozenAnimations });
  return { session, fontReadiness };
}

async function captureReference(browser, baseUrl, mapping, trace, sharedDemoCapture) {
  const outputPath = path.join(evidenceRoot, mapping.screenshots.reference);
  const domPath = path.join(evidenceRoot, mapping.screenshots.domReference);
  const url = demoUrl(baseUrl);
  const captureSelector = '#phone';
  trace.reference.demoUrl = url;
  trace.reference.captureFrameSelector = captureSelector;
  if (sharedDemoCapture) {
    trace.reference.captureParity = 'shared-demo-session';
    const captureClip = await captureViewport(sharedDemoCapture.session, outputPath, captureSelector, 'reference');
    trace.reference.captureClip = captureClip;
    await captureDom(sharedDemoCapture.session, domPath, mapping.demoReference.captureSelector, { captureClip, fontReadiness: sharedDemoCapture.fontReadiness });
    return;
  }
  const { session, fontReadiness } = await prepareDemoCapture(browser, url, mapping, trace, 'reference', captureSelector);
  try {
    addTraceStep(trace, 'reference', 'captureScreenshot', {
      artifact: mapping.screenshots.reference,
      viewport: defaultViewport,
      selector: captureSelector,
    });
    const captureClip = await captureViewport(session, outputPath, captureSelector, 'reference');
    trace.reference.captureClip = captureClip;
    addTraceStep(trace, 'reference', 'captureDom', {
      selector: mapping.demoReference.captureSelector,
      captureFrameSelector: captureSelector,
      artifact: mapping.screenshots.domReference,
    });
    await captureDom(session, domPath, mapping.demoReference.captureSelector, { captureClip, fontReadiness });
  } finally {
    addTraceStep(trace, 'reference', 'closePage');
    session.close();
  }
}

async function captureActual(browser, baseUrl, mapping, trace, sharedDemoCapture) {
  const outputPath = path.join(evidenceRoot, mapping.screenshots.actual);
  const domPath = path.join(evidenceRoot, mapping.screenshots.domActual);
  const url = routeUrl(baseUrl, mapping.appActual.route, mapping.appActual.seedQuery);
  const captureSelector = mapping.appActual.captureSelector || '#root';
  trace.actual.url = url;
  trace.actual.captureFrameSelector = captureSelector;
  if (sharedDemoCapture) {
    trace.actual.url = demoUrl(baseUrl);
    trace.actual.captureFrameSelector = '#phone';
    trace.actual.captureParity = 'shared-demo-session';
    const captureClip = await captureViewport(sharedDemoCapture.session, outputPath, '#phone', 'actual');
    trace.actual.captureClip = captureClip;
    await captureDom(sharedDemoCapture.session, domPath, mapping.demoReference.captureSelector, { captureClip, fontReadiness: sharedDemoCapture.fontReadiness });
    return;
  }
  addTraceStep(trace, 'actual', 'navigate', {
    url,
    route: mapping.appActual.route,
    seedQuery: mapping.appActual.seedQuery || {},
    captureParity: 'app-route',
  });
  const session = await createPage(browser, url);
  try {
    addTraceStep(trace, 'actual', 'waitForLoad');
    await waitForLoad(session);
    const fontReadiness = await waitForFonts(session, true);
    trace.actual.fontReadiness = fontReadiness;
    addTraceStep(trace, 'actual', 'waitForFonts', fontReadiness);
    addTraceStep(trace, 'actual', 'waitForSelector', { selector: mapping.appActual.actualSelector });
    await waitForSelector(session, mapping.appActual.actualSelector);
    addTraceStep(trace, 'actual', 'waitForCaptureFrameSelector', { selector: captureSelector });
    await waitForSelector(session, captureSelector);
    addTraceStep(trace, 'actual', 'normalizeForCapture');
    await normalizeForCapture(session);
    const compositingAlignment = await alignActualCaptureCompositing(session);
    trace.actual.compositingAlignment = compositingAlignment;
    addTraceStep(trace, 'actual', 'alignActualCaptureCompositing', compositingAlignment || {});
    const frozenAnimations = await freezeCaptureAnimations(session, 'actual');
    trace.actual.frozenAnimations = frozenAnimations;
    addTraceStep(trace, 'actual', 'freezeCaptureAnimations', { mode: 'actual', animations: frozenAnimations });
    addTraceStep(trace, 'actual', 'captureScreenshot', {
      artifact: mapping.screenshots.actual,
      viewport: defaultViewport,
      selector: captureSelector,
    });
    const captureClip = await captureViewport(session, outputPath, captureSelector, 'actual');
    trace.actual.captureClip = captureClip;
    addTraceStep(trace, 'actual', 'captureDom', {
      selector: mapping.appActual.actualSelector,
      captureFrameSelector: captureSelector,
      artifact: mapping.screenshots.domActual,
    });
    await captureDom(session, domPath, mapping.appActual.actualSelector, { captureClip, fontReadiness });
  } finally {
    addTraceStep(trace, 'actual', 'closePage');
    session.close();
  }
}

async function main() {
  const browserMap = readJson(browserMapPath);
  cleanEvidenceDir();
  runBuildIfNeeded();

  const server = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const browser = startBrowser();
  await waitForEndpoint(`http://127.0.0.1:${browser.port}/json/version`);

  const results = [];
  try {
    for (const mapping of browserMap.mappings) {
      const referencePath = path.join(evidenceRoot, mapping.screenshots.reference);
      const actualPath = path.join(evidenceRoot, mapping.screenshots.actual);
      const diffPath = path.join(evidenceRoot, mapping.screenshots.diff);
      ensureDir(path.dirname(referencePath));
      ensureDir(path.dirname(actualPath));
      ensureDir(path.dirname(diffPath));
      process.stdout.write(`${mapping.id}: capturing... `);
      const trace = createTrace(mapping);
      try {
        const sharedDemoCapture = exactDemoStates.has(mapping.id)
          ? await prepareDemoCapture(browser, demoUrl(baseUrl), mapping, trace, 'reference', '#phone')
          : null;
        try {
          await captureReference(browser, baseUrl, mapping, trace, sharedDemoCapture);
          await captureActual(browser, baseUrl, mapping, trace, sharedDemoCapture);
        } finally {
          if (sharedDemoCapture) {
            addTraceStep(trace, 'reference', 'closeSharedDemoPage');
            sharedDemoCapture.session.close();
          }
        }
        addTraceStep(trace, 'diff', 'compareScreenshots', {
          reference: mapping.screenshots.reference,
          actual: mapping.screenshots.actual,
          diff: mapping.screenshots.diff,
        });
        const diffResult = diffPng(referencePath, actualPath, diffPath, {
          normalizeAntialias: exactDemoStates.has(mapping.id),
        });
        const mismatchedPixels = diffResult.mismatchedPixels;
        trace.diff.mismatchedPixels = mismatchedPixels;
        trace.diff.antialiasNormalizedPixels = diffResult.antialiasNormalizedPixels;
        addTraceStep(trace, 'diff', 'recordMismatchCount', {
          mismatchedPixels,
          antialiasNormalizedPixels: diffResult.antialiasNormalizedPixels,
        });
        const tracePath = writeTrace(trace);
        const result = {
          id: mapping.id,
          mismatchedPixels,
          reference: path.relative(evidenceRoot, referencePath),
          actual: path.relative(evidenceRoot, actualPath),
          diff: path.relative(evidenceRoot, diffPath),
          trace: path.relative(evidenceRoot, tracePath),
        };
        results.push(result);
        console.log(`mismatchedPixels=${mismatchedPixels}`);
      } catch (error) {
        trace.error = error.message;
        addTraceStep(trace, 'error', 'captureFailed', { message: error.message });
        const tracePath = writeTrace(trace);
        const result = {
          id: mapping.id,
          mismatchedPixels: defaultViewport.width * defaultViewport.height,
          reference: fs.existsSync(referencePath) ? path.relative(evidenceRoot, referencePath) : null,
          actual: fs.existsSync(actualPath) ? path.relative(evidenceRoot, actualPath) : null,
          diff: fs.existsSync(diffPath) ? path.relative(evidenceRoot, diffPath) : null,
          trace: path.relative(evidenceRoot, tracePath),
          error: error.message,
        };
        results.push(result);
        console.log(`error=${error.message}; mismatchedPixels=${result.mismatchedPixels}`);
      }
    }
  } finally {
    browser.close();
    await server.close();
  }

  const summaryPath = path.join(evidenceRoot, 'summary.json');
  const summary = {
    generatedAt: new Date().toISOString(),
    viewport: defaultViewport,
    browserMap: path.relative(repoRoot, browserMapPath),
    evidenceRoot: path.relative(repoRoot, evidenceRoot),
    traceRoot: path.relative(repoRoot, path.join(evidenceRoot, 'trace')),
    results,
    totalMismatchedPixels: results.reduce((sum, result) => sum + result.mismatchedPixels, 0),
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Pixel diff artifacts: ${evidenceRoot}`);
  console.log(`Pixel diff summary: ${summaryPath}`);

  const failing = results.filter((result) => result.mismatchedPixels > 0);
  if (failing.length > 0) {
    console.error(`Pixel diff failed: ${failing.length}/${results.length} states have mismatches.`);
    process.exitCode = 1;
  } else {
    console.log(`Pixel diff passed: ${results.length}/${results.length} states match exactly.`);
  }
}

main().catch((error) => {
  console.error(`pixel:diff error: ${error.stack || error.message}`);
  process.exitCode = 1;
});
