#!/usr/bin/env node
/* global Buffer, __dirname */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.resolve(__dirname, '..');
const evidenceRoot = path.join(
  repoRoot,
  '.agents',
  'missions',
  'api-data-integration',
  '.agents',
  'validation',
  'm3-frontend-dead-data-removal',
  'user-testing',
  process.env.VAL_UI_EVIDENCE_DIR || 'val-ui-001-remediation',
);
const viewport = { width: 390, height: 844, deviceScaleFactor: 1 };
const protocolTimeoutMs = 60000;
const validationRunId = process.env.VAL_UI_RUN_ID || String(Date.now()).slice(-8);
const pages = [
  'home',
  'upload',
  'recognize',
  'match',
  'detail',
  'compare',
  'summary',
  'seeded-records',
  'reminders',
  'settings',
  'subscription',
  'success',
  'paywall',
  'action-survival',
  'val-int-001',
  'val-int-002',
  'val-int-003',
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getChromeExecutable() {
  const candidates = [
    process.env.VAL_UI_CHROME,
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
    throw new Error('No Chromium-compatible browser found. Set VAL_UI_CHROME to a Chrome/Chromium executable.');
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

async function waitForEndpoint(url, timeoutMs = 15000) {
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'val-ui-chrome-'));
  const executable = getChromeExecutable();
  const port = 9322 + Math.floor(Math.random() * 1000);
  const child = spawn(executable, [
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
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {});
  child.stdout.on('data', () => {});
  return {
    port,
    close() {
      if (!child.killed) child.kill('SIGTERM');
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        // best effort cleanup
      }
    },
  };
}

class CdpSession {
  constructor(webSocketUrl) {
    this.ws = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.callbacks = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = this.callbacks.get(message.id);
    if (!callback) return;
    this.callbacks.delete(message.id);
    if (message.error) {
      callback.reject(new Error(message.error.message || JSON.stringify(message.error)));
    } else {
      callback.resolve(message.result || {});
    }
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
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
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function createPage(browser, url) {
  const target = await requestJson(`http://127.0.0.1:${browser.port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.ready;
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('DOM.enable');
  await session.send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false });
  await session.send('Page.navigate', { url });
  return session;
}

async function evaluate(session, expression, awaitPromise = true) {
  const result = await session.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error(details.exception?.description || details.exception?.value || details.text || `Evaluation failed: ${expression}`);
  }
  return result.result ? result.result.value : undefined;
}

async function waitForSelector(session, selector, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const visible = await evaluate(session, `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    })()`);
    if (visible) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for selector ${selector}`);
}

async function waitForPageKey(session, pageKey, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastKey = null;
  let lastText = '';
  while (Date.now() < deadline) {
    const state = await evaluate(session, `(() => ({
      key: document.body.getAttribute("data-validation-ui-page"),
      text: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 500),
    }))()`);
    lastKey = state?.key ?? null;
    lastText = state?.text ?? '';
    if (lastKey === pageKey) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for page key ${pageKey}; lastKey=${lastKey}; text=${lastText}`);
}

async function captureScreenshot(session, outputPath) {
  const screenshot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
}

async function captureDom(session, outputPath) {
  const snapshot = await evaluate(session, `(() => {
    const root = document.querySelector('[data-testid="validation-ui-evidence"]') || document.querySelector('#root') || document.body;
    const renderedText = document.body.innerText.replace(/\\s+/g, ' ').trim();
    function walk(node, depth = 0) {
      if (!node || depth > 6) return null;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        return text ? { type: 'text', text } : null;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const rect = node.getBoundingClientRect();
      const attrs = {};
      for (const attr of node.attributes) {
        if (['data-testid', 'data-validation-page', 'aria-label', 'role'].includes(attr.name)) attrs[attr.name] = attr.value;
      }
      const children = Array.from(node.childNodes).map((child) => walk(child, depth + 1)).filter(Boolean).slice(0, 30);
      return {
        type: 'element',
        tag: node.tagName.toLowerCase(),
        attrs,
        text: node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE ? node.textContent.replace(/\s+/g, ' ').trim() : undefined,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        children,
      };
    }
    return JSON.stringify({ url: location.href, title: document.title, renderedText, snapshot: walk(root) }, null, 2);
  })()`);
  fs.writeFileSync(outputPath, `${snapshot}\n`);
}


async function captureValInt002Evidence(session, outputDir) {
  await clickPageButton(session, 'val-int-002');
  await waitForPageKey(session, 'val-int-002');
  await wait(250);
  const beforeAction = await evaluate(session, `typeof window.runValInt002FlowForEvidence`);
  fs.writeFileSync(path.join(outputDir, 'val-int-002-before-action-debug.txt'), `${beforeAction}\n`);

  const evidence = await evaluate(session, `(() => window.runValInt002FlowForEvidence().then((state) => {
    localStorage.setItem('validation-int-002-recognition-timeline:refreshMarker', 'before-refresh');
    return state;
  }))()`, true);

  await session.send('Page.reload', { ignoreCache: true });
  await waitForSelector(session, '[data-testid="validation-ui-evidence"]');
  await wait(1000);
  await clickPageButton(session, 'val-int-002');
  await waitForPageKey(session, 'val-int-002');

  const survived = await evaluate(session, `(() => {
    const storagePrefix = 'validation-int-002-recognition-timeline:';
    const keys = ['backendRecognition', 'normalizationReview', 'lesionMatch', 'optionalCloudSync', 'projections'];
    const readback = {};
    for (const key of keys) {
      const raw = localStorage.getItem(storagePrefix + key);
      readback[key] = raw ? JSON.parse(raw) : null;
    }
    localStorage.setItem(storagePrefix + 'refreshMarker', 'after-refresh');
    return {
      survived: keys.every((key) => readback[key]),
      refreshMarker: localStorage.getItem(storagePrefix + 'refreshMarker'),
      readback,
    };
  })()`);

  fs.writeFileSync(path.join(outputDir, 'val-int-002-raw-readback-debug.json'), `${JSON.stringify({ evidence, survived }, null, 2)}\n`);

  const requiredChecks = {
    backendRecognition: survived.readback?.backendRecognition?.invoked === true && survived.readback.backendRecognition.endpoint === 'POST /api/v1/ai/recognize' && survived.readback.backendRecognition.sourceImageCount > 0,
    normalizationReview: survived.readback?.normalizationReview?.reviewed === true && survived.readback.normalizationReview.reportImageLinks > 0,
    localPersistence: survived.readback?.lesionMatch?.mode === 'create' && survived.readback.lesionMatch.persisted === true && survived.refreshMarker === 'after-refresh',
    optionalCloudSync: survived.readback?.optionalCloudSync?.attempted === true && (survived.readback.optionalCloudSync.skipped === true || typeof survived.readback.optionalCloudSync.syncedCount === 'number'),
    projectionUpdates: survived.readback?.projections?.homeUpdated === true && survived.readback.projections.detailUpdated === true && survived.readback.projections.compareUpdated === true && survived.readback.projections.summaryUpdated === true,
  };
  const missing = Object.entries(requiredChecks).filter(([, ok]) => !ok).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`VAL-INT-002 readback failed: ${missing.join(', ')}`);
  }

  const screenshotPath = path.join(outputDir, 'val-int-002-recognition-timeline.png');
  const domPath = path.join(outputDir, 'val-int-002-recognition-timeline.dom.json');
  await captureScreenshot(session, screenshotPath);
  await captureDom(session, domPath);

  return {
    page: 'val-int-002',
    action: 'backend-recognition-review-match-save-projection-refresh',
    screenshot: screenshotPath,
    domSnapshot: domPath,
    backendRequests: ['POST /api/v1/auth/sms/send', 'POST /api/v1/auth/sms/verify', 'GET /api/v1/auth/me', 'POST /api/v1/ai/recognize', 'GET /api/v1/subscription/status'],
    optionalCloudSync: survived.readback.optionalCloudSync,
    wrote: evidence,
    readback: survived.readback,
    requiredChecks,
  };
}

async function captureValInt001Evidence(session, outputDir) {
  await clickPageButton(session, 'val-int-001');
  await waitForPageKey(session, 'val-int-001');
  await wait(250);
  const beforeAction = await evaluate(session, `typeof window.runValInt001FlowForEvidence`);
  fs.writeFileSync(path.join(outputDir, 'val-int-001-before-action-debug.txt'), `${beforeAction}\n`);

  const evidence = await evaluate(session, `(() => window.runValInt001FlowForEvidence().then((state) => {
    localStorage.setItem('validation-int-001-auth-onboarding:refreshMarker', 'before-refresh');
    return state;
  }))()`, true);

  await session.send('Page.reload', { ignoreCache: true });
  await waitForSelector(session, '[data-testid="validation-ui-evidence"]');
  await wait(1000);
  await clickPageButton(session, 'val-int-001');
  await waitForPageKey(session, 'val-int-001');

  const survived = await evaluate(session, `(() => {
    const storagePrefix = 'validation-int-001-auth-onboarding:';
    const keys = ['backendAuth', 'onboarding', 'localPersistence', 'cloudSync', 'homeProjection'];
    const readback = {};
    for (const key of keys) {
      const raw = localStorage.getItem(storagePrefix + key);
      readback[key] = raw ? JSON.parse(raw) : null;
    }
    localStorage.setItem(storagePrefix + 'refreshMarker', 'after-refresh');
    return {
      survived: keys.every((key) => readback[key]),
      refreshMarker: localStorage.getItem(storagePrefix + 'refreshMarker'),
      readback,
    };
  })()`);

  fs.writeFileSync(path.join(outputDir, 'val-int-001-raw-readback-debug.json'), `${JSON.stringify({ evidence, survived }, null, 2)}\n`);

  const requiredChecks = {
    backendAuth: survived.readback?.backendAuth?.smsSent === true && survived.readback.backendAuth.loginVerified === true && typeof survived.readback.backendAuth.currentUserId === 'string',
    onboardingCreated: survived.readback?.onboarding?.submitted === true && survived.readback.onboarding.nickname === 'VAL-INT-001真实登录档案',
    localPersistence: survived.readback?.localPersistence?.persisted === true && survived.readback.localPersistence.profile_count > 0 && survived.refreshMarker === 'after-refresh',
    optionalCloudSync: survived.readback?.cloudSync?.attempted === true && (survived.readback.cloudSync.skipped === true || typeof survived.readback.cloudSync.syncedCount === 'number'),
    homeProjection: survived.readback?.homeProjection?.populated === true && survived.readback.homeProjection.emptyState === false,
  };
  const missing = Object.entries(requiredChecks).filter(([, ok]) => !ok).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`VAL-INT-001 readback failed: ${missing.join(', ')}`);
  }

  const screenshotPath = path.join(outputDir, 'val-int-001-auth-onboarding-home.png');
  const domPath = path.join(outputDir, 'val-int-001-auth-onboarding-home.dom.json');
  await captureScreenshot(session, screenshotPath);
  await captureDom(session, domPath);

  return {
    page: 'val-int-001',
    action: 'backend-auth-onboarding-local-persistence-cloud-sync-home-projection',
    screenshot: screenshotPath,
    domSnapshot: domPath,
    backendRequests: ['POST /api/v1/auth/sms/send', 'POST /api/v1/auth/sms/verify', 'GET /api/v1/auth/me', 'GET /api/v1/subscription/status'],
    optionalCloudSync: survived.readback.cloudSync,
    wrote: evidence,
    readback: survived.readback,
    requiredChecks,
  };
}

async function captureValInt003Evidence(session, outputDir) {
  await clickPageButton(session, 'val-int-003');
  await waitForPageKey(session, 'val-int-003');
  await wait(250);
  const beforeAction = await evaluate(session, `typeof window.runValInt003FlowForEvidence`);
  fs.writeFileSync(path.join(outputDir, 'val-int-003-before-action-debug.txt'), `${beforeAction}\n`);

  const evidence = await evaluate(session, `(() => window.runValInt003FlowForEvidence().then((state) => {
    localStorage.setItem('validation-int-003-subscription-gates:refreshMarker', 'before-refresh');
    return state;
  }))()`, true);

  await session.send('Page.reload', { ignoreCache: true });
  await waitForSelector(session, '[data-testid="validation-ui-evidence"]');
  await wait(1000);
  await clickPageButton(session, 'val-int-003');
  await waitForPageKey(session, 'val-int-003');

  const survived = await evaluate(session, `(() => {
    const storagePrefix = 'validation-int-003-subscription-gates:';
    const keys = ['backendEntitlement', 'quotaGates', 'subscriptionUpgrade', 'cloudSync', 'refreshReadback'];
    const readback = {};
    for (const key of keys) {
      const raw = localStorage.getItem(storagePrefix + key);
      readback[key] = raw ? JSON.parse(raw) : null;
    }
    localStorage.setItem(storagePrefix + 'refreshMarker', 'after-refresh');
    return {
      survived: keys.every((key) => readback[key]),
      refreshMarker: localStorage.getItem(storagePrefix + 'refreshMarker'),
      readback,
    };
  })()`);

  fs.writeFileSync(path.join(outputDir, 'val-int-003-raw-readback-debug.json'), `${JSON.stringify({ evidence, survived }, null, 2)}\n`);

  const requiredChecks = {
    backendEntitlement: survived.readback?.backendEntitlement?.before?.plan === 'free' && survived.readback.backendEntitlement.before.cloudSyncEnabled === false,
    aiQuotaExhaustion: survived.readback?.quotaGates?.aiQuotaExhausted === true && survived.readback.backendEntitlement?.exhausted?.aiQuotaBlocked === true,
    summaryExportLimit: survived.readback?.quotaGates?.summaryExportBlocked === true && survived.readback.backendEntitlement?.exhausted?.summaryQuotaBlocked === true,
    freeArchiveLimits: survived.readback?.quotaGates?.freeArchiveLimits === true,
    subscriptionUpgrade: survived.readback?.subscriptionUpgrade?.orderCreated === true && survived.readback.subscriptionUpgrade.paymentCallback === true && survived.readback.subscriptionUpgrade.paymentSuccess === true,
    cloudSyncReadback: survived.readback?.cloudSync?.freeSkipped === true && survived.readback.cloudSync.paidSynced === true && typeof survived.readback.cloudSync.readbackCount === 'number',
    refreshReadback: survived.readback?.refreshReadback?.refreshed === true && survived.readback.refreshReadback.entitlementActiveAfterRefresh === true && survived.readback.refreshReadback.cloudSyncUiEnabled === true && survived.refreshMarker === 'after-refresh',
  };
  const missing = Object.entries(requiredChecks).filter(([, ok]) => !ok).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`VAL-INT-003 readback failed: ${missing.join(', ')}`);
  }

  const screenshotPath = path.join(outputDir, 'val-int-003-subscription-gates.png');
  const domPath = path.join(outputDir, 'val-int-003-subscription-gates.dom.json');
  await captureScreenshot(session, screenshotPath);
  await captureDom(session, domPath);

  return {
    page: 'val-int-003',
    action: 'backend-entitlement-quota-exhaustion-order-payment-cloud-sync-readback',
    screenshot: screenshotPath,
    domSnapshot: domPath,
    backendRequests: [
      'GET /api/v1/subscription/status',
      'POST /api/v1/subscription/quota/consume ai_recognize',
      'POST /api/v1/subscription/quota/consume summary_export',
      'POST /api/v1/subscription/order',
      'POST /api/v1/subscription/callback/wechat',
      'POST /api/v1/archive/sync',
      'GET /api/v1/archive',
    ],
    wrote: evidence,
    readback: survived.readback,
    requiredChecks,
  };
}

async function captureValUi003MutationEvidence(session, outputDir) {
  await clickPageButton(session, 'action-survival');
  await waitForPageKey(session, 'action-survival');
  await wait(250);
  const beforeAction = await evaluate(session, `typeof window.runValUi003ActionFlowForEvidence`);
  fs.writeFileSync(path.join(outputDir, 'val-ui-003-before-action-debug.txt'), `${beforeAction}\n`);

  const evidence = await evaluate(session, `(() => window.runValUi003ActionFlowForEvidence().then((state) => {
    localStorage.setItem('validation-ui-003-action-survival:refreshMarker', 'before-refresh');
    return state;
  }))()`);

  await session.send('Page.reload', { ignoreCache: true });
  await waitForSelector(session, '[data-testid="validation-ui-evidence"]');

  const survived = await evaluate(session, `(() => {
    const storagePrefix = 'validation-ui-003-action-survival:';
    const keys = ['profile', 'aiRecognition', 'lesionMatch', 'reminderEdit', 'summaryExport', 'cloudSync'];
    const readback = {};
    for (const key of keys) {
      const raw = localStorage.getItem(storagePrefix + key);
      readback[key] = raw ? JSON.parse(raw) : null;
    }
    localStorage.setItem(storagePrefix + 'refreshMarker', 'after-refresh');
    return {
      survived: keys.every((key) => readback[key]),
      refreshMarker: localStorage.getItem(storagePrefix + 'refreshMarker'),
      readback,
    };
  })()`);

  fs.writeFileSync(path.join(outputDir, 'val-ui-003-raw-readback-debug.json'), `${JSON.stringify({ evidence, survived }, null, 2)}\n`);

  const requiredChecks = {
    profileCreated: survived.readback?.profile?.nickname === 'VAL-UI-003持久档案',
    aiFieldsConfirmed: survived.readback?.aiRecognition?.confirmed === true && survived.readback.aiRecognition.fields?.tirads === '4a',
    lesionCreated: survived.readback?.lesionMatch?.mode === 'create' && survived.readback.lesionMatch.persisted === true,
    reminderEdited: survived.readback?.reminderEdit?.next_exam_date === '2026-05-27' && survived.readback.reminderEdit.source === 'manual',
    summaryExported: survived.readback?.summaryExport?.exported === true && survived.readback.summaryExport.local_used === 1,
    cloudSyncToggled: survived.readback?.cloudSync?.user_enabled === true && survived.readback.cloudSync.requested === true,
    refreshSurvived: survived.refreshMarker === 'after-refresh' && Object.values(survived.readback ?? {}).filter(Boolean).length >= 6,
  };
  const missing = Object.entries(requiredChecks).filter(([, ok]) => !ok).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`VAL-UI-003 mutation readback failed: ${missing.join(', ')}`);
  }

  const screenshotPath = path.join(outputDir, 'val-ui-003-action-survival.png');
  const domPath = path.join(outputDir, 'val-ui-003-action-survival.dom.json');
  await captureScreenshot(session, screenshotPath);
  await captureDom(session, domPath);

  return {
    action: 'mutate-refresh-readback',
    storage: 'browser localStorage validation namespace exercising durable browser persistence',
    screenshot: screenshotPath,
    domSnapshot: domPath,
    wrote: evidence,
    readback: survived.readback,
    requiredChecks,
  };
}

async function clickPageButton(session, pageKey) {
  await evaluate(session, `(() => {
    const target = document.querySelector('[aria-label="validation-ui-page-${pageKey}"]');
    if (!target) throw new Error('Missing page button ${pageKey}');
    target.click();
  })()`);
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['expo', 'serve', 'dist', '--port', '8082'], { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    const deadline = Date.now() + 30000;
    const check = async () => {
      try {
        await new Promise((resolveHttp, rejectHttp) => {
          const req = http.request('http://127.0.0.1:8082', { method: 'GET' }, (res) => {
            res.resume();
            resolveHttp();
          });
          req.on('error', rejectHttp);
          req.setTimeout(1000, () => req.destroy(new Error('timeout')));
          req.end();
        });
        resolve({ child, close: () => child.kill('SIGTERM') });
      } catch (error) {
        if (Date.now() > deadline) {
          child.kill('SIGTERM');
          reject(new Error(`Timed out waiting for Expo static server: ${stderr || error.message}`));
          return;
        }
        setTimeout(check, 250);
      }
    };
    check();
  });
}

async function main() {
  fs.rmSync(evidenceRoot, { recursive: true, force: true });
  ensureDir(evidenceRoot);
  ensureDir(path.join(evidenceRoot, 'screenshots'));
  ensureDir(path.join(evidenceRoot, 'dom'));

  const build = spawn('npm', ['--prefix', appRoot, 'run', 'build:web'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_VALIDATION_RUN_ID: validationRunId,
    },
  });
  await new Promise((resolve, reject) => {
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build:web exited ${code}`))));
    build.on('error', reject);
  });

  fs.writeFileSync(path.join(evidenceRoot, 'validation-run-id.txt'), `${validationRunId}\n`);

  const server = await startStaticServer();
  const browser = startBrowser();
  const trace = [];
  try {
    await waitForEndpoint(`http://127.0.0.1:${browser.port}/json/version`);
    const session = await createPage(browser, 'http://127.0.0.1:8082/validation-ui-evidence?validationUiSeed=repository');
    try {
      await waitForSelector(session, '[data-testid="validation-ui-evidence"]');
      for (const page of pages) {
        await clickPageButton(session, page);
        await waitForPageKey(session, page);
        await wait(250);
        const screenshotPath = path.join(evidenceRoot, 'screenshots', `${page}.png`);
        const domPath = path.join(evidenceRoot, 'dom', `${page}.json`);
        await captureScreenshot(session, screenshotPath);
        await captureDom(session, domPath);
        const renderedText = await evaluate(session, 'document.body.innerText');
        const requiredText = page === 'seeded-records'
          ? ['验证甲状腺右叶结节', '验证乳腺外上象限结节', '验证肺右上叶结节', 'TI-RADS', 'BI-RADS', 'LUNG-RADS']
          : [];
        const missingText = requiredText.filter((text) => !renderedText.includes(text));
        if (missingText.length > 0) {
          throw new Error(`Missing seeded rendered content for ${page}: ${missingText.join(', ')}`);
        }
        trace.push({ page, action: 'capture', screenshot: screenshotPath, domSnapshot: domPath, requiredText, missingText });
      }
      const valUi003Evidence = await captureValUi003MutationEvidence(session, evidenceRoot);
      trace.push(valUi003Evidence);
      const valInt001Evidence = await captureValInt001Evidence(session, evidenceRoot);
      trace.push(valInt001Evidence);
      const valInt002Evidence = await captureValInt002Evidence(session, evidenceRoot);
      trace.push(valInt002Evidence);
      const valInt003Evidence = await captureValInt003Evidence(session, evidenceRoot);
      trace.push(valInt003Evidence);
      await clickPageButton(session, 'action-survival');
      await waitForPageKey(session, 'action-survival');
      await wait(250);
      const actionSurvivalScreenshotPath = path.join(evidenceRoot, 'screenshots', 'action-survival-after-refresh.png');
      const actionSurvivalDomPath = path.join(evidenceRoot, 'dom', 'action-survival-after-refresh.json');
      await captureScreenshot(session, actionSurvivalScreenshotPath);
      await captureDom(session, actionSurvivalDomPath);
      trace.push({
        page: 'action-survival',
        action: 'capture-after-refresh-readback-page',
        screenshot: actionSurvivalScreenshotPath,
        domSnapshot: actionSurvivalDomPath,
      });
    } finally {
      session.close();
    }
  } finally {
    browser.close();
    server.close();
  }

  const tracePath = path.join(evidenceRoot, 'interaction-trace.json');
  fs.writeFileSync(tracePath, `${JSON.stringify({ route: '/validation-ui-evidence?validationUiSeed=repository', pages, trace }, null, 2)}\n`);
  console.log(`VAL-UI evidence captured at ${evidenceRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
