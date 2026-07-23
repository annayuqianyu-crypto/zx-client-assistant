(function () {
  'use strict';

  // 每个登录用户一套独立的本地档案：库名与存储键都带上用户标识。
  // 未登录（本地开发、无登录闸门）时沿用原名，保证既有数据不受影响。
  const DB_BASE_NAME = 'chaoxi_client_assistant_demo_v1';
  const ACTIVE_SESSION_BASE_KEY = 'chaoxi_active_session_v1';
  let DB_NAME = DB_BASE_NAME;
  let ACTIVE_SESSION_KEY = ACTIVE_SESSION_BASE_KEY;
  let currentUserEmail = null;

  function applyUserScope(email) {
    currentUserEmail = email || null;
    const slug = window.ZXAuth?.currentSlug?.();
    if (!slug) return;
    DB_NAME = `${DB_BASE_NAME}__${slug}`;
    ACTIVE_SESSION_KEY = `${ACTIVE_SESSION_BASE_KEY}__${slug}`;
  }

  const DB_VERSION = 1;
  const PAIN_FILE = 'pain_point_export_1783906924986.xlsx';
  const SKU_FILE = '全量SKU知识卡片-BU确认版本-20260629.xlsx';
  const SKU_WIDE_QUESTIONS_FILE = 'sku_wide_questions_15.json';
  const SKU_LANDING_SOP_FILE = 'sku_landing_sop_15.json';
  const SKU_LANDING_SUPPLIER_FILE = 'sku_landing_supplier_15.json';
  const SKU_SUPPLIER_SUMMARY_FILE = 'sku_supplier_summary_15.json';
  const SKU_PPT_CONTENT_FILE = 'sku_ppt_content_15.json';
  const SKU_LONG_IMAGE_MANIFEST = 'sku_long_images/manifest.json';
  const CLIENT_IMAGE_WIDTH = 1080;
  const CLIENT_IMAGE_MAX_HEIGHT = 6500;
  const SHOW_SKU_QUESTION_IDS = true;
  const CHAT_ORCHESTRATOR_TIMEOUT_MS = 25000;
  const PROFILE_KEYS = ['subject', 'industry', 'assets', 'events', 'constraints'];
  const PROFILE_LABELS = {
    subject: '主体',
    industry: '行业属性',
    assets: '有什么',
    events: '发生了什么',
    constraints: '约束'
  };
  const PROFILE_HINTS = {
    subject: '客户是谁',
    industry: '主营业务/财富来源',
    assets: '资产构成',
    events: '重要事件',
    constraints: '外部法律/监管'
  };
  const PROFILE_SCHEMA_VERSION = 2;
  const EXTERNAL_CONSTRAINT_PATTERN = /法律|法规|监管|税务|税收|纳税|司法|法院|诉讼|仲裁|信披|信息披露|减持(?:规定|规则|限制)|外汇|外管|牌照|许可|审批|审核|备案|登记|合规|反洗钱|CRS|37号文|ODI|QDII|QDLP|限购|限售|法定|强制|证监会|交易所|税务局|外汇局/i;
  const INTERNAL_EVENT_PATTERN = /家庭不和|家庭矛盾|家庭关系|家人反对|家人不同意|家族(?:存在|之间有|意见)?(?:矛盾|纠纷|分歧|意见不一)|夫妻(?:存在|之间有|意见)?(?:矛盾|不和|纠纷|分歧|意见不一)|婚姻(?:变化|矛盾|危机)|离婚|兄弟姐妹(?:存在|之间有|意见)?(?:矛盾|纠纷|分歧|意见不一)|兄弟(?:存在|之间有|意见)?(?:矛盾|纠纷|分歧|意见不一)|姐妹(?:存在|之间有|意见)?(?:矛盾|纠纷|分歧|意见不一)|代际(?:存在|之间有|意见)?(?:矛盾|冲突|分歧|意见不一)|亲属纠纷|家庭意见|传承分歧|继承纠纷/i;
  const INTERNAL_PREFERENCE_PATTERN = /不愿失去控制权|不愿放弃控制权|控制权偏好|不愿承担风险|风险偏好|希望保密|保密偏好|家人意见|时间紧|期限紧|缺乏流动性|流动性不足|资金不足|团队能力不足|执行能力不足/;
  // 「其他」选项的统一文案：渲染时以此为准，历史已生成的问题也会同步显示新文案
  const OTHER_OPTION_LABEL = '点击此处，填写您心目中的答案';
  const PAIN_FALLBACK_QUESTIONS = [
    '先确认主体关系：这位客户在家庭或企业中主要承担什么角色，谁是最终决策人？',
    '这次最想解决的核心事件是什么？如果不处理，客户最担心出现什么结果？',
    '与这件事直接相关的资产、股权或资金安排大致是什么情况？',
    '客户希望在什么时间内推进？目前是否存在明确的时间窗口或紧迫节点？',
    '还有哪些法律、税务、监管、家庭意见或控制权约束必须同时满足？'
  ];
  const SKU_FALLBACK_QUESTIONS = [
    '在刚才确认的痛点中，客户最希望优先解决哪一个，理想结果是什么？',
    '客户更看重控制权、收益、流动性、风险隔离还是传承安排？请选最重要的两项。',
    '客户可投入的资金或可调整的资产范围大致如何，对流动性有什么要求？',
    '客户希望方案何时开始、何时见效，能接受分阶段实施吗？',
    '对于专业机构参与、结构复杂度、合规成本和潜在风险，客户有哪些明确底线？'
  ];
  const PROFILE_CORE_KEYS = ['subject', 'industry', 'assets', 'events', 'constraints'];
  const PROFILE_GAP_QUESTIONS = {
    subject: '先说说这位客户的基本情况：他/她是谁，在家庭或企业中主要承担什么角色？',
    assets: '客户目前主要拥有哪些资产？比如股权、现金、房产，大致的持有形式和占比大概是怎样的？',
    events: '最近、即将或计划发生的重要事件是什么？比如上市、传承、融资、身份变化这些？',
    industry: '客户的主营业务或财富主要来自哪个行业？',
    constraints: '目前有没有已知的法律、监管或税务方面的外部限制？'
  };

  let db = null;
  let sessions = [];
  let activeSessionId = null;
  let activeMessages = [];
  let painRows = [];
  let skuRows = [];
  let skuQuestionBank = null;
  let skuSopBank = null;
  let skuSupplierBank = null;
  let skuSupplierSummaryBank = null;
  let skuPptBank = null;
  let sourceError = '';
  let busy = false;
  let requestNonce = 0;
  let showingArchived = false;
  let skuLongImageManifestPromise = null;
  let serverSyncEnabled = false;
  let demoViewerMode = false; // 发布的演示版：只带样例对话，不带知识库源表
  let serverSyncPending = 0;
  const serverSyncTimers = new Map();
  const pendingServerDeletes = new Set();
  const clientImagePackageCache = new Map();

  const $ = (selector) => document.querySelector(selector);
  const nowIso = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripHtml(value) {
    const div = document.createElement('div');
    div.innerHTML = String(value || '');
    return (div.textContent || '').trim();
  }

  function renderText(value) {
    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  }

  function emptyDimension() {
    return { value: '', evidence: '', confidence: 0, confirmed: false, updatedAt: '' };
  }

  function emptyProfile() {
    return PROFILE_KEYS.reduce((acc, key) => {
      acc[key] = emptyDimension();
      return acc;
    }, {});
  }

  function rawProfileValue(raw) {
    return typeof raw === 'string' ? raw.trim() : String(raw?.value || '').trim();
  }

  function splitProfileParts(value) {
    return String(value || '')
      .split(/[；;。\n，,、]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function joinUniqueProfileParts(...values) {
    const result = [];
    values.flatMap(splitProfileParts).forEach((part) => {
      if (!result.includes(part)) result.push(part);
    });
    return result.join('、');
  }

  function classifyConstraintValue(value, preserveUnknown = false) {
    const constraints = [];
    const events = [];
    const removed = [];
    splitProfileParts(value).forEach((part) => {
      const isExternal = EXTERNAL_CONSTRAINT_PATTERN.test(part);
      const isInternalEvent = INTERNAL_EVENT_PATTERN.test(part);
      const isInternalPreference = INTERNAL_PREFERENCE_PATTERN.test(part);
      if (isInternalEvent) events.push(part);
      if (isExternal) constraints.push(part);
      else if (!isInternalEvent && preserveUnknown && !isInternalPreference) constraints.push(part);
      else if (!isInternalEvent || isInternalPreference) removed.push(part);
    });
    return {
      constraints: joinUniqueProfileParts(constraints),
      events: joinUniqueProfileParts(events),
      removed: joinUniqueProfileParts(removed)
    };
  }

  function withRawProfileValue(raw, value) {
    if (raw && typeof raw === 'object') return { ...raw, value };
    return value;
  }

  function normalizeIncomingProfilePatch(patch) {
    if (!patch || typeof patch !== 'object') return patch;
    const normalized = { ...patch };
    const classified = classifyConstraintValue(rawProfileValue(patch.constraints), false);
    normalized.constraints = withRawProfileValue(patch.constraints, classified.constraints);
    normalized.events = withRawProfileValue(
      patch.events,
      joinUniqueProfileParts(rawProfileValue(patch.events), classified.events)
    );
    return normalized;
  }

  function migrateStoredProfile(profile) {
    const migrated = PROFILE_KEYS.reduce((acc, key) => {
      acc[key] = { ...emptyDimension(), ...(profile?.[key] || {}) };
      return acc;
    }, {});
    const oldEvents = rawProfileValue(migrated.events);
    const oldConstraints = rawProfileValue(migrated.constraints);
    const classified = classifyConstraintValue(oldConstraints, true);
    const nextEvents = joinUniqueProfileParts(oldEvents, classified.events);
    const nextConstraints = classified.constraints;
    migrated.events.value = nextEvents;
    migrated.constraints.value = nextConstraints;
    return {
      profile: migrated,
      changed: oldEvents !== nextEvents || oldConstraints !== nextConstraints
    };
  }

  function emptySkuAnalysis() {
    return {
      candidates: [],
      evaluations: {},
      plan: [],
      asked: [],
      answers: [],
      lastQuestion: null,
      updatedAt: ''
    };
  }

  function normalizeSkuAnalysis(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      candidates: Array.isArray(source.candidates) ? source.candidates : [],
      evaluations: source.evaluations && typeof source.evaluations === 'object' ? source.evaluations : {},
      plan: Array.isArray(source.plan) ? source.plan : [],
      asked: Array.isArray(source.asked) ? source.asked : [],
      answers: Array.isArray(source.answers) ? source.answers : [],
      lastQuestion: source.lastQuestion && typeof source.lastQuestion === 'object' ? source.lastQuestion : null,
      updatedAt: String(source.updatedAt || '')
    };
  }

  function normalizeSession(session) {
    const normalized = {
      id: session.id || uid('session'),
      name: session.name || '未命名客户',
      manualName: !!session.manualName,
      // 演示模板：名称由后台构建时写定，前端任何路径都不得修改
      nameLocked: !!session.nameLocked,
      archived: !!session.archived,
      createdAt: session.createdAt || nowIso(),
      updatedAt: session.updatedAt || nowIso(),
      stage: session.stage || 'CASUAL',
      flow: {
        painStep: Number(session.flow?.painStep || 0),
        skuStep: Number(session.flow?.skuStep || 0),
        refreshStep: Number(session.flow?.refreshStep || 0),
        askedQuestions: Array.isArray(session.flow?.askedQuestions) ? session.flow.askedQuestions : []
      },
      profile: emptyProfile(),
      profileSchemaVersion: PROFILE_SCHEMA_VERSION,
      searchTerms: Array.isArray(session.searchTerms) ? session.searchTerms : [],
      pains: Array.isArray(session.pains) ? session.pains : [],
      skus: Array.isArray(session.skus) ? session.skus : [],
      skuAnalysis: normalizeSkuAnalysis(session.skuAnalysis),
      recommendationVersion: Number(session.recommendationVersion || 0),
      painQuestionPlan: Array.isArray(session.painQuestionPlan) ? session.painQuestionPlan : null,
      skuQuestionPlan: Array.isArray(session.skuQuestionPlan) ? session.skuQuestionPlan : null
    };
    PROFILE_KEYS.forEach((key) => {
      const dim = session.profile?.[key];
      if (typeof dim === 'string') normalized.profile[key] = { ...emptyDimension(), value: dim };
      else if (dim && typeof dim === 'object') normalized.profile[key] = { ...emptyDimension(), ...dim };
    });
    const migration = migrateStoredProfile(normalized.profile);
    normalized.profile = migration.profile;
    Object.defineProperty(normalized, '_profileMigrated', {
      value: migration.changed || Number(session.profileSchemaVersion || 0) < PROFILE_SCHEMA_VERSION,
      enumerable: false
    });
    return normalized;
  }

  function createSessionRecord() {
    const stamp = nowIso();
    return normalizeSession({
      id: uid('session'),
      name: '未命名客户',
      createdAt: stamp,
      updatedAt: stamp,
      stage: 'CASUAL'
    });
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB 操作失败'));
    });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const upgradeDb = request.result;
        if (!upgradeDb.objectStoreNames.contains('sessions')) {
          const store = upgradeDb.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!upgradeDb.objectStoreNames.contains('messages')) {
          const store = upgradeDb.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId');
          store.createIndex('createdAt', 'createdAt');
        }
        if (!upgradeDb.objectStoreNames.contains('recommendations')) {
          const store = upgradeDb.createObjectStore('recommendations', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开本地客户数据库'));
    });
  }

  function putRecord(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => {
        if (serverSyncEnabled) scheduleServerSyncForRecord(storeName, record);
        resolve(record);
      };
      tx.onerror = () => reject(tx.error || new Error('本地保存失败'));
    });
  }

  function getAllRecords(storeName) {
    return requestPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  }

  function getSessionMessages(sessionId) {
    const tx = db.transaction('messages', 'readonly');
    const request = tx.objectStore('messages').index('sessionId').getAll(IDBKeyRange.only(sessionId));
    return requestPromise(request).then((rows) => rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
  }

  function getSessionRecommendations(sessionId) {
    const tx = db.transaction('recommendations', 'readonly');
    const request = tx.objectStore('recommendations').index('sessionId').getAll(IDBKeyRange.only(sessionId));
    return requestPromise(request).then((rows) => rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
  }

  function deleteRecordById(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('删除本地记录失败'));
    });
  }

  function deleteBySession(storeName, sessionId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('sessionId');
      const cursorRequest = index.openCursor(IDBKeyRange.only(sessionId));
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('删除本地记录失败'));
    });
  }

  function deleteSessionRecord(sessionId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').delete(sessionId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('删除客户失败'));
    });
  }

  async function saveSession(session) {
    session.updatedAt = nowIso();
    await putRecord('sessions', session);
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    renderSessionList();
    renderHeader();
  }

  function setServerSyncStatus(text, state = '') {
    const status = $('#caSyncStatus');
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
  }

  function sessionRecordTime(record) {
    const value = record?.updatedAt || record?.createdAt || '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function hasUserConversation(sessionId, messages) {
    const session = sessions.find((item) => item.id === sessionId);
    return messages.some((item) => item.sessionId === sessionId && item.role === 'user')
      || Boolean(session?.pains?.length)
      || Boolean(session?.skus?.length)
      || (session?.stage && session.stage !== 'CASUAL');
  }

  async function buildServerSessionSnapshot(sessionId) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return null;
    const [messages, recommendations] = await Promise.all([
      getSessionMessages(sessionId),
      getSessionRecommendations(sessionId)
    ]);
    return {
      version: 1,
      id: sessionId,
      updatedAt: session.updatedAt || nowIso(),
      deleted: false,
      session,
      messages,
      recommendations
    };
  }

  async function syncSessionToServer(sessionId) {
    if (!serverSyncEnabled || pendingServerDeletes.has(sessionId)) return;
    const snapshot = await buildServerSessionSnapshot(sessionId);
    if (!snapshot) return;
    serverSyncPending += 1;
    setServerSyncStatus('正在同步客户档案…', 'syncing');
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setServerSyncStatus('客户档案已保存到本机', 'saved');
    } catch (error) {
      console.warn('客户档案等待同步：', error.message);
      setServerSyncStatus('等待本地服务，浏览器缓存已保留', 'waiting');
    } finally {
      serverSyncPending = Math.max(0, serverSyncPending - 1);
    }
  }

  function scheduleServerSync(sessionId, delay = 350) {
    if (!serverSyncEnabled || !sessionId || pendingServerDeletes.has(sessionId)) return;
    const current = serverSyncTimers.get(sessionId);
    if (current) clearTimeout(current);
    serverSyncTimers.set(sessionId, setTimeout(() => {
      serverSyncTimers.delete(sessionId);
      syncSessionToServer(sessionId);
    }, delay));
  }

  function scheduleServerSyncForRecord(storeName, record) {
    if (!record) return;
    const sessionId = storeName === 'sessions' ? record.id : record.sessionId;
    scheduleServerSync(sessionId);
  }

  async function deleteSessionOnServer(sessionId) {
    pendingServerDeletes.add(sessionId);
    const timer = serverSyncTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    serverSyncTimers.delete(sessionId);
    setServerSyncStatus('正在同步删除…', 'syncing');
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      pendingServerDeletes.delete(sessionId);
      setServerSyncStatus('客户档案已保存到本机', 'saved');
    } catch (error) {
      console.warn('删除操作等待同步：', error.message);
      setServerSyncStatus('删除等待本地服务恢复', 'waiting');
    }
  }

  async function mergeServerSessions() {
    setServerSyncStatus('正在读取本机客户档案…', 'syncing');
    let remoteItems = [];
    try {
      const response = await fetch('/api/sessions', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      remoteItems = Array.isArray(payload.items) ? payload.items : [];
    } catch (error) {
      serverSyncEnabled = true;
      setServerSyncStatus('本地服务暂不可用，正在使用浏览器缓存', 'waiting');
      return;
    }

    const [localSessions, localMessages, localRecommendations] = await Promise.all([
      getAllRecords('sessions'),
      getAllRecords('messages'),
      getAllRecords('recommendations')
    ]);
    const localSessionMap = new Map(localSessions.map((item) => [item.id, item]));
    const remoteIds = new Set(remoteItems.map((item) => item.id));
    serverSyncEnabled = false;

    for (const remote of remoteItems) {
      const sessionId = remote.id;
      if (!sessionId) continue;
      if (remote.deleted) {
        await deleteBySession('messages', sessionId);
        await deleteBySession('recommendations', sessionId);
        await deleteSessionRecord(sessionId);
        localSessionMap.delete(sessionId);
        continue;
      }
      if (!remote.session) continue;
      const localSession = localSessionMap.get(sessionId);
      const winner = !localSession || sessionRecordTime(remote.session) >= sessionRecordTime(localSession)
        ? normalizeSession(remote.session)
        : normalizeSession(localSession);
      await putRecord('sessions', winner);
      localSessionMap.set(sessionId, winner);

      const messageMap = new Map(localMessages.filter((item) => item.sessionId === sessionId).map((item) => [item.id, item]));
      (remote.messages || []).forEach((item) => messageMap.set(item.id, item));
      for (const message of messageMap.values()) await putRecord('messages', message);

      const recommendationMap = new Map(localRecommendations.filter((item) => item.sessionId === sessionId).map((item) => [item.id, item]));
      (remote.recommendations || []).forEach((item) => {
        const previous = recommendationMap.get(item.id);
        if (!previous || sessionRecordTime(item) >= sessionRecordTime(previous)) recommendationMap.set(item.id, item);
      });
      for (const recommendation of recommendationMap.values()) await putRecord('recommendations', recommendation);
    }

    if (remoteItems.some((item) => !item.deleted)) {
      for (const localSession of localSessions) {
        if (remoteIds.has(localSession.id)) continue;
        if (!hasUserConversation(localSession.id, localMessages)) {
          await deleteBySession('messages', localSession.id);
          await deleteBySession('recommendations', localSession.id);
          await deleteSessionRecord(localSession.id);
          localSessionMap.delete(localSession.id);
        }
      }
    }

    sessions = (await getAllRecords('sessions')).map(normalizeSession);
    serverSyncEnabled = true;
    for (const session of sessions) scheduleServerSync(session.id, 0);
    setServerSyncStatus('客户档案已保存到本机', 'saved');
  }

  async function addMessage(role, content, type = 'text', data = null, sessionId = activeSessionId) {
    const message = {
      id: uid('message'),
      sessionId,
      role,
      type,
      content: String(content || ''),
      data: data || null,
      createdAt: nowIso()
    };
    await putRecord('messages', message);
    const owner = sessions.find((item) => item.id === sessionId);
    if (owner) {
      owner.updatedAt = message.createdAt;
      await putRecord('sessions', owner);
      renderSessionList();
    }
    if (sessionId === activeSessionId) {
      activeMessages.push(message);
      renderMessages();
    }
    return message;
  }

  function getActiveSession() {
    return sessions.find((item) => item.id === activeSessionId) || null;
  }

  function mountApp() {
    const root = document.createElement('div');
    root.id = 'assistantApp';
    root.innerHTML = `
      <header class="ca-app-header">
        <div class="ca-app-title">企业家客户管理智能驾驶舱</div>
        <div class="ca-app-meta"><span>（渠道）</span><span>（用户名）</span></div>
      </header>
      <aside class="ca-sidebar">
        <nav class="ca-nav-section">
          <div class="ca-nav-title">客户深耕</div>
          <button class="ca-primary-btn" id="caNewSession">＋ 新建客户对话</button>
          <input class="ca-search" id="caSessionSearch" placeholder="搜索客户…">
          <div class="ca-list-label"><span id="caListLabel">最近对话</span><button class="ca-icon-btn" id="caToggleArchived">归档</button></div>
          <div class="ca-session-list" id="caSessionList"></div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="今日待办">今日待办 <span class="ca-nav-badge">5</span></button></div>
        </nav>
        <nav class="ca-nav-section">
          <div class="ca-nav-title">模拟陪练场</div>
          <button class="ca-primary-btn" id="caRpNewSession">＋ 新建陪练</button>
          <div class="ca-list-label"><span>历史陪练</span></div>
          <div class="ca-session-list" id="caRpSessionList"></div>
        </nav>
        <nav class="ca-nav-section">
          <div class="ca-nav-title">营销助手</div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="热点借势工坊">热点借势工坊</button></div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="通用素材库">通用素材库</button></div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="拓客雷达">拓客雷达</button></div>
        </nav>
        <nav class="ca-nav-section">
          <div class="ca-nav-title">能力提升</div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="案例研究员">案例研究员</button></div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="法税百科">法税百科</button></div>
          <div class="ca-nav-row"><input type="checkbox" class="ca-nav-checkbox"><button class="ca-nav-stub" data-stub="个人成长看板">个人成长看板</button></div>
        </nav>
        <div class="ca-sidebar-footer">
          <div class="ca-source-status" id="caSyncStatus">正在连接本机客户档案…</div>
          <div class="ca-source-status" id="caSourceStatus">正在读取痛点库与 SKU 知识卡片…</div>
          <div class="ca-footer-actions">
            <button class="ca-secondary-btn" id="caAdvancedTools">高级工具</button>
            <button class="ca-secondary-btn" id="caApiSettings">API 设置</button>
            <button class="ca-secondary-btn" id="caExportBackup">导出备份</button>
            <button class="ca-secondary-btn" id="caImportBackup">导入备份</button>
            <button class="ca-secondary-btn" id="caImportConversation" title="导入同事分享的单条对话">导入对话</button>
          </div>
          <input type="file" id="caImportFile" accept="application/json,.json" hidden>
          <input type="file" id="caImportConvFile" accept="application/json,.json" hidden>
        </div>
      </aside>
      <div class="ca-resize-handle" id="caResizeHandle" title="拖动调整宽度"></div>
      <main class="ca-main">
        <header class="ca-topbar">
          <button class="ca-icon-btn ca-mobile-menu" id="caMobileMenu">☰</button>
          <div class="ca-client-heading">
            <h1 id="caClientTitle">未命名客户 <span class="ca-stage-badge" id="caStageBadge">随心聊</span></h1>
            <p id="caClientSub">聊天、客户画像、痛点与 SKU 推荐将自动保存在本机</p>
          </div>
          <div class="ca-top-actions">
            <button class="ca-icon-btn" id="caRenameSession">重命名</button>
            <button class="ca-icon-btn" id="caExportConversation" title="导出这条对话，可发给同事导入">导出对话</button>
            <button class="ca-icon-btn" id="caArchiveSession">归档</button>
            <button class="ca-icon-btn" id="caDeleteSession">删除</button>
            <button class="ca-icon-btn ca-settings-btn" id="caTopSettings">⚙ 设置</button>
          </div>
        </header>
        <div class="ca-progress"><div class="ca-progress-bar" id="caProgressBar"></div></div>
        <section class="ca-messages" id="caMessages"></section>
        <div class="ca-quick-row" id="caQuickRow"></div>
        <footer class="ca-input-area" id="caInputArea">
          <div class="ca-input-wrap">
            <div class="ca-slash-menu" id="caSlashMenu" hidden></div>
            <textarea class="ca-input" id="caInput" rows="1" placeholder="输入聊天内容、客户信息，或输入 / 查看可用技能…"></textarea>
            <button class="ca-send-btn" id="caSend" title="发送">➤</button>
          </div>
          <div class="ca-input-hint">Enter 发送，Shift + Enter 换行。输入 / 可调用需求挖掘、面谈纪要、方案解读、话术建议等技能。客户资料会自动保存到本机，并在本机浏览器间共享。</div>
        </footer>
      </main>
      <aside class="ca-insights" id="caInsights">
        <section class="ca-insight-block">
          <div class="ca-card-head"><h3>客户画像</h3></div>
          <div id="caInsightProfile"></div>
        </section>
        <section class="ca-insight-block">
          <div class="ca-card-head"><h3>智能洞察</h3></div>
          <div id="caInsightPains"></div>
        </section>
        <section class="ca-insight-block">
          <div class="ca-card-head"><h3>跟进助手</h3></div>
          <div id="caInsightFollowup"></div>
        </section>
      </aside>
      <main class="ca-rp-main-panel" id="caRpMainPanel">
        <header class="ca-topbar">
          <button class="ca-icon-btn ca-mobile-menu" id="caRpMobileMenu">☰</button>
          <div class="ca-client-heading">
            <h1>模拟陪练场 <span class="ca-stage-badge" id="caRpModeBadge">陪练中</span></h1>
            <p id="caRpSub">AI 正在扮演客户，与你进行沟通沙盘推演</p>
          </div>
          <div class="ca-top-actions">
            <button class="ca-icon-btn" id="caRpReportBtn">生成能力评估</button>
            <button class="ca-icon-btn" id="caRpExit">退出陪练</button>
          </div>
        </header>
        <section class="ca-messages" id="caRoleplayMessages"></section>
        <div class="ca-rp-report-inline" id="caRoleplayReport" hidden></div>
        <footer class="ca-input-area" id="caRpInputArea">
          <div class="ca-input-wrap">
            <textarea class="ca-input" id="caRoleplayInput" rows="1" placeholder="以客户经理身份说点什么…（Enter 发送，Shift+Enter 换行）"></textarea>
            <button class="ca-send-btn" id="caRoleplaySend" title="发送">➤</button>
          </div>
          <div class="ca-input-hint">Enter 发送，Shift + Enter 换行。这是与 AI 客户的模拟对话，不会保存为真实客户会话。</div>
        </footer>
      </main>
      <aside class="ca-rp-side-panel" id="caRpSidePanel">
        <section class="ca-insight-block">
          <div class="ca-card-head"><h3>当前角色档案</h3></div>
          <div id="caRpRoleProfile"></div>
          <button class="ca-secondary-btn ca-rp-saveclient" id="caRpSaveClient">保存为客户档案</button>
        </section>
        <section class="ca-insight-block">
          <div class="ca-card-head"><h3>陪练目标</h3></div>
          <div id="caRpGoals"></div>
        </section>
        <section class="ca-insight-block">
          <div class="ca-card-head"><h3>策略提示</h3></div>
          <div id="caRpTips"></div>
        </section>
      </aside>
      <div class="ca-hotspot-modal" id="caHotspotModal" hidden>
        <div class="ca-hotspot-panel">
          <div class="ca-hotspot-head">
            <div><strong>热点借势工坊</strong><small>法律 / 税务 / 资本市场热点 · 模拟抓取</small></div>
            <button class="ca-icon-btn" id="caHotspotClose">✕ 关闭</button>
          </div>
          <div class="ca-hotspot-tabs" id="caHotspotFilters"></div>
          <div class="ca-hotspot-body">
            <div class="ca-hotspot-list" id="caHotspotList"></div>
            <div class="ca-hotspot-detail" id="caHotspotDetail"></div>
          </div>
        </div>
      </div>
      <div class="ca-hotspot-modal" id="caMaterialModal" hidden>
        <div class="ca-hotspot-panel">
          <div class="ca-hotspot-head">
            <div><strong>通用素材库</strong><small>朝曦自产 · 常青素材 · 一键换皮（模拟演示）</small></div>
            <button class="ca-icon-btn" id="caMaterialClose">✕ 关闭</button>
          </div>
          <div class="ca-hotspot-tabs" id="caMaterialFilters"></div>
          <div class="ca-hotspot-body">
            <div class="ca-hotspot-list" id="caMaterialList"></div>
            <div class="ca-hotspot-detail" id="caMaterialDetail"></div>
          </div>
        </div>
      </div>
      <div class="ca-hotspot-modal" id="caRoleplayModal" hidden>
        <div class="ca-hotspot-panel ca-roleplay-panel">
          <div class="ca-hotspot-head">
            <div><strong>模拟陪练场</strong><small>设定要面对的客户 · 点"开始陪练"进入对话</small></div>
            <button class="ca-icon-btn" id="caRoleplayClose">✕ 关闭</button>
          </div>
          <div class="ca-roleplay-setup" id="caRoleplaySetup"></div>
        </div>
      </div>
      <div class="ca-hotspot-modal" id="caLexiconModal" hidden>
        <div class="ca-hotspot-panel ca-lexicon-panel">
          <div class="ca-hotspot-head">
            <div><strong>法税百科</strong><small>法税 / 家办专业名词 · 白话翻译 · 朝曦自有知识库</small></div>
            <button class="ca-icon-btn" id="caLexiconClose">✕ 关闭</button>
          </div>
          <div class="ca-lexicon-searchbar">
            <input id="caLexiconInput" placeholder="输入法税/家办专业名词或问题，如：减持限制、弃籍税、什么是流通股…">
            <button class="ca-primary-btn" id="caLexiconSearch">查询</button>
          </div>
          <div class="ca-lexicon-hot" id="caLexiconHot"></div>
          <div class="ca-lexicon-answer" id="caLexiconAnswer"></div>
        </div>
      </div>
      <div class="ca-hotspot-modal" id="caGrowthModal" hidden>
        <div class="ca-hotspot-panel ca-growth-panel">
          <div class="ca-hotspot-head">
            <div><strong>个人成长看板</strong><small>客户经理 · 使用与成长数据看板</small></div>
            <button class="ca-icon-btn" id="caGrowthClose">✕ 关闭</button>
          </div>
          <div class="ca-growth-body" id="caGrowthBody"></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    const toast = document.createElement('div');
    toast.className = 'ca-toast';
    toast.id = 'caToast';
    document.body.appendChild(toast);
    document.body.classList.add('assistant-mode');
  }

  const HOTSPOT_NEWS = [
    { id: 'h1', category: '法律', date: '07-18', title: '新《公司法》股权变更登记新规落地实施', summary: '有限公司股权变更、认缴出资加速到期等新规正式生效，涉及股权代持、历史沿革不清晰的企业面临登记合规窗口。' },
    { id: 'h2', category: '法律', date: '07-15', title: '最高法发布家族信托纠纷典型案例', summary: '案例明确信托财产独立性认定标准，对婚姻财产隔离、代际传承架构的稳定性提出新的司法参考口径。' },
    { id: 'h3', category: '法律', date: '07-10', title: '跨境遗产继承公证认证新规征求意见', summary: '涉外继承文书的公证、认证流程拟简化，跨境资产传承的合规路径有望缩短。' },
    { id: 'h4', category: '税务', date: '07-19', title: 'CRS新一轮跨境金融账户涉税信息交换启动', summary: '新一轮信息交换覆盖更多辖区，境外账户、离岸架构的税务合规复核需求上升。' },
    { id: 'h5', category: '税务', date: '07-14', title: '个人所得税反避税规则加强境外所得申报核查', summary: '税务机关对境内居民境外所得的申报真实性核查趋严，历史申报缺口存在被追溯风险。' },
    { id: 'h6', category: '税务', date: '07-08', title: '委托代持股权税务处理新指引发布', summary: '明确代持还原环节的计税基础与纳税义务人认定，代持结构清理有了更清晰的税务口径。' },
    { id: 'h7', category: '资本市场', date: '07-20', title: '证监会就上市公司股东减持新规公开征求意见', summary: '拟对大股东、董监高减持的预披露期限与集中竞价比例作出调整，涉及控股股东流动性安排。' },
    { id: 'h8', category: '资本市场', date: '07-12', title: '科创板股权激励个税递延新政策解读', summary: '递延纳税适用范围扩大，上市公司股权激励方案设计的税务成本测算口径随之变化。' },
    { id: 'h9', category: '资本市场', date: '07-05', title: '境内企业境外上市备案新规实施满一年', summary: '备案新规实施一年来案例回顾显示，股权架构清晰度与关联交易披露是审核关注重点。' }
  ];

  let hotspotFilter = '全部';
  let hotspotSelectedId = null;

  function openHotspotWorkshop() {
    console.info('[热点工坊] openHotspotWorkshop 被调用');
    const modal = $('#caHotspotModal');
    if (!modal) { console.error('[热点工坊] 找不到 #caHotspotModal'); return; }
    modal.hidden = false;
    try {
      renderHotspotFilters();
      renderHotspotList();
      if (!hotspotSelectedId) selectHotspotItem(HOTSPOT_NEWS[0].id);
      console.info('[热点工坊] 渲染完成，filters=', $('#caHotspotFilters')?.children.length, 'list=', $('#caHotspotList')?.children.length);
    } catch (error) {
      console.error('热点借势工坊渲染失败：', error);
      const detail = $('#caHotspotDetail');
      if (detail) detail.innerHTML = `<div class="ca-insight-empty">加载失败：${escapeHtml(error.message)}，请关闭后重试。</div>`;
    }
  }

  function closeHotspotWorkshop() {
    const modal = $('#caHotspotModal');
    if (modal) modal.hidden = true;
  }

  function renderHotspotFilters() {
    const row = $('#caHotspotFilters');
    if (!row) return;
    const cats = ['全部', '法律', '税务', '资本市场'];
    row.innerHTML = cats.map((cat) => `<button class="ca-hotspot-tab ${cat === hotspotFilter ? 'active' : ''}" data-hotspot-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join('');
  }

  function renderHotspotList() {
    const list = $('#caHotspotList');
    if (!list) return;
    const items = HOTSPOT_NEWS.filter((item) => hotspotFilter === '全部' || item.category === hotspotFilter);
    list.innerHTML = items.map((item) => `<button class="ca-hotspot-item ${item.id === hotspotSelectedId ? 'active' : ''}" data-hotspot-id="${escapeHtml(item.id)}">
      <span class="ca-hotspot-cat">${escapeHtml(item.category)}</span>
      <div class="ca-hotspot-item-title">${escapeHtml(item.title)}</div>
      <div class="ca-hotspot-item-date">${escapeHtml(item.date)}</div>
    </button>`).join('') || '<div class="ca-insight-empty">该分类暂无热点</div>';
  }

  async function generateHotspotCopy(item) {
    try {
      const result = await callDeepSeekJSON([
        {
          role: 'system',
          content: '你是朝曦家办的新媒体运营，请为给定的政策/热点事件撰写一条适合发朋友圈的转发文案，专业、亲和、不夸大、不使用感叹号轰炸，控制在120字以内，末尾可加1-2个话题标签。只返回JSON：{"copy":"文案内容"}'
        },
        { role: 'user', content: `热点标题：${item.title}\n热点摘要：${item.summary}\n所属领域：${item.category}` }
      ], 2);
      const copy = String(result.copy || '').trim();
      if (!copy) throw new Error('生成内容为空');
      return copy;
    } catch (error) {
      console.warn('朋友圈文案AI生成失败，使用本地模板：', error.message);
      return `【${item.category}热点】${item.title}。${item.summary}如您有相关安排需要梳理，欢迎随时交流。#朝曦家办 #${item.category}`;
    }
  }

  async function selectHotspotItem(id) {
    hotspotSelectedId = id;
    renderHotspotList();
    const item = HOTSPOT_NEWS.find((entry) => entry.id === id);
    const detail = $('#caHotspotDetail');
    if (!item || !detail) return;
    detail.innerHTML = `
      <div class="ca-hotspot-detail-head">
        <span class="ca-hotspot-cat">${escapeHtml(item.category)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
      </div>
      <div class="ca-hotspot-output" id="caHotspotOutputCopy"><b>朋友圈文案</b><div class="ca-hotspot-loading">生成中…</div></div>
      <div class="ca-hotspot-output" id="caHotspotOutputImage"><b>长图预览</b><div class="ca-hotspot-loading">生成中…</div></div>
      <div class="ca-hotspot-output"><b>数字人短视频</b><div class="ca-hotspot-video-mock">📹 模拟演示：数字人短视频生成即将上线，当前展示口播脚本预览。</div></div>
    `;
    const copy = await generateHotspotCopy(item);
    if (hotspotSelectedId !== id) return;
    $('#caHotspotOutputCopy').innerHTML = `<b>朋友圈文案</b><p>${escapeHtml(copy)}</p><button class="ca-secondary-btn" data-hotspot-regen="${escapeHtml(id)}">重新生成</button>`;
    $('#caHotspotOutputImage').innerHTML = `<b>长图预览</b><div class="ca-hotspot-long-image">
      <div class="ca-hotspot-long-brand">朝曦家办 · 热点解读</div>
      <div class="ca-hotspot-long-cat">${escapeHtml(item.category)}</div>
      <div class="ca-hotspot-long-title">${escapeHtml(item.title)}</div>
      <div class="ca-hotspot-long-summary">${escapeHtml(item.summary)}</div>
      <div class="ca-hotspot-long-copy">${escapeHtml(copy)}</div>
    </div>`;
  }

  // 通用素材库（模拟演示数据）：朝曦自产、常青、可一键换皮的对客素材
  const MATERIAL_LIBRARY = [
    {
      id: 'mg1', category: '一图读懂', title: '什么是家族信托？一图看懂', tag: '传承',
      render: (item) => `<div class="ca-hotspot-long-image">
        <div class="ca-hotspot-long-brand">朝曦家办 · 客户科普</div>
        <div class="ca-hotspot-long-cat">家族传承</div>
        <div class="ca-hotspot-long-title">${escapeHtml(item.title)}</div>
        <div class="ca-hotspot-long-summary">用一张图讲清家族信托的 3 个核心作用与设立要点。</div>
        <div class="ca-hotspot-long-copy">① 财产独立：信托财产独立于委托人个人资产，实现风险隔离<br>② 按意愿分配：可约定给谁、给多少、何时给、附什么条件<br>③ 代际传承：跨越继承纠纷，实现财富有序传递<br>设立要点：合法财产来源 · 明确受益人 · 专业架构设计</div>
      </div>` },
    {
      id: 'mg2', category: '一图读懂', title: 'CRS 到底查什么？一图读懂', tag: '税务',
      render: (item) => `<div class="ca-hotspot-long-image">
        <div class="ca-hotspot-long-brand">朝曦家办 · 客户科普</div>
        <div class="ca-hotspot-long-cat">跨境税务</div>
        <div class="ca-hotspot-long-title">${escapeHtml(item.title)}</div>
        <div class="ca-hotspot-long-summary">境外账户信息交换，普通高净值家庭需要关注什么。</div>
        <div class="ca-hotspot-long-copy">查什么：境外金融账户余额、利息、股息、账户持有人信息<br>谁上报：境外银行/券商/保险机构 → 所在国税务机关 → 交换回中国<br>影响谁：拥有境外账户、离岸公司、境外保单的中国税务居民<br>如何应对：厘清账户结构 · 评估历史申报 · 合规优化</div>
      </div>` },
    {
      id: 'mg3', category: '一图读懂', title: '遗嘱 vs 家族信托，区别在哪？', tag: '传承',
      render: (item) => `<div class="ca-hotspot-long-image">
        <div class="ca-hotspot-long-brand">朝曦家办 · 客户科普</div>
        <div class="ca-hotspot-long-cat">财富传承</div>
        <div class="ca-hotspot-long-title">${escapeHtml(item.title)}</div>
        <div class="ca-hotspot-long-summary">两种传承工具，选哪个？一张表看懂。</div>
        <div class="ca-hotspot-long-copy">遗嘱：身故后生效 · 需经继承程序 · 易被质疑 · 不隔离债务<br>家族信托：生前即可运作 · 绕开继承纠纷 · 财产独立隔离 · 可附条件分配<br>结论：财富规模大、结构复杂、有隔离/防挥霍需求 → 信托更优；简单分配 → 遗嘱亦可</div>
      </div>` }
    ,
    {
      id: 'mf1', category: 'FAQ应答卡', title: '股份代持能还原吗？', tag: '法律',
      render: (item) => `<div class="ca-material-faq">
        <div class="ca-material-q">Q：${escapeHtml(item.title)}</div>
        <div class="ca-material-a"><b>白话版（讲给客户）</b><p>能，但要看两点：一是代持这件事有没有书面证据（协议、转账、分红记录），二是代持人愿不愿意配合。证据齐、对方配合，就能把股份还原到你名下；反之可能有争议，建议尽早规范。</p></div>
        <div class="ca-material-a"><b>专业版（内部口径）</b><p>代持还原需核查代持协议效力、实际出资凭证、代持人配合意愿及标的公司章程限制；涉及工商变更登记与股权转让的税务处理，拟上市企业还须满足股权清晰的合规要求。</p></div>
      </div>` },
    {
      id: 'mf2', category: 'FAQ应答卡', title: '境外账户要不要申报？', tag: '税务',
      render: (item) => `<div class="ca-material-faq">
        <div class="ca-material-q">Q：${escapeHtml(item.title)}</div>
        <div class="ca-material-a"><b>白话版（讲给客户）</b><p>如果你是中国税务居民，境外账户产生的收益（利息、分红、投资收益等）原则上是要在中国申报纳税的。现在信息会跨境交换，过去没申报的部分存在被追溯的风险，建议先做一次合规体检。</p></div>
        <div class="ca-material-a"><b>专业版（内部口径）</b><p>中国税务居民全球所得纳税，境外所得应依法申报；结合 CRS 信息交换趋势，需评估历史申报缺口与补正路径，必要时进行税务合规安排。</p></div>
      </div>` },
    {
      id: 'mf3', category: 'FAQ应答卡', title: '几个孩子怎么分家产最稳？', tag: '传承',
      render: (item) => `<div class="ca-material-faq">
        <div class="ca-material-q">Q：${escapeHtml(item.title)}</div>
        <div class="ca-material-a"><b>白话版（讲给客户）</b><p>关键不是"平均分"，而是"分得清、分得稳、少纠纷"。可以用信托或家族宪章事先约定好谁管企业、谁拿收益、什么条件下拿，把感情问题变成规则问题，避免将来子女之间扯皮。</p></div>
        <div class="ca-material-a"><b>专业版（内部口径）</b><p>结合企业控制权与家族财富分离原则，运用家族信托、家族宪章、股权分层等工具，实现经营权与收益权的差异化安排，降低继承纠纷与控制权分散风险。</p></div>
      </div>` }
    ,
    {
      id: 'ms1', category: '节点营销', title: '年终 · 跨境资产年度合规盘点', tag: '税务',
      render: (item) => `<div class="ca-hotspot-long-image">
        <div class="ca-hotspot-long-brand">朝曦家办 · 年终专题</div>
        <div class="ca-hotspot-long-cat">节点营销</div>
        <div class="ca-hotspot-long-title">${escapeHtml(item.title)}</div>
        <div class="ca-hotspot-long-copy">又到年底，除了盘点收成，别忘了给跨境资产做一次"体检"：境外账户申报是否到位？离岸架构是否仍然合规？信托与保单是否需要调整？新的一年，让财富轻装上阵。<br><br>#朝曦家办 #跨境合规 #年终盘点</div>
      </div>` },
    {
      id: 'ms2', category: '节点营销', title: '开年 · 新一年财富规划三件事', tag: '综合',
      render: (item) => `<div class="ca-hotspot-long-image">
        <div class="ca-hotspot-long-brand">朝曦家办 · 开年专题</div>
        <div class="ca-hotspot-long-cat">节点营销</div>
        <div class="ca-hotspot-long-title">${escapeHtml(item.title)}</div>
        <div class="ca-hotspot-long-copy">新的一年，财富规划先做三件事：① 家庭资产做一次全面梳理；② 传承安排提上日程，别等"来得及"；③ 跨境与税务合规先行一步。规划要趁早，从容才安心。<br><br>#朝曦家办 #财富规划 #新年计划</div>
      </div>` }
    ,
    {
      id: 'mp1', category: '服务一页纸', title: '家族信托服务 · 对客一页纸', tag: '传承',
      render: (item) => `<div class="ca-material-onepager">
        <h4>${escapeHtml(item.title)}</h4>
        <p class="ca-material-value">一句话价值：把"给谁、给多少、怎么给"变成可执行的规则，让财富有序、安全地传下去。</p>
        <p><b>适用场景</b>：财富规模较大、家庭结构复杂、有防挥霍/防离婚析产/代际传承需求。</p>
        <p><b>能解决</b>：继承纠纷、财产混同风险、控制权分散、传承意愿难落地。</p>
        <p><b>配套</b>：可与保险金信托、家族宪章、跨境架构组合使用。</p>
      </div>` },
    {
      id: 'mp2', category: '服务一页纸', title: '跨境身份与税务规划 · 对客一页纸', tag: '身份',
      render: (item) => `<div class="ca-material-onepager">
        <h4>${escapeHtml(item.title)}</h4>
        <p class="ca-material-value">一句话价值：在合规前提下，为家庭的跨境生活、教育与资产配置匹配合适的身份与税务安排。</p>
        <p><b>适用场景</b>：子女海外教育、家庭成员移居、境外资产配置、CRS 合规诉求。</p>
        <p><b>能解决</b>：双重税务居民风险、境外所得申报、身份与资产错配问题。</p>
        <p><b>配套</b>：可与离岸信托、境外保单、ODI/外汇合规组合使用。</p>
      </div>` }
    ,
    {
      id: 'mv1', category: '口播脚本', title: '高净值人群最该先做的一件事（30秒）', tag: '综合',
      render: (item) => `<div class="ca-material-script">
        <div class="ca-material-script-head">📹 数字人 / 口播脚本 · 约 30 秒</div>
        <p>很多老板赚钱很厉害，但有一件事常常忽略——<b>财富的"防守"</b>。</p>
        <p>企业风险、婚姻变化、代际传承，任何一个都可能让多年积累缩水。</p>
        <p>与其等问题发生，不如提前做好三道防线：<b>资产隔离、传承安排、合规体检</b>。</p>
        <p>财富规划，越早越从容。我是你的朝曦顾问，有需要随时找我。</p>
      </div>` },
    {
      id: 'mv2', category: '口播脚本', title: '90秒讲清家族信托', tag: '传承',
      render: (item) => `<div class="ca-material-script">
        <div class="ca-material-script-head">📹 数字人 / 口播脚本 · 约 90 秒</div>
        <p>什么是家族信托？简单说，就是你把一笔财产交给受托人，按你定的规则，替你管、替你传。</p>
        <p>它有三个厉害之处：第一，<b>财产独立</b>，和你的个人资产分开，风险隔离；第二，<b>按意愿分配</b>，给谁、给多少、什么时候给、附什么条件，你说了算；第三，<b>跨代传承</b>，绕开继承纠纷，财富有序传下去。</p>
        <p>它适合谁？财富规模大、家庭结构复杂、希望财富"传得稳"的家庭。</p>
        <p>想知道你的情况适不适合？找我聊聊，帮你梳理清楚。</p>
      </div>` }
  ];

  const MATERIAL_CATEGORIES = ['全部', '一图读懂', 'FAQ应答卡', '节点营销', '服务一页纸', '口播脚本'];
  let materialFilter = '全部';
  let materialSelectedId = null;

  function openMaterialLibrary() {
    const modal = $('#caMaterialModal');
    if (!modal) return;
    modal.hidden = false;
    materialSelectedId = null;
    renderMaterialFilters();
    renderMaterialList();
    const first = MATERIAL_LIBRARY.find((item) => materialFilter === '全部' || item.category === materialFilter);
    if (first) selectMaterialItem(first.id);
  }

  function closeMaterialLibrary() {
    const modal = $('#caMaterialModal');
    if (modal) modal.hidden = true;
  }

  function renderMaterialFilters() {
    const row = $('#caMaterialFilters');
    if (!row) return;
    row.innerHTML = MATERIAL_CATEGORIES.map((cat) => `<button class="ca-hotspot-tab ${cat === materialFilter ? 'active' : ''}" data-material-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join('');
  }

  function renderMaterialList() {
    const list = $('#caMaterialList');
    if (!list) return;
    const items = MATERIAL_LIBRARY.filter((item) => materialFilter === '全部' || item.category === materialFilter);
    list.innerHTML = items.map((item) => `<button class="ca-hotspot-item ${item.id === materialSelectedId ? 'active' : ''}" data-material-id="${escapeHtml(item.id)}">
      <span class="ca-hotspot-cat">${escapeHtml(item.category)}</span>
      <div class="ca-hotspot-item-title">${escapeHtml(item.title)}</div>
      <div class="ca-hotspot-item-date">${escapeHtml(item.tag || '')}</div>
    </button>`).join('') || '<div class="ca-insight-empty">该分类暂无素材</div>';
  }

  function selectMaterialItem(id) {
    materialSelectedId = id;
    renderMaterialList();
    const item = MATERIAL_LIBRARY.find((entry) => entry.id === id);
    const detail = $('#caMaterialDetail');
    if (!item || !detail) return;
    detail.innerHTML = `
      <div class="ca-hotspot-detail-head">
        <span class="ca-hotspot-cat">${escapeHtml(item.category)}</span>
        <h3>${escapeHtml(item.title)}</h3>
      </div>
      <div class="ca-hotspot-output">${item.render(item)}</div>
      <div class="ca-material-actions">
        <button class="ca-primary-btn" data-material-action="换皮">一键换皮</button>
        <button class="ca-secondary-btn" data-material-action="复制文案">复制文案</button>
        <button class="ca-secondary-btn" data-material-action="下载素材">下载素材</button>
      </div>`;
  }

  // ===== 模拟陪练场：AI 扮演客户，与销售进行沟通沙盘推演 =====
  const ROLEPLAY_PRESETS = [
    { id: 'p1', name: '挑剔的技术派', style: '挑剔质疑', focus: ['合规风险', '税务成本'], desc: '某科技公司创始人，A股上市公司实控人，逻辑严密、爱较真，会追问每个方案的法律依据和数据来源，不喜欢被"讲故事"。' },
    { id: 'p2', name: '犹豫的保守派', style: '犹豫谨慎', focus: ['隐私保密', '风险'], desc: '传统制造业二代，性格谨慎、怕担责，担心"折腾出问题"，倾向于拖延和再想想，需要被反复确认安全性。' },
    { id: 'p3', name: '强势的决策者', style: '强势主导', focus: ['收益回报', '控制权'], desc: '家族企业掌门人，习惯掌控全局、时间宝贵，说话直接、容易打断，只关心"这对我有什么用、多久见效"。' },
    { id: 'p4', name: '高冷的资源型', style: '冷淡疏离', focus: ['隐私保密', '身份规划'], desc: '低调的超高净值人士，见惯各类机构，态度疏离、话少，需要销售用专业和分寸感建立信任，不吃热情推销那一套。' },
    { id: 'p5', name: '热情但外行', style: '热情健谈', focus: ['传承安排', '子女教育'], desc: '新贵企业家，热情好聊但缺乏金融法税常识，容易被带偏话题，需要销售抓住主线、把专业问题讲成大白话。' }
  ];
  const ROLEPLAY_STYLES = ['挑剔质疑', '犹豫谨慎', '强势主导', '冷淡疏离', '热情健谈'];
  const ROLEPLAY_FOCUS = ['税务成本', '隐私保密', '收益回报', '控制权', '合规风险', '传承安排', '子女教育', '身份规划'];
  const ROLEPLAY_LEVELS = ['初级（配合度高）', '中级（有质疑）', '高级（强对抗）'];

  let roleplaySetup = { preset: '', profile: '', style: '挑剔质疑', focus: [], level: '中级（有质疑）', extra: '', marketing: '' };
  let roleplayMessages = []; // {role:'user'|'client'|'system', content}
  let roleplayBusy = false;

  // 陪练 session 持久化
  const ROLEPLAY_KEY = 'ca_roleplay_sessions_v1';
  let roleplaySessions = [];
  let activeRoleplayId = null;

  function loadRoleplaySessions() {
    try { roleplaySessions = JSON.parse(localStorage.getItem(ROLEPLAY_KEY) || '[]'); } catch (_) { roleplaySessions = []; }
    if (!Array.isArray(roleplaySessions)) roleplaySessions = [];
  }
  function persistRoleplaySessions() {
    try { localStorage.setItem(ROLEPLAY_KEY, JSON.stringify(roleplaySessions.slice(-40))); } catch (_) {}
  }
  function roleplayName() {
    const s = roleplaySetup;
    const presetName = s.preset ? (ROLEPLAY_PRESETS.find((p) => p.id === s.preset)?.name || '') : '';
    if (presetName) return presetName;
    if (s.profile) return s.profile.slice(0, 14);
    return `${s.style || '陪练'}客户`;
  }
  function saveCurrentRoleplay() {
    if (!activeRoleplayId) return;
    const s = roleplaySessions.find((x) => x.id === activeRoleplayId);
    if (!s) return;
    s.setup = { ...roleplaySetup };
    s.messages = roleplayMessages;
    s.name = roleplayName();
    s.updatedAt = new Date().toISOString();
    persistRoleplaySessions();
    renderRoleplaySessionList();
  }
  function renderRoleplaySessionList() {
    const list = $('#caRpSessionList');
    if (!list) return;
    const rows = [...roleplaySessions].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    list.innerHTML = rows.length ? rows.map((s) => {
      const rounds = (s.messages || []).filter((m) => m.role === 'user').length;
      const sub = `${s.setup?.style || ''}${s.setup?.level ? ` · ${String(s.setup.level).replace(/（.*/, '')}` : ''} · ${rounds}轮`;
      return `<div class="ca-nav-row"><button class="ca-session-item ${s.id === activeRoleplayId ? 'active' : ''}" data-rp-session="${escapeHtml(s.id)}">
        <div class="ca-session-title">${escapeHtml(s.name || '陪练')}</div>
        <div class="ca-session-sub">${escapeHtml(sub)}</div>
      </button><button class="ca-icon-btn ca-rp-del" data-rp-del="${escapeHtml(s.id)}" title="删除">✕</button></div>`;
    }).join('') : '<div style="padding:14px 8px;color:#9aa4aa;font-size:12px;text-align:center">还没有陪练记录，点上方"新建陪练"开始。</div>';
  }

  function openRoleplay() {
    const modal = $('#caRoleplayModal');
    if (!modal) return;
    modal.hidden = false;
    renderRoleplaySetup();
  }
  function closeRoleplay() { const m = $('#caRoleplayModal'); if (m) m.hidden = true; }

  function enterRoleplayMode() {
    const app = $('#assistantApp');
    if (app) app.classList.add('roleplay-active');
    document.querySelectorAll('[data-stub]').forEach((b) => b.classList.toggle('nav-active', b.dataset.stub === '模拟陪练场'));
    renderRoleplaySessionList();
  }
  function exitRoleplayMode() {
    if (activeRoleplayId) saveCurrentRoleplay();
    const app = $('#assistantApp');
    if (app) app.classList.remove('roleplay-active');
    document.querySelectorAll('[data-stub]').forEach((b) => b.classList.remove('nav-active'));
    $('#caRoleplayReport').hidden = true;
    $('#caRpInputArea').hidden = false;
  }

  function switchRoleplaySession(id) {
    const s = roleplaySessions.find((x) => x.id === id);
    if (!s) return;
    activeRoleplayId = id;
    roleplaySetup = { preset: '', profile: '', style: '挑剔质疑', focus: [], level: '中级（有质疑）', extra: '', marketing: '', ...(s.setup || {}) };
    roleplayMessages = Array.isArray(s.messages) ? s.messages : [];
    enterRoleplayMode();
    const presetName = roleplaySetup.preset ? (ROLEPLAY_PRESETS.find((p) => p.id === roleplaySetup.preset)?.name || '') : '';
    $('#caRpSub').textContent = `AI 正在扮演${presetName ? `「${presetName}」类型的` : '设定的'}客户，以家办顾问身份与其面谈`;
    $('#caRoleplayReport').hidden = true;
    $('#caRpInputArea').hidden = false;
    renderRoleplayMessages();
    renderRoleplaySide();
    renderRoleplaySessionList();
    setTimeout(() => $('#caRoleplayInput')?.focus(), 50);
  }

  function deleteRoleplaySession(id) {
    if (!window.confirm('删除这条陪练记录？')) return;
    roleplaySessions = roleplaySessions.filter((x) => x.id !== id);
    persistRoleplaySessions();
    if (activeRoleplayId === id) {
      activeRoleplayId = null;
      const next = [...roleplaySessions].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      if (next) switchRoleplaySession(next.id);
      else { exitRoleplayMode(); openRoleplay(); }
    }
    renderRoleplaySessionList();
  }

  function renderRoleplaySetup() {
    const el = $('#caRoleplaySetup');
    if (!el) return;
    el.innerHTML = `
      <div class="ca-rp-section"><div class="ca-rp-label">① 选择客户类型（可作为起点，下面可再改）</div>
        <div class="ca-rp-presets">${ROLEPLAY_PRESETS.map((p) => `<button class="ca-rp-preset ${roleplaySetup.preset === p.id ? 'active' : ''}" data-rp-preset="${p.id}"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.style)}</span></button>`).join('')}</div>
      </div>
      <div class="ca-rp-section"><div class="ca-rp-label">② 客户画像（身份 / 行业 / 资产 / 诉求）</div>
        <textarea class="ca-rp-textarea" id="caRpProfile" rows="3" placeholder="例如：A股上市公司创始股东，持股已全流通，计划收购上游企业，希望融资成本低且不稀释控制权。">${escapeHtml(roleplaySetup.profile)}</textarea>
      </div>
      <div class="ca-rp-section"><div class="ca-rp-label">③ 交流风格（单选）</div>
        <div class="ca-rp-chips">${ROLEPLAY_STYLES.map((s) => `<button class="ca-rp-chip ${roleplaySetup.style === s ? 'active' : ''}" data-rp-style="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>
      </div>
      <div class="ca-rp-section"><div class="ca-rp-label">④ 关注重点（可多选）</div>
        <div class="ca-rp-chips">${ROLEPLAY_FOCUS.map((f) => `<button class="ca-rp-chip ${roleplaySetup.focus.includes(f) ? 'active' : ''}" data-rp-focus="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join('')}</div>
      </div>
      <div class="ca-rp-section"><div class="ca-rp-label">⑤ 难度</div>
        <div class="ca-rp-chips">${ROLEPLAY_LEVELS.map((l) => `<button class="ca-rp-chip ${roleplaySetup.level === l ? 'active' : ''}" data-rp-level="${escapeHtml(l)}">${escapeHtml(l)}</button>`).join('')}</div>
      </div>
      <div class="ca-rp-section"><div class="ca-rp-label">⑥ 营销目标（可选，本次面谈希望达成什么）</div>
        <textarea class="ca-rp-textarea" id="caRpMarketing" rows="2" placeholder="例如：让客户认可家族信托方案，并邀约与专家进行一对一深谈。">${escapeHtml(roleplaySetup.marketing)}</textarea>
      </div>
      <div class="ca-rp-section"><div class="ca-rp-label">⑦ 补充设定（可选）</div>
        <textarea class="ca-rp-textarea" id="caRpExtra" rows="2" placeholder="例如：客户今天心情不好、时间只有10分钟、曾被别的机构坑过…">${escapeHtml(roleplaySetup.extra)}</textarea>
      </div>
      <div class="ca-rp-start"><button class="ca-primary-btn" id="caRoleplayStart">开始陪练 ▶</button></div>`;
  }

  function roleplaySystemPrompt() {
    const s = roleplaySetup;
    return `你现在参加一场"客户经理沟通陪练"，你要扮演一位高净值客户（家族办公室/财富管理场景），陪练对象是一名客户经理（销售）。
【你要扮演的客户设定】
- 客户画像：${s.profile || '（未细化，请据类型自行合理设定）'}
- 交流风格：${s.style}
- 最关注：${s.focus.length ? s.focus.join('、') : '（未指定）'}
- 难度：${s.level}
- 补充设定：${s.extra || '无'}
【扮演规则】
1. 始终以这位客户的第一人称身份、语气、立场说话，带出这位客户特有的顾虑、质疑、情绪与关注点。
2. 难度决定你的对抗强度：初级=较配合、会顺着聊；中级=会提出疑问和顾虑；高级=会质疑、打断、施压、甚至泼冷水。
3. 只说客户会说的话，绝不跳出角色、不写旁白、不替客户经理说话、不给出教学点评或建议。
4. 回复简洁口语化，像真实对话，一般 1-4 句；不要长篇大论。
5. 客户经理表现好时可适度松动、透露更多信息；表现差（空泛、不专业、答非所问）时表现出不耐烦或不信任。
现在对话开始，由客户经理先开口。你只需在他说话后，以客户身份回应。`;
  }

  function roleplayFallbackReply() {
    const lines = {
      '挑剔质疑': '你这个说法有依据吗？具体是哪条规定、哪个数据支持的？别跟我讲故事。',
      '犹豫谨慎': '嗯…听起来是有点道理，但我还是有点担心会不会有风险，能不能再稳一点？',
      '强势主导': '直接说重点，这对我到底有什么用？多久能见效？别绕。',
      '冷淡疏离': '（沉默片刻）……你先说说，你们和别家有什么不一样。',
      '热情健谈': '哎这个有意思！不过你说的这些我不太懂，能不能给我讲得通俗点？'
    };
    return lines[roleplaySetup.style] || '你继续说，我听着。';
  }

  async function startRoleplay() {
    roleplaySetup.profile = $('#caRpProfile')?.value.trim() || roleplaySetup.profile;
    roleplaySetup.marketing = $('#caRpMarketing')?.value.trim() || '';
    roleplaySetup.extra = $('#caRpExtra')?.value.trim() || '';
    const s = roleplaySetup;
    const presetName = s.preset ? (ROLEPLAY_PRESETS.find((p) => p.id === s.preset)?.name || '') : '';
    roleplayMessages = [{ role: 'system', content: `陪练开始。我将扮演你设定的客户${presetName ? `（${presetName}，${s.style}，难度：${s.level}）` : `（${s.style}，难度：${s.level}）`}。请你以家办顾问身份开场，我会以客户身份回应。右侧可查看客户角色档案、陪练目标与策略提示。` }];
    // 新建一条持久化陪练 session
    activeRoleplayId = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    roleplaySessions.push({ id: activeRoleplayId, name: roleplayName(), setup: { ...roleplaySetup }, messages: roleplayMessages, report: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    persistRoleplaySessions();
    closeRoleplay();
    enterRoleplayMode();
    $('#caRpSub').textContent = `AI 正在扮演${presetName ? `「${presetName}」类型的` : '设定的'}客户，以家办顾问身份与其面谈`;
    $('#caRoleplayReport').hidden = true;
    $('#caRpInputArea').hidden = false;
    renderRoleplayMessages();
    renderRoleplaySide();
    renderRoleplaySessionList();
    setTimeout(() => $('#caRoleplayInput')?.focus(), 50);
  }

  function renderRoleplaySide() {
    const s = roleplaySetup;
    const presetName = s.preset ? (ROLEPLAY_PRESETS.find((p) => p.id === s.preset)?.name || '') : '';
    const field = (label, value) => `<div class="ca-insight-field"><b>${escapeHtml(label)}</b><span class="${value ? '' : 'empty'}">${escapeHtml(value || '未设定')}</span></div>`;
    const profileHtml = [
      field('客户类型', presetName),
      field('客户画像', s.profile),
      field('交流风格', s.style),
      field('关注重点', s.focus.join('、')),
      field('难度', s.level),
      field('营销目标', s.marketing)
    ].join('');
    const sideBox = $('#caRpRoleProfile');
    if (sideBox) sideBox.innerHTML = profileHtml;

    // 陪练目标（勾选清单）
    const goals = [];
    goals.push('用开放式提问挖掘客户真实需求');
    if (s.marketing) goals.push(`推进营销目标：${s.marketing}`);
    goals.push('避免陷入与其他机构的产品对比陷阱');
    goals.push('争取邀约客户与专家进行一对一面谈');
    const goalsBox = $('#caRpGoals');
    if (goalsBox) goalsBox.innerHTML = goals.map((g, i) => `<label class="ca-rp-goal"><input type="checkbox" data-rp-goal="${i}"><span>${escapeHtml(g)}</span></label>`).join('');

    // 策略提示
    const tipsBox = $('#caRpTips');
    if (tipsBox) {
      tipsBox.innerHTML = roleplayFallbackTips().map((t) => `<div class="ca-rp-tip">${escapeHtml(t)}</div>`).join('');
      generateRoleplayTips().then((tips) => {
        if (tips && tips.length && $('#caRpTips')) $('#caRpTips').innerHTML = tips.map((t) => `<div class="ca-rp-tip">${escapeHtml(t)}</div>`).join('');
      }).catch(() => {});
    }
  }

  function roleplayFallbackTips() {
    const s = roleplaySetup;
    const byStyle = {
      '挑剔质疑': '客户爱较真、重依据——先亮出专业与数据支撑，少用"我们很厉害"这类空话。',
      '犹豫谨慎': '客户怕风险——多用"稳妥、可控、分步走"的表述，主动帮他把担忧说出来再化解。',
      '强势主导': '客户时间宝贵、爱掌控——开场30秒说清价值与见效路径，让他觉得节奏在自己手里。',
      '冷淡疏离': '客户话少、重分寸——用专业和克制建立信任，别热情推销，多给他思考空间。',
      '热情健谈': '客户健谈但外行——抓住主线别被带偏，把专业问题讲成大白话。'
    };
    const tips = [byStyle[s.style] || '先共情、再切入，围绕客户最关注的点展开。'];
    if (s.focus.length) tips.push(`客户最关注「${s.focus.join('、')}」，尽量把话题往这几个点靠。`);
    if (s.marketing) tips.push(`本次营销目标：${s.marketing}——注意在合适时机自然推进，不要生硬推销。`);
    return tips;
  }

  async function generateRoleplayTips() {
    const s = roleplaySetup;
    try {
      const result = await callDeepSeekJSON([
        { role: 'system', content: '你是家办销售教练。根据客户设定，给客户经理 2-3 条简短、具体、可操作的沟通策略提示（每条不超过40字，直接给招式，不要空话）。只返回JSON：{"tips":["提示1","提示2"]}' },
        { role: 'user', content: `客户画像：${s.profile || '（按类型推断）'}\n交流风格：${s.style}\n关注重点：${s.focus.join('、') || '未指定'}\n难度：${s.level}\n营销目标：${s.marketing || '未指定'}` }
      ], 2);
      const tips = Array.isArray(result.tips) ? result.tips.map((t) => String(t).trim()).filter(Boolean) : [];
      return tips.length ? tips : null;
    } catch (_) { return null; }
  }

  async function saveRoleplayAsClient() {
    const s = roleplaySetup;
    if (!s.profile) { toast('请先在设定中填写客户画像，再保存为客户档案'); return; }
    try {
      const session = await createAndOpenSession();
      exitRoleplayMode();
      const input = $('#caInput');
      if (input) { input.value = s.profile; input.focus(); }
      toast('已新建客户会话并带入画像，点发送即可开始建档');
    } catch (error) {
      toast('保存为客户档案失败：' + error.message);
    }
  }

  function renderRoleplayMessages() {
    const box = $('#caRoleplayMessages');
    if (!box) return;
    box.innerHTML = roleplayMessages.map((m) => {
      if (m.role === 'system') return `<div class="ca-rp-sysmsg">${renderText(m.content)}</div>`;
      return m.role === 'user'
        ? `<div class="ca-rp-msg user"><div class="ca-rp-bubble">${renderText(m.content)}</div><div class="ca-rp-who">顾问</div></div>`
        : `<div class="ca-rp-msg client"><div class="ca-rp-who">客户</div><div class="ca-rp-bubble">${renderText(m.content)}</div></div>`;
    }).join('') + (roleplayBusy ? '<div class="ca-rp-msg client"><div class="ca-rp-who">客户</div><div class="ca-rp-bubble"><div class="ca-typing"><i></i><i></i><i></i></div></div></div>' : '');
    box.scrollTop = box.scrollHeight;
  }

  async function sendRoleplayMessage() {
    if (roleplayBusy) return;
    const input = $('#caRoleplayInput');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';
    roleplayMessages.push({ role: 'user', content: text });
    roleplayBusy = true;
    renderRoleplayMessages();
    try {
      const history = roleplayMessages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      const reply = await callDeepSeek([{ role: 'system', content: roleplaySystemPrompt() }, ...history], false, 2);
      roleplayMessages.push({ role: 'client', content: String(reply || '').trim() || roleplayFallbackReply() });
    } catch (error) {
      console.warn('陪练客户回复生成失败，使用本地兜底：', error.message);
      roleplayMessages.push({ role: 'client', content: roleplayFallbackReply() });
    } finally {
      roleplayBusy = false;
      renderRoleplayMessages();
      saveCurrentRoleplay();
    }
  }

  async function endRoleplay() {
    if (!roleplayMessages.some((m) => m.role === 'user')) { toast('还没开始对话，先聊几句再生成评估'); return; }
    const report = $('#caRoleplayReport');
    $('#caRpInputArea').hidden = true;
    report.hidden = false;
    report.innerHTML = '<div class="ca-hotspot-loading" style="padding:40px;text-align:center">正在生成能力评估报告…</div>';
    const transcript = roleplayMessages.map((m) => `${m.role === 'user' ? '客户经理' : '客户'}：${m.content}`).join('\n');
    let data = null;
    try {
      data = await callDeepSeekJSON([
        { role: 'system', content: '你是一名资深的家办销售培训师。请根据下面这段"客户经理 vs 客户"的陪练对话，客观评估客户经理的表现。只返回JSON：{"scores":{"专业度":0-100,"倾听与共情":0-100,"话术与表达":0-100,"应变与推进":0-100},"overall":0-100,"highlights":["亮点1","亮点2"],"improvements":["待改进1","待改进2"],"learning":["建议学习的内容1","内容2"]}。评分要基于对话实际表现，不吹捧、不苛责。' },
        { role: 'user', content: `客户设定：${roleplaySystemPrompt().slice(0, 400)}\n\n陪练对话记录：\n${transcript}` }
      ], 2);
    } catch (error) {
      console.warn('陪练评估生成失败，使用本地兜底：', error.message);
    }
    report.innerHTML = roleplayReportHtml(data);
    const cur = roleplaySessions.find((x) => x.id === activeRoleplayId);
    if (cur) { cur.report = data || null; persistRoleplaySessions(); }
  }

  function roleplayReportHtml(data) {
    const scores = data?.scores || {};
    const dims = ['专业度', '倾听与共情', '话术与表达', '应变与推进'];
    const overall = Number.isFinite(Number(data?.overall)) ? Math.round(Number(data.overall)) : null;
    const bar = (label, v) => {
      const val = Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : null;
      return `<div class="ca-rp-score"><div class="ca-rp-score-top"><span>${escapeHtml(label)}</span><b>${val === null ? '—' : val}</b></div><div class="ca-rp-score-bar"><i style="width:${val || 0}%"></i></div></div>`;
    };
    const list = (title, arr, cls) => arr && arr.length
      ? `<div class="ca-rp-listblock ${cls || ''}"><b>${escapeHtml(title)}</b><ul>${arr.map((x) => `<li>${escapeHtml(String(x))}</li>`).join('')}</ul></div>` : '';
    return `<div class="ca-rp-report-head"><h3>能力评估报告</h3>${overall === null ? '' : `<div class="ca-rp-overall">综合 <b>${overall}</b></div>`}</div>
      ${data ? `<div class="ca-rp-scores">${dims.map((d) => bar(d, scores[d])).join('')}</div>
      ${list('本轮亮点', data.highlights, 'good')}
      ${list('待改进', data.improvements, 'warn')}
      ${list('推荐学习', data.learning, 'learn')}`
      : '<div class="ca-rp-listblock warn"><b>评估暂不可用</b><ul><li>AI 评估未能生成（可能是 API 未配置或网络问题）。你可以回看上方对话自评：客户的顾虑是否被接住、专业依据是否讲清、有没有推进到下一步。</li></ul></div>'}
      <div class="ca-roleplay-toolbar"><button class="ca-secondary-btn" id="caRoleplayBackChat">← 返回对话</button><button class="ca-secondary-btn" id="caRoleplayRestart">重新设定再练</button><button class="ca-primary-btn" id="caRoleplayExitFromReport">退出陪练</button></div>`;
  }

  // ===== 法税百科：专业名词问答，背靠 AI + 本地词条兜底 =====
  const LEXICON_HOT = ['减持限制', '流通股', '弃籍税', 'CRS', 'CFC规则', '37号文', '家族信托', '股权代持', '对赌协议', 'ODI', 'VIE架构', '短线交易', '一致行动人', '受益所有人'];
  const LEXICON_FALLBACK = {
    减持限制: { oneLine: '上市公司特定股东在一定时期、一定比例内不得随意卖出股票的监管规则。', plain: '简单说，就是大股东、董监高这些"内部人"想卖自家股票，不能想卖多少就卖多少、想什么时候卖就什么时候卖——得按规矩来，卖之前还要提前打招呼（预披露），一段时间内能卖的数量也有上限。', professional: '依据证监会《上市公司股东减持股份管理办法》等规定，控股股东、实际控制人、董监高及特定股东的减持在预披露时限、集中竞价/大宗交易比例、窗口期等方面受限，违规减持将面临监管处罚。', points: ['大股东与董监高的减持比例、节奏均受限并需预披露', '存在窗口期与短线交易（6个月）限制', '违规减持可能被要求购回并处罚'], related: ['短线交易', '一致行动人', '流通股'] },
    流通股: { oneLine: '可以在二级市场自由买卖、不受限售约束的上市公司股份。', plain: '就是能在股市里随时买卖、变现的那部分股票。与之相对的是"限售股"——有锁定期、暂时不能卖的股票。全流通就是所有股份都解禁、都能自由交易了。', professional: '流通股指已上市且不受限售安排约束、可在证券交易所自由转让的股份；限售股在锁定期届满后转为流通股。全流通指公司股份已全部解除限售、可自由流通。', points: ['与限售股相对，锁定期满后转为流通', '流通规模影响股价稳定与减持空间', '大股东即便持有流通股，减持仍受减持新规约束'], related: ['减持限制', '限售股', '大宗交易'] },
    弃籍税: { oneLine: '个人放弃某国国籍/税籍时，就其资产潜在增值等视同实现并征收的一次性税负。', plain: '有些国家（典型是美国）规定：你要退出国籍或长期绿卡、"跟税务局说再见"的时候，会把你名下资产当作"已经卖掉"来算一笔账，该交的增值税一次性结清——相当于"离境结账"。', professional: '弃籍税（Expatriation Tax）针对满足一定资产或税负门槛的"covered expatriate"，在放弃国籍或长期居民身份时，就全球资产按视同处置（mark-to-market）计算未实现增值并征税，另有递延资产、赠与继承等特别规则。', points: ['以美国最为典型，触发有资产/税负门槛', '按"视同出售"计算全球资产未实现增值', '身份规划前需提前测算与安排'], related: ['CRS', '受益所有人', '身份规划'] }
  };
  let lexiconBusy = false;

  function openLexicon() {
    const modal = $('#caLexiconModal');
    if (!modal) return;
    modal.hidden = false;
    renderLexiconHot();
    const ans = $('#caLexiconAnswer');
    if (ans && !ans.dataset.loaded) ans.innerHTML = '<div class="ca-lexicon-empty">输入一个专业名词或问题，或点上方常用词开始查询。<br><small>回答会给出「白话版（讲给客户）」与「专业版（准确口径）」两种表述。</small></div>';
  }
  function closeLexicon() { const m = $('#caLexiconModal'); if (m) m.hidden = true; }

  function renderLexiconHot() {
    const row = $('#caLexiconHot');
    if (!row) return;
    row.innerHTML = '<span class="ca-lexicon-hot-label">常用词：</span>' + LEXICON_HOT.map((t) => `<button class="ca-lexicon-chip" data-lexicon-term="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
  }

  async function queryLexicon(term) {
    const q = String(term || '').trim();
    if (!q || lexiconBusy) return;
    const ans = $('#caLexiconAnswer');
    if (!ans) return;
    ans.dataset.loaded = '1';
    lexiconBusy = true;
    $('#caLexiconInput').value = q;
    ans.innerHTML = `<div class="ca-lexicon-loading"><div class="ca-typing"><i></i><i></i><i></i></div>正在查询「${escapeHtml(q)}」…</div>`;
    let data = null;
    try {
      data = await callDeepSeekJSON([
        { role: 'system', content: '你是"朝曦法税百科"知识助手，面向家族办公室客户经理，解答法律、税务、家办、股权架构、信托、资本市场、身份规划等领域的专业名词与问题。要求：①oneLine 用一句话给出准确定义；②plain 用给客户讲的通俗大白话解释，可打比方；③professional 给出准确、可直接对客的规范表述；④points 列 2-4 个实务关注要点；⑤related 列 2-4 个相关名词。基于中国法律法规与跨境实务常识作答，不确定处说明需专业核实，不编造具体条款号与精确数字。只返回JSON：{"term":"","oneLine":"","plain":"","professional":"","points":[],"related":[]}' },
        { role: 'user', content: `请解释：${q}` }
      ], 2);
    } catch (error) {
      console.warn('法税百科查询失败，尝试本地词条：', error.message);
    }
    if (!data || !data.plain) data = LEXICON_FALLBACK[q] ? { term: q, ...LEXICON_FALLBACK[q] } : null;
    lexiconBusy = false;
    ans.innerHTML = renderLexiconAnswer(q, data);
  }

  function renderLexiconAnswer(query, data) {
    if (!data) {
      return `<div class="ca-lexicon-card"><div class="ca-lexicon-term">${escapeHtml(query)}</div>
        <div class="ca-lexicon-empty">暂未从知识库获取到该词条的解释（AI 未配置或网络问题，且本地未收录）。<br><small>可先配置 API，或换一个更常见的名词试试。</small></div></div>`;
    }
    const block = (label, text, cls) => text ? `<div class="ca-lexicon-block ${cls || ''}"><b>${escapeHtml(label)}</b><p>${escapeHtml(text)}</p></div>` : '';
    const points = Array.isArray(data.points) && data.points.length
      ? `<div class="ca-lexicon-block"><b>实务关注要点</b><ul>${data.points.map((p) => `<li>${escapeHtml(String(p))}</li>`).join('')}</ul></div>` : '';
    const related = Array.isArray(data.related) && data.related.length
      ? `<div class="ca-lexicon-related"><span>相关名词：</span>${data.related.map((r) => `<button class="ca-lexicon-chip" data-lexicon-term="${escapeHtml(String(r))}">${escapeHtml(String(r))}</button>`).join('')}</div>` : '';
    return `<div class="ca-lexicon-card">
      <div class="ca-lexicon-term">${escapeHtml(data.term || query)}</div>
      ${data.oneLine ? `<div class="ca-lexicon-oneline">${escapeHtml(data.oneLine)}</div>` : ''}
      ${block('白话版（讲给客户）', data.plain, 'plain')}
      ${block('专业版（准确口径）', data.professional, 'pro')}
      ${points}
      ${related}
      <div class="ca-lexicon-note">内容由朝曦知识库/AI 生成，供内部参考；对客引用重要数字与条款前请做专业核实。</div>
    </div>`;
  }

  // ===== 个人成长看板：真实会话数据 + 模拟活跃/能力指标 =====
  function openGrowth() {
    const modal = $('#caGrowthModal');
    if (!modal) return;
    modal.hidden = false;
    renderGrowth();
  }
  function closeGrowth() { const m = $('#caGrowthModal'); if (m) m.hidden = true; }

  function computeGrowthStats() {
    const alive = (sessions || []).filter((s) => !s.archived);
    const painTally = {};
    let painCount = 0;
    let skuCount = 0;
    alive.forEach((s) => {
      (s.pains || []).forEach((p) => { painCount += 1; const bu = String(p.bu || '其他').trim() || '其他'; painTally[bu] = (painTally[bu] || 0) + 1; });
      skuCount += (s.skus || []).length;
    });
    const completed = alive.filter((s) => s.stage === 'SKU_READY').length;
    return { clients: alive.length, completed, painCount, skuCount, painTally };
  }

  function growthBarRow(label, value, max, suffix) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return `<div class="ca-growth-barrow"><div class="ca-growth-barlabel"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}${suffix || ''}</b></div><div class="ca-growth-bar"><i style="width:${pct}%"></i></div></div>`;
  }

  function renderGrowth() {
    const body = $('#caGrowthBody');
    if (!body) return;
    const st = computeGrowthStats();
    // 模拟数据（无真实埋点的指标）
    const aiCalls = 60 + st.painCount * 3 + st.skuCount * 2 + st.clients * 5;
    const adoptRate = Math.min(92, 55 + st.completed * 6);
    const drillCount = 8 + st.completed * 2;
    const materialUse = 12 + st.clients * 2;
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const activity = [4, 6, 3, 8, 7, 2, 5].map((n, i) => ({ day: '周' + days[i], n: n + (i % 2 ? st.clients : 0) }));
    const actMax = Math.max(...activity.map((a) => a.n), 1);
    const skills = [['法税专业度', 78], ['沟通与共情', 84], ['需求挖掘', 72], ['方案落地', 69], ['应变推进', 75]];
    const painMax = Math.max(...Object.values(st.painTally), 1);
    const painEntries = Object.entries(st.painTally).sort((a, b) => b[1] - a[1]);

    const kpis = [
      { label: '服务客户', value: st.clients, unit: '位', real: true },
      { label: '完成全流程', value: st.completed, unit: '位', real: true },
      { label: '确认痛点', value: st.painCount, unit: '个', real: true },
      { label: '推荐 SKU', value: st.skuCount, unit: '个', real: true },
      { label: 'AI 调用', value: aiCalls, unit: '次', real: false },
      { label: '话术采纳率', value: adoptRate, unit: '%', real: false }
    ];

    body.innerHTML = `
      <div class="ca-growth-kpis">${kpis.map((k) => `<div class="ca-growth-kpi"><div class="ca-growth-kpi-val">${escapeHtml(String(k.value))}<small>${escapeHtml(k.unit)}</small></div><div class="ca-growth-kpi-label">${escapeHtml(k.label)}${k.real ? '' : ' <em>模拟</em>'}</div></div>`).join('')}</div>
      <div class="ca-growth-grid">
        <div class="ca-growth-card">
          <div class="ca-growth-card-head">近 7 天使用活跃度 <em>模拟</em></div>
          <div class="ca-growth-activity">${activity.map((a) => `<div class="ca-growth-actbar" title="${escapeHtml(a.day)}：${a.n} 次"><i style="height:${Math.round(a.n / actMax * 100)}%"></i><span>${escapeHtml(a.day.slice(1))}</span></div>`).join('')}</div>
        </div>
        <div class="ca-growth-card">
          <div class="ca-growth-card-head">能力画像 <em>模拟 · 来自陪练评估</em></div>
          ${skills.map(([n, v]) => growthBarRow(n, v, 100, '')).join('')}
        </div>
        <div class="ca-growth-card">
          <div class="ca-growth-card-head">已解决痛点类型分布 <em>真实</em></div>
          ${painEntries.length ? painEntries.map(([bu, n]) => growthBarRow(bu, n, painMax, ' 个')).join('') : '<div class="ca-growth-empty">还没有确认的痛点，完成一次痛点确认后这里会有数据。</div>'}
        </div>
        <div class="ca-growth-card">
          <div class="ca-growth-card-head">工具使用 <em>部分模拟</em></div>
          ${growthBarRow('陪练练习', drillCount, Math.max(drillCount, materialUse, aiCalls / 4), ' 次')}
          ${growthBarRow('素材调用', materialUse, Math.max(drillCount, materialUse, aiCalls / 4), ' 次')}
          ${growthBarRow('法税百科查询', Math.round(aiCalls / 4), Math.max(drillCount, materialUse, aiCalls / 4), ' 次')}
        </div>
      </div>
      <div class="ca-growth-card">
        <div class="ca-growth-card-head">成长里程碑 <em>模拟</em></div>
        <ul class="ca-growth-timeline">
          <li><b>已解锁</b>完成首个客户全流程闭环（画像→痛点→SKU→SOP）</li>
          <li><b>已解锁</b>累计确认痛点 ${st.painCount} 个，覆盖 ${painEntries.length || 0} 个业务领域</li>
          <li><b>进行中</b>话术采纳率提升至 ${adoptRate}%，距"金牌顾问"还差 ${Math.max(0, 90 - adoptRate)} 个百分点</li>
          <li><b>待达成</b>完成 10 次高级难度陪练（当前 ${Math.min(drillCount, 10)}/10）</li>
        </ul>
      </div>
      <div class="ca-growth-card ca-growth-reco">
        <div class="ca-growth-card-head">推荐提升 <em>模拟</em></div>
        <ul>
          <li>方案落地维度偏弱，建议在「案例研究员」中精读 2 个跨境传承案例。</li>
          <li>近 7 天资本市场类痛点接触较少，可在「法税百科」补齐减持/质押相关知识。</li>
          <li>尝试用「热点借势工坊」每周产出 1 条朋友圈，提升客户触达频率。</li>
        </ul>
      </div>`;
  }

  function bindSidebarResize() {
    const handle = $('#caResizeHandle');
    const app = $('#assistantApp');
    if (!handle || !app) return;
    const stored = Number(localStorage.getItem('ca_sidebar_width'));
    if (stored >= 220 && stored <= 420) app.style.setProperty('--ca-sidebar-width', `${stored}px`);
    let dragging = false;
    handle.addEventListener('mousedown', (event) => {
      dragging = true;
      handle.classList.add('dragging');
      event.preventDefault();
    });
    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const width = Math.min(420, Math.max(220, event.clientX));
      app.style.setProperty('--ca-sidebar-width', `${width}px`);
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      const width = parseInt(getComputedStyle(app).getPropertyValue('--ca-sidebar-width'), 10);
      if (width) localStorage.setItem('ca_sidebar_width', String(width));
    });
  }

  function bindEvents() {
    bindSidebarResize();
    $('#assistantApp').addEventListener('click', (event) => {
      const stub = event.target.closest('[data-stub]');
      if (stub && stub.dataset.stub === '热点借势工坊') { openHotspotWorkshop(); return; }
      if (stub && stub.dataset.stub === '通用素材库') { openMaterialLibrary(); return; }
      if (stub && stub.dataset.stub === '模拟陪练场') { openRoleplay(); return; }
      if (stub && stub.dataset.stub === '法税百科') { openLexicon(); return; }
      if (stub && stub.dataset.stub === '个人成长看板') { openGrowth(); return; }
      if (stub) toast(`「${stub.dataset.stub}」即将上线，敬请期待`);
    });
    $('#caGrowthClose').addEventListener('click', closeGrowth);
    $('#caGrowthModal').addEventListener('click', (event) => {
      if (event.target.id === 'caGrowthModal') closeGrowth();
    });
    $('#caInsightFollowup').addEventListener('click', (event) => {
      if (event.target.closest('#caFollowupAdd')) { addCustomFollowup(); return; }
      const btn = event.target.closest('[data-fu-act]');
      if (!btn) return;
      const item = btn.closest('[data-fu-id]');
      if (item) handleFollowupAction(item.dataset.fuId, btn.dataset.fuAct);
    });
    $('#caLexiconClose').addEventListener('click', closeLexicon);
    $('#caLexiconModal').addEventListener('click', (event) => {
      if (event.target.id === 'caLexiconModal') { closeLexicon(); return; }
      const chip = event.target.closest('[data-lexicon-term]');
      if (chip) { queryLexicon(chip.dataset.lexiconTerm); return; }
      if (event.target.closest('#caLexiconSearch')) queryLexicon($('#caLexiconInput')?.value);
    });
    $('#caLexiconInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); queryLexicon(event.target.value); }
    });
    $('#caRoleplayClose').addEventListener('click', closeRoleplay);
    // 设定弹窗：只处理设定项
    $('#caRoleplayModal').addEventListener('click', (event) => {
      if (event.target.id === 'caRoleplayModal') closeRoleplay();
      const t = event.target;
      const preset = t.closest('[data-rp-preset]');
      if (preset) {
        const p = ROLEPLAY_PRESETS.find((x) => x.id === preset.dataset.rpPreset);
        if (p) { roleplaySetup.preset = p.id; roleplaySetup.style = p.style; roleplaySetup.focus = [...p.focus]; if (!roleplaySetup.profile) roleplaySetup.profile = p.desc; }
        renderRoleplaySetup(); return;
      }
      const style = t.closest('[data-rp-style]');
      if (style) { roleplaySetup.style = style.dataset.rpStyle; renderRoleplaySetup(); return; }
      const focus = t.closest('[data-rp-focus]');
      if (focus) { const f = focus.dataset.rpFocus; roleplaySetup.focus = roleplaySetup.focus.includes(f) ? roleplaySetup.focus.filter((x) => x !== f) : [...roleplaySetup.focus, f]; renderRoleplaySetup(); return; }
      const level = t.closest('[data-rp-level]');
      if (level) { roleplaySetup.level = level.dataset.rpLevel; renderRoleplaySetup(); return; }
      if (t.closest('#caRoleplayStart')) {
        roleplaySetup.profile = $('#caRoleplaySetup #caRpProfile')?.value.trim() || roleplaySetup.profile;
        startRoleplay();
      }
    });
    // 陪练对话区（中部主面板）与右侧信息区
    $('#caRpMainPanel').addEventListener('click', (event) => {
      const t = event.target;
      if (t.closest('#caRoleplaySend')) { sendRoleplayMessage(); return; }
      if (t.closest('#caRpReportBtn')) { endRoleplay(); return; }
      if (t.closest('#caRpExit')) { exitRoleplayMode(); return; }
      if (t.closest('#caRpMobileMenu')) { $('#assistantApp').classList.toggle('sidebar-open'); return; }
      if (t.closest('#caRoleplayBackChat')) { $('#caRoleplayReport').hidden = true; $('#caRpInputArea').hidden = false; setTimeout(() => $('#caRoleplayInput')?.focus(), 50); return; }
      if (t.closest('#caRoleplayRestart')) { exitRoleplayMode(); openRoleplay(); return; }
      if (t.closest('#caRoleplayExitFromReport')) { exitRoleplayMode(); return; }
    });
    $('#caRpMainPanel').addEventListener('keydown', (event) => {
      if (event.target.id === 'caRoleplayInput' && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendRoleplayMessage(); }
    });
    $('#caRoleplayInput').addEventListener('input', (event) => {
      event.target.style.height = 'auto';
      event.target.style.height = `${Math.min(event.target.scrollHeight, 130)}px`;
    });
    $('#caRpSaveClient').addEventListener('click', saveRoleplayAsClient);
    $('#caRpNewSession').addEventListener('click', openRoleplay);
    $('#caRpBackToClient')?.addEventListener('click', () => exitRoleplayMode());
    $('#caRpSessionList').addEventListener('click', (event) => {
      const del = event.target.closest('[data-rp-del]');
      if (del) { event.stopPropagation(); deleteRoleplaySession(del.dataset.rpDel); return; }
      const sess = event.target.closest('[data-rp-session]');
      if (sess) switchRoleplaySession(sess.dataset.rpSession);
    });
    $('#caHotspotClose').addEventListener('click', closeHotspotWorkshop);
    $('#caHotspotModal').addEventListener('click', (event) => {
      if (event.target.id === 'caHotspotModal') closeHotspotWorkshop();
    });
    $('#caMaterialClose').addEventListener('click', closeMaterialLibrary);
    $('#caMaterialModal').addEventListener('click', (event) => {
      if (event.target.id === 'caMaterialModal') closeMaterialLibrary();
    });
    $('#caMaterialFilters').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-material-filter]');
      if (!tab) return;
      materialFilter = tab.dataset.materialFilter;
      renderMaterialFilters();
      renderMaterialList();
      const first = MATERIAL_LIBRARY.find((item) => materialFilter === '全部' || item.category === materialFilter);
      if (first) selectMaterialItem(first.id);
    });
    $('#caMaterialList').addEventListener('click', (event) => {
      const item = event.target.closest('[data-material-id]');
      if (item) selectMaterialItem(item.dataset.materialId);
    });
    $('#caMaterialDetail').addEventListener('click', (event) => {
      const act = event.target.closest('[data-material-action]');
      if (act) toast(`「${act.dataset.materialAction}」为模拟演示，实际功能开发中`);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#caHotspotModal')?.hidden) closeHotspotWorkshop();
      if (event.key === 'Escape' && !$('#caMaterialModal')?.hidden) closeMaterialLibrary();
      if (event.key === 'Escape' && !$('#caRoleplayModal')?.hidden) closeRoleplay();
      if (event.key === 'Escape' && !$('#caLexiconModal')?.hidden) closeLexicon();
      if (event.key === 'Escape' && !$('#caGrowthModal')?.hidden) closeGrowth();
    });
    $('#caHotspotFilters').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-hotspot-filter]');
      if (!tab) return;
      hotspotFilter = tab.dataset.hotspotFilter;
      renderHotspotFilters();
      renderHotspotList();
    });
    $('#caHotspotList').addEventListener('click', (event) => {
      const item = event.target.closest('[data-hotspot-id]');
      if (item) selectHotspotItem(item.dataset.hotspotId);
    });
    $('#caHotspotDetail').addEventListener('click', (event) => {
      const regen = event.target.closest('[data-hotspot-regen]');
      if (regen) selectHotspotItem(regen.dataset.hotspotRegen);
    });
    $('#caNewSession').addEventListener('click', createAndOpenSession);
    $('#caSessionSearch').addEventListener('input', renderSessionList);
    $('#caToggleArchived').addEventListener('click', () => {
      showingArchived = !showingArchived;
      $('#caListLabel').textContent = showingArchived ? '已归档' : '最近对话';
      $('#caToggleArchived').textContent = showingArchived ? '返回' : '归档';
      renderSessionList();
    });
    $('#caSend').addEventListener('click', () => sendCurrentInput());
    $('#caInput').addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#caSlashMenu').hidden) {
        hideSlashMenu();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!$('#caSlashMenu').hidden) {
          const first = $('#caSlashMenu').querySelector('[data-slash-cmd]');
          if (first) selectSlashSkill(first.dataset.slashCmd);
          return;
        }
        sendCurrentInput();
      }
    });
    $('#caInput').addEventListener('input', (event) => {
      event.target.style.height = 'auto';
      event.target.style.height = `${Math.min(event.target.scrollHeight, 130)}px`;
      updateSlashMenu(event.target.value);
    });
    $('#caSlashMenu').addEventListener('click', (event) => {
      const item = event.target.closest('[data-slash-cmd]');
      if (item) selectSlashSkill(item.dataset.slashCmd);
    });
    document.addEventListener('click', (event) => {
      if (!$('#caSlashMenu').hidden && !event.target.closest('.ca-input-wrap')) hideSlashMenu();
    });
    $('#caRenameSession').addEventListener('click', renameActiveSession);
    $('#caArchiveSession').addEventListener('click', archiveActiveSession);
    $('#caDeleteSession').addEventListener('click', deleteActiveSession);
    $('#caAdvancedTools').addEventListener('click', showLegacyTools);
    $('#caApiSettings').addEventListener('click', openSettings);
    $('#caTopSettings').addEventListener('click', openSettings);
    $('#caExportBackup').addEventListener('click', exportBackup);
    $('#caImportBackup').addEventListener('click', () => $('#caImportFile').click());
    $('#caImportFile').addEventListener('change', importBackup);
    $('#caExportConversation')?.addEventListener('click', () => {
      const session = getActiveSession();
      if (session) exportConversation(session.id);
      else toast('请先选择一条对话');
    });
    $('#caImportConversation')?.addEventListener('click', () => $('#caImportConvFile').click());
    $('#caImportConvFile')?.addEventListener('change', importConversation);
    $('#caMobileMenu').addEventListener('click', () => $('#assistantApp').classList.toggle('sidebar-open'));
    $('#caQuickRow').addEventListener('click', (event) => {
      const button = event.target.closest('[data-quick]');
      if (!button) return;
      const action = button.dataset.quick;
      if (action === 'advanced') showLegacyTools();
      else if (action === 'rationale') showRecommendationRationale();
      else if (action === 'skip-profile') forceEnterPainConfirmation();
      else if (action === 'sop') focusSkillResult('sop');
      else if (action === 'supplier') focusSkillResult('supplier');
      else if (action === 'clientplan') focusSkillResult('clientplan');
      else sendText(button.dataset.text || button.textContent.trim());
    });
    $('#caMessages').addEventListener('click', (event) => {
      const del = event.target.closest('[data-del-msg]');
      if (del) { deleteMessageById(del.dataset.delMsg); return; }
      const submit = event.target.closest('[data-guided-submit]');
      if (submit) {
        submitGuidedAnswer(submit.closest('[data-guided-card]'));
        return;
      }
      const button = event.target.closest('[data-client-package-message-id]');
      if (!button) return;
      const message = activeMessages.find((item) => item.id === button.dataset.clientPackageMessageId);
      if (message) openClientImagePackage(message);
    });
    $('#caMessages').addEventListener('change', (event) => {
      if (event.target.matches('[data-guided-option]')) handleGuidedOptionChange(event.target.closest('[data-guided-card]'), event.target);
    });
    $('#caMessages').addEventListener('input', (event) => {
      if (event.target.matches('[data-guided-other]')) persistGuidedDraft(event.target.closest('[data-guided-card]'));
    });
  }

  function openSettings() {
    if (typeof openApiConfigModal === 'function') openApiConfigModal();
    else toast('API 设置暂不可用');
  }

  function stageInfo(session) {
    if (!session) return { label: '未选择客户', progress: 0, warn: false };
    switch (session.stage) {
      case 'PAIN_CONFIRMATION':
        return { label: `痛点确认 ${session.flow.painStep}/5`, progress: session.flow.painStep * 10, warn: true };
      case 'PAIN_READY':
        return { label: '痛点已确认', progress: 50, warn: false };
      case 'SKU_CONFIRMATION':
        return { label: `SKU 匹配 ${session.flow.skuStep}/5`, progress: 50 + session.flow.skuStep * 10, warn: true };
      case 'SKU_READY':
        return { label: '建议已就绪', progress: 100, warn: false };
      case 'REFRESH_NEEDED':
        return { label: `建议刷新 ${session.flow.refreshStep}/2`, progress: 100, warn: true };
      default:
        return { label: '随心聊', progress: 0, warn: false };
    }
  }

  function renderHeader() {
    const session = getActiveSession();
    if (!session) return;
    const info = stageInfo(session);
    $('#caClientTitle').firstChild.textContent = `${session.name} `;
    $('#caStageBadge').textContent = info.label;
    $('#caStageBadge').classList.toggle('warn', info.warn);
    $('#caProgressBar').style.width = `${info.progress}%`;
    $('#caClientSub').textContent = session.archived
      ? '该客户已归档，仍可继续查看和恢复'
      : session.nameLocked
        ? '演示模板 · 全员统一查看，名称与内容由后台维护，本地改动刷新后自动还原'
        : '聊天、客户画像、痛点与 SKU 推荐将自动保存在本机';
    // 演示模板不提供改名入口
    const renameBtn = $('#caRenameSession');
    if (renameBtn) renameBtn.hidden = !!session.nameLocked;
    $('#caArchiveSession').textContent = session.archived ? '取消归档' : '归档';
  }

  function renderSessionList() {
    const list = $('#caSessionList');
    if (!list) return;
    const query = ($('#caSessionSearch')?.value || '').trim().toLowerCase();
    const rows = sessions
      .filter((item) => item.archived === showingArchived)
      .filter((item) => !query || item.name.toLowerCase().includes(query) || profileSummary(item).toLowerCase().includes(query))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    list.innerHTML = rows.length ? rows.map((session) => {
      const profileBits = [session.profile.industry.value, session.profile.events.value].filter(Boolean).join(' · ');
      return `<div class="ca-nav-row">
        <input type="checkbox" class="ca-nav-checkbox" data-nav-checkbox>
        <button class="ca-session-item ${session.id === activeSessionId ? 'active' : ''}" data-session-id="${escapeHtml(session.id)}">
          <div class="ca-session-title">${escapeHtml(session.name)}</div>
          <div class="ca-session-sub">${escapeHtml(profileBits || stageInfo(session).label)}</div>
        </button>
      </div>`;
    }).join('') : '<div style="padding:18px 8px;color:#9aa4aa;font-size:12px;text-align:center">暂无客户</div>';
    list.querySelectorAll('[data-session-id]').forEach((button) => {
      button.addEventListener('click', () => switchSession(button.dataset.sessionId));
    });
  }

  function profileSummary(session) {
    return PROFILE_KEYS.map((key) => `${PROFILE_LABELS[key]}：${session.profile[key]?.value || '待确认'}`).join('；');
  }

  function profileSnapshot(session) {
    return PROFILE_KEYS.reduce((acc, key) => {
      acc[key] = { ...session.profile[key] };
      return acc;
    }, {});
  }

  function profileCardHtml(profile) {
    return `<div class="ca-profile-card">
      <div class="ca-card-head"><h3>动态客户画像</h3><span>自动保存 · 新信息会持续更新</span></div>
      <div class="ca-profile-grid">${PROFILE_KEYS.map((key) => {
        const value = profile?.[key]?.value || '';
        return `<div class="ca-profile-field ${value ? '' : 'empty'}"><b>${PROFILE_LABELS[key]}<small>${PROFILE_HINTS[key]}</small></b><span>${escapeHtml(value || '待确认')}</span></div>`;
      }).join('')}</div>
    </div>`;
  }

  function painCardHtml(message) {
    const items = Array.isArray(message.data?.items) ? message.data.items : [];
    const suggestions = Array.isArray(message.data?.newPainSuggestions) ? message.data.newPainSuggestions : [];
    return `<div class="ca-rec-card">
      <div class="ca-card-head"><h3>已确认的优先痛点</h3><span>版本 ${escapeHtml(message.data?.version || 1)} · 痛点库已同步痛点</span></div>
      ${items.map((item, index) => `<div class="ca-rec-item">
        <div class="ca-rec-title"><strong>${index + 1}. ${escapeHtml(item.title)}</strong><span class="ca-rec-code">${escapeHtml(item.code)}</span><span class="ca-rec-source">${item.matchPercent === null ? escapeHtml(item.bu || '') : `综合匹配度 ${item.matchPercent}%`}</span></div>
        <div class="ca-rec-reason">${escapeHtml(item.reason || '与当前客户画像和五问答案高度相关')}</div>
        <div class="ca-rec-grid">
          <div class="ca-rec-note"><b>核心冲突</b><br>${escapeHtml(item.conflict || '待进一步确认')}</div>
          <div class="ca-rec-note warn"><b>潜在风险</b><br>${escapeHtml(item.risk || '待进一步确认')}</div>
        </div>
        ${item.hitTags?.length ? `<div class="ca-rec-note"><b>命中标签/因子</b><br>${escapeHtml(item.hitTags.join('、'))}</div>` : ''}
        ${item.matchPercent !== null ? `<div class="ca-rec-note"><b>匹配依据</b><br>标签命中 ${item.tagScore ?? '-'}% · 语义相似 ${item.semanticScore ?? '-'}% · 核心冲突匹配 ${item.conflictScore ?? '-'}%</div>` : ''}
      </div>`).join('')}
      ${suggestions.length ? `<div class="ca-rec-item ca-rec-newpain">
        <div class="ca-rec-title"><strong>痛点新增建议</strong></div>
        <div class="ca-rec-reason">您的客户遇到的问题与库内痛点匹配度均低于80%，建议联系产品中心新增如下痛点：</div>
        ${suggestions.map((item) => `<div class="ca-rec-grid">
          <div class="ca-rec-note"><b>痛点描述</b><br>${escapeHtml(item.description)}</div>
          <div class="ca-rec-note"><b>核心冲突</b><br>${escapeHtml(item.conflict)}</div>
          <div class="ca-rec-note warn"><b>潜在风险</b><br>${escapeHtml(item.risk)}</div>
          <div class="ca-rec-note"><b>解决方案</b><br>${escapeHtml(item.solution)}</div>
          <div class="ca-rec-note"><b>预期效果</b><br>${escapeHtml(item.effect)}</div>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  }

  function skuCardHtml(message) {
    const items = Array.isArray(message.data?.items) ? message.data.items : [];
    const cardHtml = `<div class="ca-rec-card">
      <div class="ca-card-head"><h3>SKU 适配建议</h3><span>版本 ${escapeHtml(message.data?.version || 1)} · 15 SKU 宽表专项样本</span></div>
      ${message.data?.noFit ? '<div class="ca-rec-item"><div class="ca-rec-reason">当前测试样本池暂无适格 SKU。请补充关键事实或扩大样本池后重新评估。</div></div>' : ''}
      ${items.map((item, index) => `<div class="ca-rec-item">
        <div class="ca-rec-title"><strong>${index + 1}. ${escapeHtml(item.name)}</strong><span class="ca-rec-code">${escapeHtml(item.number)}</span><span class="ca-rec-source">${escapeHtml(item.fit || '建议核验')}</span></div>
        <div class="ca-rec-reason">${escapeHtml(item.reason || item.definition || '')}</div>
        <div class="ca-rec-grid">
          <div class="ca-rec-note"><b>必备前置条件</b><br>${escapeHtml(item.prerequisite || '请结合客户实际情况核验')}</div>
          <div class="ca-rec-note warn"><b>不适用场景 / 风险</b><br>${escapeHtml(item.risk || '请进行专业合规复核')}</div>
        </div>
        <div class="ca-rec-note"><b>候选来源</b><br>${escapeHtml(item.origin || '综合匹配')}</div>
        ${item.questionEvidence?.length ? `<div class="ca-rec-note"><b>五问关键证据</b><br>${escapeHtml(item.questionEvidence.join('；'))}</div>` : ''}
        ${item.related ? `<div class="ca-rec-note"><b>辅助 SKU / 关联组合</b><br>${escapeHtml(item.related)}</div>` : ''}
      </div>`).join('')}
    </div>`;

    const actionHtml = items.length && !message.data?.noFit
      ? `<div class="ca-client-image-action"><button class="ca-primary-btn ca-generate-client-image" data-client-package-message-id="${escapeHtml(message.id)}">生成客户方案网页</button><span>把入选 SKU、落地 SOP 与供应商协作整理为可管理有效状态的客户链接</span></div>`
      : '';
    return cardHtml.replace(/<\/div>$/, `${actionHtml}</div>`);
  }

  function latestGuidedQuestionId() {
    return [...activeMessages].reverse().find((message) => message.type === 'guided-question' && !message.data?.question?.answeredAt)?.id || '';
  }

  function guidedQuestionHtml(message) {
    const question = message.data?.question || {};
    const options = Array.isArray(question.options) ? question.options : [];
    const selected = new Set(question.draftOptionIds || question.selectedOptionIds || []);
    const answered = Boolean(question.answeredAt);
    const active = !answered && message.id === latestGuidedQuestionId();
    const otherSelected = options.some((option) => option.requiresText && selected.has(option.id));
    const optionHtml = options.map((option, index) => `<label class="ca-guided-option ${selected.has(option.id) ? 'selected' : ''} ${answered ? 'readonly' : ''}">
      <input type="checkbox" data-guided-option value="${escapeHtml(option.id)}" ${selected.has(option.id) ? 'checked' : ''} ${active ? '' : 'disabled'}>
      <span class="ca-guided-letter">${String.fromCharCode(65 + index)}</span>
      <span><b>${escapeHtml(option.requiresText ? OTHER_OPTION_LABEL : option.label)}</b>${option.hint ? `<small>${escapeHtml(option.hint)}</small>` : ''}</span>
    </label>`).join('');
    const sourceIds = Array.isArray(question.sourceIds) ? question.sourceIds : [];
    const sourceText = (question.sources || []).map((source) => source.rawQuestion || source.question).filter(Boolean).join('\n');
    const evidence = sourceText || question.originalQuestion;
    return `<div class="ca-message assistant"><div class="ca-avatar">朝</div><div class="ca-message-body ca-guided-message">
      ${message.content ? `<div class="ca-bubble ca-guided-intro">${renderText(message.content)}</div>` : ''}
      <div class="ca-guided-card" data-guided-card data-message-id="${escapeHtml(message.id)}">
        <div class="ca-guided-head"><span>${escapeHtml(question.stage === 'SKU_CONFIRMATION' ? `SKU 适配 ${question.step}/5` : `痛点确认 ${question.step}/5`)}</span><em>${answered ? '已提交' : '可多选'}</em></div>
        <h4>${escapeHtml(question.displayQuestion || '请选择符合客户实际情况的描述')}</h4>
        <div class="ca-guided-options">${optionHtml}</div>
        <div class="ca-guided-other ${otherSelected ? 'show' : ''}"><textarea data-guided-other rows="2" placeholder="请在此填写您心目中的答案…" ${active ? '' : 'disabled'}>${escapeHtml(question.otherText || '')}</textarea></div>
        ${answered ? `<div class="ca-guided-summary"><b>已选择：</b>${escapeHtml(question.answerSummary || '')}</div>` : `<button class="ca-primary-btn ca-guided-submit" data-guided-submit disabled>确认提交</button>`}
        ${(evidence || sourceIds.length) ? `<details class="ca-guided-source"><summary>查看问题依据${sourceIds.length ? ` · ${escapeHtml(sourceIds.join(' + '))}` : ''}</summary>${evidence ? `<p>${escapeHtml(evidence)}</p>` : ''}</details>` : ''}
      </div>
      <div class="ca-message-meta">${escapeHtml(formatTime(message.createdAt))}</div>
    </div></div>`;
  }

  function recommendationRationaleHtml(message) {
    const data = message.data || {};
    const profile = Array.isArray(data.profile) ? data.profile : [];
    const painAnswers = Array.isArray(data.painAnswers) ? data.painAnswers : [];
    const skuAnswers = Array.isArray(data.skuAnswers) ? data.skuAnswers : [];
    const pains = Array.isArray(data.pains) ? data.pains : [];
    const skus = Array.isArray(data.skus) ? data.skus : [];
    const rows = (items, render) => items.length ? items.map(render).join('') : '<li class="ca-rationale-empty">该项暂无已保存证据</li>';
    return `<div class="ca-message assistant"><div class="ca-avatar">朝</div><div class="ca-message-body ca-rationale-message">
      <div class="ca-rationale-card" id="caRationale-${escapeHtml(data.version || 1)}">
        <div class="ca-card-head"><h3>为什么这样判断</h3><span>版本 ${escapeHtml(data.version || 1)} · 基于已保存证据</span></div>
        <p class="ca-rationale-lead">推荐路径由客户画像、两阶段五问、痛点匹配和 SKU 宽表条件共同形成。</p>
        <details open><summary>1. 客户画像事实</summary><ul>${rows(profile, (item) => `<li><b>${escapeHtml(item.label)}</b>：${escapeHtml(item.value)}</li>`)}</ul></details>
        <details open><summary>2. 痛点确认依据</summary><ul>${rows(painAnswers, (item) => `<li><b>第 ${escapeHtml(item.step)} 问</b>：${escapeHtml(item.answer)}</li>`)}</ul><div class="ca-rationale-tags">${pains.map((item) => `<span>${escapeHtml(item.code)} · ${escapeHtml(item.title)}</span>`).join('')}</div></details>
        <details open><summary>3. SKU 五问证据</summary><ul>${rows(skuAnswers, (item) => `<li><b>第 ${escapeHtml(item.step)} 问</b>：${escapeHtml(item.answer)}${item.sourceIds?.length ? `<small>问题ID：${escapeHtml(item.sourceIds.join(' + '))}</small>` : ''}</li>`)}</ul></details>
        <details open><summary>4. SKU 适配与风险</summary>${skus.length ? skus.map((item) => `<article><h4>${escapeHtml(item.number)} · ${escapeHtml(item.name)}</h4><p><b>入选原因：</b>${escapeHtml(item.reason || '基于画像与五问证据')}</p><p><b>前置条件：</b>${escapeHtml(item.prerequisite || '待专业核验')}</p><p><b>风险/不适用：</b>${escapeHtml(item.risk || '待专业核验')}</p>${item.questionEvidence?.length ? `<p><b>关键证据：</b>${escapeHtml(item.questionEvidence.join('；'))}</p>` : ''}</article>`).join('') : '<p class="ca-rationale-empty">当前没有入选 SKU</p>'}</details>
        ${data.legacyLimited ? '<div class="ca-rationale-warning">历史会话的结构化选项记录有限，以上内容已使用原自然语言回答与现有推荐字段恢复。</div>' : ''}
      </div><div class="ca-message-meta">${escapeHtml(formatTime(message.createdAt))}</div>
    </div></div>`;
  }

  function messageHtml(message) {
    if (message.type === 'profile') return profileCardHtml(message.data?.profile || {});
    if (message.type === 'pain-recommendation') return painCardHtml(message);
    if (message.type === 'sku-recommendation') return skuCardHtml(message);
    if (message.type === 'sku-sop') return skuSopCardHtml(message);
    if (message.type === 'sku-supplier') return supplierCardHtml(message);
    if (message.type === 'sku-supplier-summary') return supplierSummaryCardHtml(message);
    if (message.type === 'guided-question') return guidedQuestionHtml(message);
    if (message.type === 'recommendation-rationale') return recommendationRationaleHtml(message);
    const role = message.role === 'user' ? 'user' : message.role === 'system' ? 'system' : 'assistant';
    const errorClass = message.type === 'error' ? ' error' : '';
    const avatar = role === 'system' ? '' : `<div class="ca-avatar">${role === 'user' ? '销' : '朝'}</div>`;
    // 客户画像不再内嵌在对话流中（右侧「客户画像」面板已实时呈现）
    return `<div class="ca-message ${role}${errorClass}">${avatar}<div class="ca-message-body"><div class="ca-bubble">${renderText(message.content)}</div><div class="ca-message-meta">${escapeHtml(formatTime(message.createdAt))}</div></div></div>`;
  }

  // 删除单条对话消息（本地 + 服务器快照同步保存）
  async function deleteMessageById(messageId) {
    const message = activeMessages.find((item) => item.id === messageId);
    if (!message) return;
    const preview = (message.content || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const typeLabel = {
      'pain-recommendation': '痛点推荐卡片',
      'sku-recommendation': 'SKU 建议卡片',
      'sku-sop': '方案落地步骤表',
      'sku-supplier': '供应商协作清单（旧版）',
      'sku-supplier-summary': '供应商需配合事项表',
      'guided-question': '确认问题卡片',
      'recommendation-rationale': '判断依据卡片',
      profile: '客户画像卡片'
    }[message.type] || (preview ? `「${preview}${preview.length >= 30 ? '…' : ''}」` : '这条消息');
    if (!confirm(`确定删除${typeLabel}吗？此操作无法撤销。`)) return;
    const sessionId = message.sessionId;
    activeMessages = activeMessages.filter((item) => item.id !== messageId);
    renderMessages();
    try {
      await deleteRecordById('messages', messageId);
      scheduleServerSync(sessionId);
      toast('已删除并保存');
    } catch (error) {
      toast(`删除失败：${error.message}`);
    }
  }

  function renderMessages() {
    const container = $('#caMessages');
    if (!container) return;
    if (!activeMessages.length) {
      container.innerHTML = '<div class="ca-empty"><div><strong>开始一段客户对话</strong>生活近况、企业经营、家庭安排或财富需求都可以聊。</div></div>';
    } else {
      container.innerHTML = activeMessages.map((message) => `<div class="ca-msg-wrap">${messageHtml(message)}<button class="ca-msg-del" data-del-msg="${escapeHtml(message.id)}" title="删除这条">✕</button></div>`).join('');
    }
    renderQuickActions();
    refreshGuidedSubmitStates();
    renderInsights();
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  }

  const SLASH_SKILLS = [
    { cmd: '需求挖掘', desc: '识别客户信息，梳理画像、痛点与 SKU 推荐', ready: true },
    { cmd: '痛点分析', desc: '定位并展示当前客户的优先痛点', ready: true, action: 'pain' },
    { cmd: 'SKU建议', desc: '展示当前客户的适格 SKU 推荐', ready: true, action: 'sku' },
    { cmd: '方案落地步骤', desc: '以表格展示一级阶段/二级步骤/客户需配合事项', ready: true, action: 'sop' },
    { cmd: '供应商建议', desc: '以表格展示供应商需配合事项（类别/阶段/角色/事项）', ready: true, action: 'supplier' },
    { cmd: '客户网页版方案', desc: 'SKU图文+落地步骤+供应商表集成为一个可编辑HTML', ready: true, action: 'clientplan' },
    { cmd: '面谈纪要', desc: '整理本次面谈的关键信息（即将上线）', ready: false },
    { cmd: '方案解读', desc: '解读已生成方案的要点（即将上线）', ready: false },
    { cmd: '话术建议', desc: '生成面向客户的沟通话术（即将上线）', ready: false }
  ];

  function updateSlashMenu(value) {
    const menu = $('#caSlashMenu');
    if (!menu) return;
    const match = /^\/(\S*)$/.exec(value || '');
    if (!match) {
      hideSlashMenu();
      return;
    }
    const filter = match[1].toLowerCase();
    const items = SLASH_SKILLS.filter((skill) => skill.cmd.toLowerCase().includes(filter));
    if (!items.length) {
      hideSlashMenu();
      return;
    }
    menu.innerHTML = items.map((skill) => `<button class="ca-slash-item" data-slash-cmd="${escapeHtml(skill.cmd)}">
      <span class="ca-slash-cmd">/${escapeHtml(skill.cmd)}</span>
      <span class="ca-slash-desc">${escapeHtml(skill.desc)}</span>
      ${skill.ready ? '' : '<span class="ca-slash-soon">即将上线</span>'}
    </button>`).join('');
    menu.hidden = false;
  }

  function hideSlashMenu() {
    const menu = $('#caSlashMenu');
    if (menu) menu.hidden = true;
  }

  function selectSlashSkill(cmd) {
    const skill = SLASH_SKILLS.find((item) => item.cmd === cmd);
    hideSlashMenu();
    const input = $('#caInput');
    input.value = '';
    input.style.height = 'auto';
    input.focus({ preventScroll: true });
    if (!skill || !skill.ready) { toast(`「${cmd}」即将上线，敬请期待`); return; }
    if (skill.action) focusSkillResult(skill.action);
  }

  function scrollFlash(target) {
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('ca-flash');
    setTimeout(() => target.classList.remove('ca-flash'), 1600);
  }

  async function focusSkillResult(action) {
    const session = getActiveSession();
    if (!session) { toast('请先选择或新建一个客户对话'); return; }
    if (action === 'clientplan') { await generateClientPlanPage(session); return; }
    const key = action;
    const finders = {
      pain: () => [...document.querySelectorAll('#caMessages .ca-rec-card')].reverse().find((el) => /痛点/.test(el.querySelector('.ca-card-head h3')?.textContent || '')),
      sku: () => [...document.querySelectorAll('#caMessages .ca-rec-card')].reverse().find((el) => /SKU/.test(el.querySelector('.ca-card-head h3')?.textContent || '')),
      sop: () => [...document.querySelectorAll('#caMessages .ca-sop-card:not(.ca-supplier-card):not(.ca-supsum-card)')].pop(),
      supplier: () => [...document.querySelectorAll('#caMessages .ca-supsum-card')].pop()
    };
    const existing = finders[key]?.();
    if (existing) { scrollFlash(existing); return; }
    // SOP / 供应商总结表 可按需即时生成（只要已有适格 SKU）
    if ((key === 'sop' || key === 'supplier') && Array.isArray(session.skus) && session.skus.length) {
      if (key === 'sop') await presentSkuSop(session);
      else await presentSuppliers(session);
      await saveSession(session);
      scrollFlash(finders[key]());
      return;
    }
    const guidance = {
      pain: '当前还没有生成痛点分析。请先补充客户画像并完成痛点确认五问。',
      sku: '当前还没有生成 SKU 建议。请先完成痛点确认与 SKU 适配五问。',
      sop: '当前还没有适格 SKU，无法生成方案落地步骤。请先完成 SKU 适配。',
      supplier: '当前还没有适格 SKU，无法生成供应商协作。请先完成 SKU 适配。'
    };
    toast(guidance[action] || '该结果尚未生成');
  }

  function renderInsights() {
    const profileEl = $('#caInsightProfile');
    const painsEl = $('#caInsightPains');
    const followupEl = $('#caInsightFollowup');
    if (!profileEl || !painsEl || !followupEl) return;
    const session = getActiveSession();
    if (!session) {
      profileEl.innerHTML = '<p class="ca-insight-empty">暂无客户会话</p>';
      painsEl.innerHTML = '<p class="ca-insight-empty">暂无数据</p>';
      renderFollowups();
      return;
    }
    profileEl.innerHTML = PROFILE_KEYS.map((key) => {
      const value = session.profile[key]?.value || '';
      return `<div class="ca-insight-field"><b>${escapeHtml(PROFILE_LABELS[key])}</b><span class="${value ? '' : 'empty'}">${escapeHtml(value || '待确认')}</span></div>`;
    }).join('');

    const painsHtml = session.pains?.length
      ? `<div class="ca-insight-sub"><b>痛点解析</b>${session.pains.slice(0, 3).map((item) => `<p>${escapeHtml(item.code)}·${escapeHtml(item.title)}</p>`).join('')}</div>`
      : '<div class="ca-insight-sub"><b>痛点解析</b><p class="ca-insight-empty">尚未确认痛点</p></div>';
    const skusHtml = session.skus?.length
      ? `<div class="ca-insight-sub"><b>方案解读</b>${session.skus.slice(0, 3).map((item) => `<p>${escapeHtml(item.number)}·${escapeHtml(item.name)}</p>`).join('')}</div>`
      : '<div class="ca-insight-sub"><b>方案解读</b><p class="ca-insight-empty">尚未生成 SKU 建议</p></div>';
    const oppHtml = session.searchTerms?.length
      ? `<div class="ca-insight-sub"><b>潜在业务机会</b><p>${session.searchTerms.slice(0, 8).map((term) => escapeHtml(term)).join('、')}</p></div>`
      : '<div class="ca-insight-sub"><b>潜在业务机会</b><p class="ca-insight-empty">暂无线索</p></div>';
    painsEl.innerHTML = painsHtml + skusHtml + oppHtml;

    renderFollowups();
  }

  // ===== 跟进助手：从所有客户会话中提取跟进日程，支持编辑/完成/忽略/新增 =====
  const FOLLOWUP_KEY = 'ca_followups_v1';
  const STAGE_CN = { CASUAL: '初步接触', PROFILE_GATHERING: '画像补充中', PAIN_CONFIRMATION: '痛点确认中', SKU_CONFIRMATION: 'SKU适配中', SKU_READY: '方案已就绪', REFRESH_NEEDED: '需刷新方案' };
  const STAGE_WEIGHT = { SKU_READY: 5, REFRESH_NEEDED: 4, SKU_CONFIRMATION: 3, PAIN_CONFIRMATION: 3, PROFILE_GATHERING: 2, CASUAL: 1 };

  function loadFollowups() {
    try { return JSON.parse(localStorage.getItem(FOLLOWUP_KEY) || '{}'); } catch (_) { return {}; }
  }
  function saveFollowups(data) {
    try { localStorage.setItem(FOLLOWUP_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function autoFollowupAction(stage) {
    switch (stage) {
      case 'SKU_READY': return '方案已就绪，建议约客户当面讲解并推进落地';
      case 'REFRESH_NEEDED': return '客户情况有变，建议重新核验痛点与方案';
      case 'SKU_CONFIRMATION': return '正在做 SKU 适配，建议尽快完成五问确认';
      case 'PAIN_CONFIRMATION': return '正在确认痛点，建议补齐信息推进到方案';
      case 'PROFILE_GATHERING': return '客户画像未补齐，建议继续了解并完善建档';
      default: return '初步接触，建议深入了解客户情况并开始建档';
    }
  }

  function buildFollowups() {
    const store = loadFollowups();
    const overrides = store.overrides || {};
    const items = [];
    (sessions || []).filter((s) => !s.archived).forEach((s) => {
      const ov = overrides[s.id] || {};
      if (ov.status === 'done' || ov.status === 'dismissed') return;
      const last = s.updatedAt ? new Date(s.updatedAt) : null;
      const days = last ? Math.max(0, Math.floor((Date.now() - last.getTime()) / 86400000)) : null;
      const action = ov.action || autoFollowupAction(s.stage);
      const urgency = (STAGE_WEIGHT[s.stage] || 1) * 10 + (days || 0);
      items.push({ id: `s:${s.id}`, sessionId: s.id, name: s.name || '未命名客户', stage: STAGE_CN[s.stage] || '', days, action, urgency, edited: !!ov.action, custom: false });
    });
    (store.custom || []).filter((c) => c.status !== 'done' && c.status !== 'dismissed').forEach((c) => {
      items.push({ id: `c:${c.id}`, sessionId: null, name: c.name || '自定义提醒', stage: '', days: null, action: c.text, urgency: 100, edited: true, custom: true });
    });
    items.sort((a, b) => b.urgency - a.urgency);
    return items;
  }

  function renderFollowups() {
    const el = $('#caInsightFollowup');
    if (!el) return;
    const items = buildFollowups();
    const rows = items.length ? items.map((it) => {
      const meta = it.custom ? '自定义' : (it.days === null ? it.stage : `${it.stage}${it.days > 0 ? ` · ${it.days}天未跟进` : ' · 今日已互动'}`);
      const hot = it.urgency >= 50 ? ' hot' : '';
      return `<div class="ca-fu-item${hot}" data-fu-id="${escapeHtml(it.id)}">
        <div class="ca-fu-top"><span class="ca-fu-name">${escapeHtml(it.name)}</span><span class="ca-fu-meta">${escapeHtml(meta)}</span></div>
        <div class="ca-fu-action">${escapeHtml(it.action)}</div>
        <div class="ca-fu-btns"><button data-fu-act="done" title="标记完成">✓</button><button data-fu-act="edit" title="修改">✎</button><button data-fu-act="dismiss" title="忽略">✕</button></div>
      </div>`;
    }).join('') : '<p class="ca-insight-empty">暂无待跟进客户。新建客户或与客户互动后，这里会自动生成跟进提醒。</p>';
    el.innerHTML = `<div class="ca-fu-list">${rows}</div><button class="ca-fu-add" id="caFollowupAdd">＋ 添加跟进事项</button>`;
  }

  function handleFollowupAction(id, act) {
    const store = loadFollowups();
    store.overrides = store.overrides || {};
    store.custom = store.custom || [];
    const isCustom = id.startsWith('c:');
    const rawId = id.slice(2);
    if (act === 'edit') {
      const current = buildFollowups().find((x) => x.id === id);
      const next = window.prompt('修改跟进事项', current ? current.action : '');
      if (next === null) return;
      const val = next.trim();
      if (!val) return;
      if (isCustom) { const c = store.custom.find((x) => x.id === rawId); if (c) c.text = val; }
      else { store.overrides[rawId] = { ...(store.overrides[rawId] || {}), action: val }; }
    } else if (act === 'done' || act === 'dismiss') {
      const status = act === 'dismiss' ? 'dismissed' : 'done';
      if (isCustom) { const c = store.custom.find((x) => x.id === rawId); if (c) c.status = status; }
      else { store.overrides[rawId] = { ...(store.overrides[rawId] || {}), status }; }
    }
    saveFollowups(store);
    renderFollowups();
  }

  function addCustomFollowup() {
    const text = window.prompt('新增跟进事项（例如：给王总发年度税务盘点资料）');
    if (!text || !text.trim()) return;
    const store = loadFollowups();
    store.custom = store.custom || [];
    store.custom.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '自定义提醒', text: text.trim(), status: 'pending' });
    saveFollowups(store);
    renderFollowups();
  }

  function renderQuickActions() {
    const row = $('#caQuickRow');
    const session = getActiveSession();
    if (!row || !session) return;
    let buttons = [];
    if (session.stage === 'PAIN_CONFIRMATION' || session.stage === 'SKU_CONFIRMATION') {
      buttons = [];
    } else if (session.stage === 'REFRESH_NEEDED') {
      buttons = [
        ['暂不清楚', '暂不清楚'],
        ['跳过此题', '跳过此题']
      ];
    } else if (session.stage === 'SKU_READY') {
      buttons = [
        ['为什么这样判断', 'rationale'],
        ['方案落地步骤', 'sop'],
        ['供应商配合事项', 'supplier'],
        ['客户网页版方案', 'clientplan'],
        ['继续补充画像', '我想继续补充这位客户的画像信息'],
        ['生成详细方案', 'advanced']
      ];
    } else if (session.stage === 'PROFILE_GATHERING') {
      buttons = [
        ['画像已经够了，直接进入痛点确认', 'skip-profile']
      ];
    } else {
      buttons = [
        ['补充客户情况', '我想补充一位客户的情况'],
        ['查看画像', '请总结一下当前已了解的客户画像']
      ];
    }
    row.innerHTML = buttons.map(([label, value]) => ['advanced', 'rationale', 'skip-profile', 'sop', 'supplier', 'clientplan'].includes(value)
      ? `<button class="ca-chip" data-quick="${value}">${escapeHtml(label)}</button>`
      : `<button class="ca-chip" data-quick="send" data-text="${escapeHtml(value)}">${escapeHtml(label)}</button>`
    ).join('');
  }

  function optionRecord(id, label, semanticValue, hint = '', extra = {}) {
    return { id, label, semanticValue, hint, exclusive: false, requiresText: false, ...extra };
  }

  async function generateGuidedOptionsWithAI(questionText, stage, sourceRecord = null) {
    const sources = sourceRecord?.sources?.length ? sourceRecord.sources : [{ question: questionText }];
    const result = await callDeepSeekJSON([
      {
        role: 'system',
        content: '你是朝曦家办确认问题选项生成器。你会收到一个已经问出的问题及其原始来源事实。请把该问题里已经包含的事实分支拆解、压缩或组合成2到3个简短的业务选项，供销售一键勾选来回答这个问题。不得增加原问题中不存在的法律结论、产品条件或客户事实，不得引入新的数字或时间点。label控制在16字以内，semantic_value是一句完整、可直接作为客户回答使用的陈述句。只返回JSON：{"options":[{"label":"...","semantic_value":"...","hint":"可选的补充说明"}]}'
      },
      {
        role: 'user',
        content: `阶段：${stage}\n当前问题：${questionText}\n原始来源事实：${JSON.stringify(sources.map((item) => item.question || item.text).filter(Boolean))}`
      }
    ], 2);
    const options = Array.isArray(result.options) ? result.options : [];
    if (options.length < 2 || options.length > 3) throw new Error('AI选项数量不符合要求');
    const business = options.map((item) => [
      String(item.label || '').trim(),
      String(item.semantic_value || item.semanticValue || '').trim(),
      String(item.hint || '').trim()
    ]);
    if (business.some((item) => !item[0] || !item[1] || item[0].length > 20)) throw new Error('AI选项内容不完整');
    if (business.some((item) => !claimSupportedBySources(item[1], sources))) throw new Error('AI选项超出原问题事实范围');
    return business;
  }

  function guidedOptionTemplates(questionText, stage, sourceRecord = null) {
    const text = `${sourceRecord?.directionKey || ''} ${questionText || ''}`;
    let business = [];
    if (/代持|实际权属|工商登记|股东名册|还原/.test(text)) {
      business = [
        ['关系清晰，可配合还原', '代持协议、实际出资和收益归属清晰，代持人愿意配合还原'],
        ['协议基本完整，仍需整改', '代持关系基本清晰，但协议、登记或还原手续仍需完善'],
        ['存在障碍或配合风险', '代持关系、合法性或代持人配合方面存在明显障碍']
      ];
    } else if (/诉讼|纠纷|出资|权属|担保|资金占用|债务|质押|冻结/.test(text)) {
      business = [
        ['不存在上述重大风险', '不存在重大诉讼、股权纠纷、出资权属瑕疵、对外担保、资金占用或重大债务风险'],
        ['存在诉讼或股权纠纷', '存在诉讼、股权纠纷、质押冻结或历史沿革不清等事项'],
        ['存在担保、债务或资金问题', '存在对外担保、重大债务、资金占用或重大事项变更风险']
      ];
    } else if (/上市|IPO|辅导|申报|板块|信息披露|改制/.test(text)) {
      business = [
        ['路径和时间表已明确', '目标上市板块、申报时间和辅导准备计划已经明确'],
        ['目标明确，仍在整改准备', '上市目标基本明确，但股权、财务或合规事项仍在整改'],
        ['上市路径尚未明确', '上市板块、时间表或辅导准备路径尚未形成明确方案']
      ];
    } else if (/传承|接班|子女|继承|遗嘱|控制权/.test(text)) {
      business = [
        ['接班目标和人选明确', '企业控制权传承目标、接班人和基本时间安排已经明确'],
        ['有方向，仍需协调安排', '已有传承方向，但家族意见、治理安排或工具组合仍需确认'],
        ['尚未形成接班共识', '接班人、控制权安排或家族内部意见尚未形成共识']
      ];
    } else if (/婚姻|配偶|家庭|家族/.test(text)) {
      business = [
        ['家庭意见一致且稳定', '配偶及关键家庭成员支持，婚姻和家庭关系目前稳定'],
        ['基本支持，仍需沟通', '家庭成员总体支持，但部分安排仍需进一步沟通确认'],
        ['存在分歧或潜在冲突', '配偶或关键家庭成员存在分歧、婚姻变化或潜在冲突']
      ];
    } else if (/税务|税收|申报|跨境|境外/.test(text)) {
      business = [
        ['税务身份和申报清晰', '客户税务居民身份、申报义务和主要税务安排已经明确'],
        ['部分明确，仍需专项核查', '已掌握部分税务信息，但跨境申报或交易税负仍需核查'],
        ['存在不确定或合规风险', '税务身份、历史申报或跨境合规方面存在不确定性']
      ];
    } else if (/时间|期限|何时|窗口|紧迫/.test(text)) {
      business = [
        ['6个月内需要推进', '客户希望在六个月内启动或完成关键步骤'],
        ['6–24个月内推进', '客户计划在六个月至两年内分阶段推进'],
        ['两年以上或暂无期限', '客户时间安排在两年以上，或暂时没有明确期限']
      ];
    } else if (/资产|股权|资金|房产|不动产|有什么/.test(text)) {
      business = [
        ['以企业股权为主', '相关资产主要是企业股权或实际控制权'],
        ['涉及现金、金融或保险资产', '相关资产包括现金、金融产品、保险或可投资资金'],
        ['涉及房产、跨境或复杂结构', '相关资产包括不动产、境外资产、信托或其他复杂结构']
      ];
    } else if (/角色|主体|决策人|客户是谁/.test(text)) {
      business = [
        ['企业实控人或核心股东', '客户是企业实际控制人、创始人或核心股东'],
        ['家庭财富决策人', '客户是家庭主要财富持有人或最终决策人'],
        ['相关家族成员或受益人', '客户是配偶、子女、继承人、受益人或其他相关家族成员']
      ];
    } else if (stage === 'PAIN_CONFIRMATION') {
      business = [
        ['核心目标已经明确', '客户的核心目标、优先事项和理想结果已经明确'],
        ['方向明确，细节待确认', '客户已有大致方向，但资产、时间或执行细节仍需确认'],
        ['存在明显分歧或约束', '客户安排受到家庭意见、控制权、资金或合规条件限制']
      ];
    } else {
      business = [
        ['已满足或基本完成', '原问题涉及的主要条件已经满足或基本完成'],
        ['部分满足，仍需完善', '原问题涉及的条件部分满足，仍有事项需要补充或整改'],
        ['不满足或存在障碍', '原问题涉及的条件不满足，或存在明显实施障碍']
      ];
    }
    return business;
  }

  function guidedDisplayQuestion(questionText, stage, sourceRecord = null) {
    if (stage === 'SKU_CONFIRMATION' && sourceRecord?.directionKey) {
      return `关于“${sourceRecord.directionKey}”，目前哪些描述符合客户实际情况？`;
    }
    const clean = String(questionText || '').replace(/\n+问题ID：[\s\S]*$/i, '').trim();
    if (clean.length <= 82) return clean;
    if (/主体|角色|决策人|客户是谁/.test(clean)) return '这位客户在本次安排中主要是什么角色？';
    if (/资产|股权|资金|房产|不动产/.test(clean)) return '本次安排主要涉及哪些资产或权益？';
    if (/时间|期限|何时|窗口|紧迫/.test(clean)) return '客户希望在什么时间范围内推进？';
    if (/法律|税务|监管|家庭|控制权|约束/.test(clean)) return '当前有哪些条件可能影响方案推进？';
    return '目前哪些描述最符合客户的实际情况？';
  }

  async function createGuidedQuestion(stage, step, questionText, sourceRecord = null) {
    const id = `guided-${stage.toLowerCase()}-${step}-${Date.now()}`;
    let business;
    try {
      business = await generateGuidedOptionsWithAI(questionText, stage, sourceRecord);
    } catch (error) {
      console.warn('选项动态生成失败，使用本地模板：', error.message);
      business = guidedOptionTemplates(questionText, stage, sourceRecord);
    }
    const options = business.slice(0, 3).map((item, index) => optionRecord(`${id}-${index + 1}`, item[0], item[1], item[2] || ''));
    options.push(optionRecord(`${id}-unknown`, '不清楚，需要核查', '当前信息不清楚，需要进一步核查', '', { exclusive: true }));
    options.push(optionRecord(`${id}-other`, OTHER_OPTION_LABEL, '存在其他需要补充的客户事实', '', { requiresText: true }));
    return {
      id,
      stage,
      step,
      displayQuestion: guidedDisplayQuestion(questionText, stage, sourceRecord),
      originalQuestion: String(questionText || '').replace(/\n+问题ID：[\s\S]*$/i, '').trim(),
      sourceIds: sourceRecord?.sourceIds || (stage === 'PAIN_CONFIRMATION' ? [`PAIN-Q${step}`] : []),
      sources: sourceRecord?.sources || [],
      directionKey: sourceRecord?.directionKey || '',
      options,
      draftOptionIds: [],
      otherText: '',
      createdAt: nowIso()
    };
  }

  async function addGuidedQuestion(session, stage, step, questionText, intro = '', sourceRecord = null, extraData = null) {
    const question = await createGuidedQuestion(stage, step, questionText, sourceRecord);
    return addMessage('assistant', intro, 'guided-question', { ...(extraData || {}), stage, step, question }, session.id);
  }

  function guidedMessageFromCard(card) {
    return activeMessages.find((message) => message.id === card?.dataset.messageId) || null;
  }

  async function ensureCurrentGuidedQuestion(session) {
    if (!session || !['PAIN_CONFIRMATION', 'SKU_CONFIRMATION'].includes(session.stage)) return;
    if (activeMessages.some((message) => message.type === 'guided-question' && !message.data?.question?.answeredAt)) return;
    const step = session.stage === 'SKU_CONFIRMATION' ? session.flow.skuStep : session.flow.painStep;
    const latestUserIndex = activeMessages.map((message) => message.role).lastIndexOf('user');
    const latestQuestionIndex = activeMessages
      .map((message) => message.role === 'assistant' && message.data?.stage === session.stage && Number(message.data?.step) === Number(step))
      .lastIndexOf(true);
    if (latestQuestionIndex >= 0 && latestUserIndex > latestQuestionIndex) return;
    const questionText = session.stage === 'SKU_CONFIRMATION'
      ? session.skuAnalysis?.lastQuestion?.displayQuestion
      : session.flow?.askedQuestions?.[session.flow.askedQuestions.length - 1];
    if (!questionText) return;
    await addGuidedQuestion(session, session.stage, step, questionText, '为了便于回答，当前问题已转换为快捷选项。', session.stage === 'SKU_CONFIRMATION' ? session.skuAnalysis.lastQuestion : null);
  }

  function refreshGuidedSubmitStates() {
    document.querySelectorAll('[data-guided-card]').forEach((card) => {
      const submit = card.querySelector('[data-guided-submit]');
      if (!submit) return;
      const checked = Array.from(card.querySelectorAll('[data-guided-option]:checked'));
      const other = checked.find((input) => guidedMessageFromCard(card)?.data?.question?.options?.find((option) => option.id === input.value)?.requiresText);
      const otherText = card.querySelector('[data-guided-other]')?.value.trim() || '';
      submit.disabled = busy || !checked.length || (other && !otherText);
    });
  }

  async function persistGuidedDraft(card) {
    const message = guidedMessageFromCard(card);
    if (!message?.data?.question || message.data.question.answeredAt) return;
    message.data.question.draftOptionIds = Array.from(card.querySelectorAll('[data-guided-option]:checked')).map((input) => input.value);
    message.data.question.otherText = card.querySelector('[data-guided-other]')?.value || '';
    await putRecord('messages', message);
    refreshGuidedSubmitStates();
  }

  function handleGuidedOptionChange(card, changedInput) {
    const message = guidedMessageFromCard(card);
    if (!message?.data?.question) return;
    const options = message.data.question.options || [];
    const changedOption = options.find((option) => option.id === changedInput.value);
    const inputs = Array.from(card.querySelectorAll('[data-guided-option]'));
    if (changedInput.checked && changedOption?.exclusive) {
      inputs.forEach((input) => { if (input !== changedInput) input.checked = false; });
    } else if (changedInput.checked) {
      inputs.forEach((input) => {
        const option = options.find((item) => item.id === input.value);
        if (option?.exclusive) input.checked = false;
      });
    }
    inputs.forEach((input) => input.closest('.ca-guided-option')?.classList.toggle('selected', input.checked));
    const otherSelected = inputs.some((input) => input.checked && options.find((item) => item.id === input.value)?.requiresText);
    card.querySelector('.ca-guided-other')?.classList.toggle('show', otherSelected);
    persistGuidedDraft(card);
  }

  async function submitGuidedAnswer(card) {
    if (busy || !card) return;
    const message = guidedMessageFromCard(card);
    const question = message?.data?.question;
    if (!question || question.answeredAt) return;
    const selectedIds = Array.from(card.querySelectorAll('[data-guided-option]:checked')).map((input) => input.value);
    const selectedOptions = question.options.filter((option) => selectedIds.includes(option.id));
    const otherText = card.querySelector('[data-guided-other]')?.value.trim() || '';
    if (!selectedOptions.length) return;
    if (selectedOptions.some((option) => option.requiresText) && !otherText) {
      card.querySelector('[data-guided-other]')?.focus({ preventScroll: true });
      toast('请先填写您心目中的答案再提交');
      return;
    }
    const semanticValues = selectedOptions.filter((option) => !option.requiresText).map((option) => option.semanticValue);
    if (otherText) semanticValues.push(`补充说明：${otherText}`);
    const answerSummary = semanticValues.join('；');
    question.selectedOptionIds = selectedIds;
    question.draftOptionIds = selectedIds;
    question.otherText = otherText;
    question.answerSummary = answerSummary;
    question.answeredAt = nowIso();
    await putRecord('messages', message);
    renderMessages();
    await sendText(answerSummary, {
      guidedAnswer: {
        questionId: question.id,
        stage: question.stage,
        step: question.step,
        sourceIds: question.sourceIds,
        selectedOptionIds: selectedIds,
        selectedLabels: selectedOptions.map((option) => option.label),
        otherText,
        originalQuestion: question.originalQuestion
      }
    });
  }

  function legacyPainAnswerPairs() {
    const result = [];
    activeMessages.forEach((message, index) => {
      if (message.role !== 'assistant' || message.data?.stage !== 'PAIN_CONFIRMATION' || !message.data?.step) return;
      const answer = activeMessages.slice(index + 1).find((item) => item.role === 'user');
      if (answer) result.push({ step: message.data.step, answer: answer.content });
    });
    return result.slice(0, 5);
  }

  function buildRecommendationRationale(session) {
    const structured = activeMessages.filter((message) => message.role === 'user' && message.data?.guidedAnswer);
    const painAnswers = structured.filter((message) => message.data.guidedAnswer.stage === 'PAIN_CONFIRMATION')
      .map((message) => ({ step: message.data.guidedAnswer.step, answer: message.content }));
    const skuAnswers = structured.filter((message) => message.data.guidedAnswer.stage === 'SKU_CONFIRMATION')
      .map((message) => ({ step: message.data.guidedAnswer.step, answer: message.content, sourceIds: message.data.guidedAnswer.sourceIds || [] }));
    const storedSkuAnswers = (session.skuAnalysis?.answers || []).map((item) => ({ step: item.step, answer: item.answer, sourceIds: item.sourceIds || [] }));
    return {
      version: session.recommendationVersion || 1,
      profile: PROFILE_KEYS.filter((key) => session.profile[key]?.value).map((key) => ({ label: PROFILE_LABELS[key], value: session.profile[key].value })),
      painAnswers: painAnswers.length ? painAnswers : legacyPainAnswerPairs(),
      skuAnswers: skuAnswers.length ? skuAnswers : storedSkuAnswers,
      pains: session.pains || [],
      skus: session.skus || [],
      legacyLimited: structured.length === 0,
      generatedAt: nowIso()
    };
  }

  async function showRecommendationRationale() {
    const session = getActiveSession();
    if (!session || session.stage !== 'SKU_READY') return;
    const version = session.recommendationVersion || 1;
    const existing = activeMessages.find((message) => message.type === 'recommendation-rationale' && Number(message.data?.version || 1) === Number(version));
    if (!existing) {
      await addMessage('assistant', '', 'recommendation-rationale', buildRecommendationRationale(session), session.id);
    } else {
      const target = document.getElementById(`caRationale-${version}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function forceEnterPainConfirmation() {
    const session = getActiveSession();
    if (!session || session.stage !== 'PROFILE_GATHERING' || busy) return;
    setBusy(true);
    try {
      await enterPainConfirmation(session, '', null, '好的，我们直接开始痛点确认五问。');
      await saveSession(session);
    } finally {
      setBusy(false);
    }
  }

  function setBusy(value) {
    busy = value;
    $('#caSend').disabled = value;
    $('#caInput').disabled = value;
    if (value) showTyping();
    else removeTyping();
    refreshGuidedSubmitStates();
  }

  function showTyping() {
    const container = $('#caMessages');
    if (!container || $('#caTyping')) return;
    const div = document.createElement('div');
    div.id = 'caTyping';
    div.className = 'ca-message assistant';
    div.innerHTML = '<div class="ca-avatar">朝</div><div class="ca-message-body"><div class="ca-bubble"><div class="ca-typing"><i></i><i></i><i></i></div></div></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    $('#caTyping')?.remove();
  }

  function toast(text) {
    const el = $('#caToast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function normalizeSkuLookupValue(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function loadSkuLongImageManifest() {
    if (!skuLongImageManifestPromise) {
      skuLongImageManifestPromise = fetch(SKU_LONG_IMAGE_MANIFEST, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`SKU 长图清单读取失败（${response.status}）`);
          return response.json();
        })
        .then((manifest) => {
          if (!Array.isArray(manifest.items) || !manifest.items.length) throw new Error('SKU 长图清单为空');
          return manifest;
        })
        .catch((error) => {
          skuLongImageManifestPromise = null;
          throw error;
        });
    }
    return skuLongImageManifestPromise;
  }

  function findSkuLongImageItem(catalog, number, name) {
    const numberKey = normalizeSkuLookupValue(number);
    const nameKey = normalizeSkuLookupValue(name);
    const exactNumber = catalog.find((item) => normalizeSkuLookupValue(item.sku_id) === numberKey);
    if (exactNumber) return exactNumber;
    return catalog.find((item) => {
      const values = [item.sku_name, ...(item.aliases || [])].map(normalizeSkuLookupValue).filter(Boolean);
      return values.some((value) => value === nameKey || (nameKey.length >= 5 && (value.includes(nameKey) || nameKey.includes(value))));
    }) || null;
  }

  function resolveSkuLongImageSelection(message, manifest) {
    const recommendations = Array.isArray(message.data?.items) ? message.data.items : [];
    const selections = [];
    const missing = [];
    const selectedIds = new Set();
    recommendations.forEach((recommendation) => {
      const match = findSkuLongImageItem(manifest.items, recommendation.number, recommendation.name);
      if (!match) {
        missing.push(`${recommendation.number || ''} ${recommendation.name || ''}`.trim());
        return;
      }
      const key = normalizeSkuLookupValue(match.sku_id);
      if (!selectedIds.has(key)) {
        selectedIds.add(key);
        selections.push({ role: 'main', item: match, recommendation });
      }
    });
    recommendations.forEach((recommendation) => {
      const related = normalizeSkuLookupValue(recommendation.related);
      if (!related) return;
      manifest.items.forEach((candidate) => {
        const candidateKeys = [candidate.sku_id, candidate.sku_name, ...(candidate.aliases || [])]
          .map(normalizeSkuLookupValue)
          .filter((value) => value.length >= 4);
        const isExplicitlyMentioned = candidateKeys.some((value) => related.includes(value));
        const key = normalizeSkuLookupValue(candidate.sku_id);
        if (isExplicitlyMentioned && !selectedIds.has(key)) {
          selectedIds.add(key);
          selections.push({ role: 'auxiliary', item: candidate, recommendation });
        }
      });
    });
    return { selections, missing };
  }

  function loadCanvasImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`图片读取失败：${src}`));
      image.src = src;
    });
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const chars = Array.from(String(text || ''));
    let line = '';
    let lines = 0;
    for (const char of chars) {
      const candidate = line + char;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        lines += 1;
        line = char;
        if (lines >= maxLines) return y + lines * lineHeight;
      } else {
        line = candidate;
      }
    }
    if (line && lines < maxLines) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
    }
    return y + lines * lineHeight;
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('客户长图编码失败')), 'image/png');
    });
  }

  function safeDownloadName(value) {
    return String(value || '未命名客户').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 50) || '未命名客户';
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function revokeClientImagePackage(packageData) {
    (packageData?.files || []).forEach((file) => URL.revokeObjectURL(file.url));
  }

  async function buildClientImagePackage(message, session) {
    const manifest = await loadSkuLongImageManifest();
    const resolved = resolveSkuLongImageSelection(message, manifest);
    if (!resolved.selections.length) throw new Error('当前推荐 SKU 尚未配置可用 PPT 长图');

    const preparedSelections = [];
    for (const selection of resolved.selections) {
      const chunks = await Promise.all(selection.item.chunks.map(async (chunk) => ({
        ...chunk,
        image: await loadCanvasImage(`sku_long_images/${chunk.file}`)
      })));
      preparedSelections.push({ ...selection, chunks });
    }

    const dateText = new Date().toLocaleDateString('zh-CN');
    const units = [{
      height: 300,
      draw(ctx, y) {
        ctx.fillStyle = '#0b4166';
        ctx.fillRect(0, y, CLIENT_IMAGE_WIDTH, 300);
        ctx.fillStyle = '#c9aa75';
        ctx.fillRect(58, y + 48, 86, 6);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 48px "Microsoft YaHei", sans-serif';
        ctx.fillText('客户方案参考', 58, y + 126);
        ctx.font = '400 25px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#d9e7ef';
        drawWrappedText(ctx, session.name || '未命名客户', 58, y + 178, 760, 36, 2);
        ctx.font = '400 20px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#b9cfdb';
        ctx.fillText(`${dateText} · ${preparedSelections.length} 个 SKU 资料`, 58, y + 258);
      }
    }];

    preparedSelections.forEach((selection) => {
      selection.chunks.forEach((chunk, chunkIndex) => {
        const headerHeight = chunkIndex === 0 ? 160 : 104;
        units.push({
          height: headerHeight + chunk.image.height,
          draw(ctx, y) {
            ctx.fillStyle = selection.role === 'main' ? '#f1eadf' : '#edf3f6';
            ctx.fillRect(0, y, CLIENT_IMAGE_WIDTH, headerHeight);
            ctx.fillStyle = selection.role === 'main' ? '#9b7443' : '#47748e';
            ctx.fillRect(0, y, 14, headerHeight);
            ctx.fillStyle = '#0b4166';
            ctx.font = '700 24px "Microsoft YaHei", sans-serif';
            ctx.fillText(`${selection.role === 'main' ? '核心方案' : '辅助方案'} · ${selection.item.sku_id}${chunkIndex ? '（续）' : ''}`, 50, y + 47);
            ctx.font = '700 31px "Microsoft YaHei", sans-serif';
            drawWrappedText(ctx, selection.item.sku_name, 50, y + 94, 950, 38, chunkIndex === 0 ? 2 : 1);
            ctx.drawImage(chunk.image, 0, y + headerHeight, CLIENT_IMAGE_WIDTH, chunk.image.height);
          }
        });
      });
    });

    const pageUnits = [];
    let current = [];
    let currentHeight = 0;
    units.forEach((unit) => {
      if (current.length && currentHeight + unit.height > CLIENT_IMAGE_MAX_HEIGHT) {
        pageUnits.push({ units: current, height: currentHeight });
        current = [];
        currentHeight = 0;
      }
      current.push(unit);
      currentHeight += unit.height;
    });
    if (current.length) pageUnits.push({ units: current, height: currentHeight });

    const customerName = safeDownloadName(session.name);
    const dateToken = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const files = [];
    for (let index = 0; index < pageUnits.length; index += 1) {
      const page = pageUnits[index];
      const canvas = document.createElement('canvas');
      canvas.width = CLIENT_IMAGE_WIDTH;
      canvas.height = page.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let y = 0;
      page.units.forEach((unit) => {
        unit.draw(ctx, y);
        y += unit.height;
      });
      const blob = await canvasToPngBlob(canvas);
      const part = String(index + 1).padStart(2, '0');
      files.push({
        name: `客户方案参考_${customerName}_${dateToken}_${part}.png`,
        blob,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height
      });
      canvas.width = 1;
      canvas.height = 1;
    }
    return {
      files,
      selections: preparedSelections,
      missing: resolved.missing,
      customerName,
      dateToken,
      cacheKey: `${session.id}:${message.id}:${message.data?.version || 1}`
    };
  }

  function ensureClientImageModal() {
    let modal = $('#caClientImageModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'caClientImageModal';
      modal.className = 'ca-client-image-modal';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function closeClientImageModal() {
    const modal = $('#caClientImageModal');
    if (modal) modal.classList.remove('show');
  }

  function showClientImageLoading() {
    const modal = ensureClientImageModal();
    modal.innerHTML = `<div class="ca-client-image-backdrop" data-client-modal-close></div><div class="ca-client-image-dialog ca-client-image-loading"><button class="ca-client-image-close" data-client-modal-close>×</button><div class="ca-package-spinner"></div><h3>正在准备客户方案资料</h3><p>正在装配入选 SKU 的 PPT 内容，请稍候…</p></div>`;
    modal.classList.add('show');
    modal.querySelectorAll('[data-client-modal-close]').forEach((element) => element.addEventListener('click', closeClientImageModal));
  }

  function showClientImageError(error) {
    const modal = ensureClientImageModal();
    modal.innerHTML = `<div class="ca-client-image-backdrop" data-client-modal-close></div><div class="ca-client-image-dialog ca-client-image-loading"><button class="ca-client-image-close" data-client-modal-close>×</button><h3>暂时无法生成</h3><p>${escapeHtml(error.message || String(error))}</p><button class="ca-primary-btn" data-client-modal-close>返回</button></div>`;
    modal.classList.add('show');
    modal.querySelectorAll('[data-client-modal-close]').forEach((element) => element.addEventListener('click', closeClientImageModal));
  }

  async function downloadClientImageZip(packageData) {
    if (typeof JSZip !== 'function') {
      toast('ZIP 组件未加载，请刷新页面后重试');
      return;
    }
    const zip = new JSZip();
    packageData.files.forEach((file) => zip.file(file.name, file.blob));
    toast('正在打包客户长图…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    triggerBlobDownload(blob, `客户方案参考_${packageData.customerName}_${packageData.dateToken}.zip`);
    toast('ZIP 已生成');
  }

  function renderClientImagePackage(packageData, message) {
    const modal = ensureClientImageModal();
    const skuSummary = packageData.selections.map((selection) =>
      `<span class="ca-package-sku ${selection.role === 'main' ? 'core' : 'auxiliary'}">${selection.role === 'main' ? '核心' : '辅助'} · ${escapeHtml(selection.item.sku_id)} ${escapeHtml(selection.item.sku_name)}</span>`
    ).join('');
    const missing = packageData.missing.length
      ? `<div class="ca-package-warning">以下推荐尚无测试 PPT，未放入图片：${escapeHtml(packageData.missing.join('、'))}</div>`
      : '';
    modal.innerHTML = `<div class="ca-client-image-backdrop" data-client-modal-close></div>
      <div class="ca-client-image-dialog">
        <div class="ca-client-image-header"><div><h3>客户方案资料已准备</h3><p>可生成统一客户网页；原长图下载作为备用方式保留</p></div><button class="ca-client-image-close" data-client-modal-close>×</button></div>
        <div class="ca-package-skus">${skuSummary}</div>${missing}
        <div class="ca-client-image-toolbar"><button class="ca-primary-btn" data-package-plan>生成客户方案网页</button><button class="ca-secondary-btn" data-package-sop>了解客户方案落地 SOP</button><button class="ca-secondary-btn" data-package-zip>下载全部 ZIP</button><button class="ca-secondary-btn" data-package-regenerate>重新生成</button></div>
        <div class="ca-client-image-grid">${packageData.files.map((file, index) => `<article class="ca-client-image-preview"><div class="ca-preview-label">第 ${index + 1} / ${packageData.files.length} 张 · ${file.width} × ${file.height}</div><img src="${file.url}" alt="客户方案长图第 ${index + 1} 张"><button class="ca-secondary-btn" data-package-download="${index}">下载此图</button></article>`).join('')}</div>
      </div>`;
    modal.classList.add('show');
    modal.querySelectorAll('[data-client-modal-close]').forEach((element) => element.addEventListener('click', closeClientImageModal));
    modal.querySelectorAll('[data-package-download]').forEach((button) => button.addEventListener('click', () => {
      const file = packageData.files[Number(button.dataset.packageDownload)];
      if (file) triggerBlobDownload(file.blob, file.name);
    }));
    modal.querySelector('[data-package-zip]')?.addEventListener('click', () => downloadClientImageZip(packageData));
    modal.querySelector('[data-package-regenerate]')?.addEventListener('click', () => openClientImagePackage(message, true));
    modal.querySelector('[data-package-plan]')?.addEventListener('click', () => {
      const session = getActiveSession();
      if (window.ChaoxiPlanModule && session) window.ChaoxiPlanModule.create({ packageData, session });
      else toast('客户方案网页模块暂未加载，请刷新页面后重试');
    });
    modal.querySelector('[data-package-sop]')?.addEventListener('click', () => {
      const session = getActiveSession();
      if (window.ChaoxiSopModule && session) window.ChaoxiSopModule.open({ packageData, session });
      else toast('落地 SOP 模块暂未加载，请刷新页面后重试');
    });
  }

  async function openClientImagePackage(message, force = false) {
    const session = getActiveSession();
    if (!session) return;
    const cacheKey = `${session.id}:${message.id}:${message.data?.version || 1}`;
    if (!force && clientImagePackageCache.has(cacheKey)) {
      renderClientImagePackage(clientImagePackageCache.get(cacheKey), message);
      return;
    }
    if (force && clientImagePackageCache.has(cacheKey)) {
      revokeClientImagePackage(clientImagePackageCache.get(cacheKey));
      clientImagePackageCache.delete(cacheKey);
    }
    showClientImageLoading();
    try {
      const packageData = await buildClientImagePackage(message, session);
      clientImagePackageCache.set(cacheKey, packageData);
      renderClientImagePackage(packageData, message);
    } catch (error) {
      console.error('客户长图生成失败：', error);
      showClientImageError(error);
    }
  }

  async function createAndOpenSession() {
    const session = createSessionRecord();
    sessions.push(session);
    await putRecord('sessions', session);
    await addMessage('assistant', '您好，我是朝曦客户全流程小助手。可以先随便聊聊，也可以直接输入某位客户的情况；我会在识别到业务信息后，自然地帮您梳理画像、痛点和 SKU。', 'text', null, session.id);
    await switchSession(session.id);
    $('#assistantApp').classList.remove('sidebar-open');
  }

  async function switchSession(sessionId) {
    exitRoleplayMode();
    if (busy && sessionId !== activeSessionId) {
      requestNonce += 1;
      setBusy(false);
    }
    activeSessionId = sessionId;
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    activeMessages = await getSessionMessages(sessionId);
    await ensureCurrentGuidedQuestion(getActiveSession());
    renderSessionList();
    renderHeader();
    renderMessages();
    $('#assistantApp').classList.remove('sidebar-open');
  }

  async function renameActiveSession() {
    const session = getActiveSession();
    if (!session) return;
    if (session.nameLocked) {
      toast('这是演示模板，名称由后台统一维护，前端无法修改');
      return;
    }
    const name = prompt('请输入客户会话名称', session.name);
    if (!name || !name.trim()) return;
    session.name = name.trim().slice(0, 40);
    session.manualName = true;
    await saveSession(session);
  }

  async function archiveActiveSession() {
    const session = getActiveSession();
    if (!session) return;
    session.archived = !session.archived;
    await saveSession(session);
    toast(session.archived ? '客户已归档' : '已取消归档');
  }

  async function deleteActiveSession() {
    const session = getActiveSession();
    if (!session) return;
    if (!confirm(`确定删除“${session.name}”及其全部聊天、画像和推荐吗？此操作无法撤销。`)) return;
    await deleteBySession('messages', session.id);
    await deleteBySession('recommendations', session.id);
    await deleteSessionRecord(session.id);
    await deleteSessionOnServer(session.id);
    sessions = sessions.filter((item) => item.id !== session.id);
    activeSessionId = null;
    activeMessages = [];
    if (!sessions.length) await createAndOpenSession();
    else await switchSession(sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0].id);
  }

  function showLegacyTools() {
    const session = getActiveSession();
    if (session) {
      const summary = profileSummary(session);
      const input = document.getElementById('clientInput');
      if (input) input.value = summary;
      try {
        currentClientText = summary;
        currentDecomposed = {
          subject: session.profile.subject.value,
          industry: session.profile.industry.value,
          assets: session.profile.assets.value,
          events: session.profile.events.value,
          constraints: session.profile.constraints.value
        };
      } catch (_) {}
    }
    document.body.classList.remove('assistant-mode');
    document.body.classList.add('legacy-mode');
    let back = $('#caBackToChat');
    if (!back) {
      back = document.createElement('button');
      back.id = 'caBackToChat';
      back.className = 'ca-back-btn';
      back.textContent = '← 返回客户对话';
      back.addEventListener('click', () => {
        document.body.classList.remove('legacy-mode');
        document.body.classList.add('assistant-mode');
        back.remove();
      });
      document.body.appendChild(back);
    }
  }

  async function exportBackup() {
    try {
      const payload = {
        version: 1,
        exportedAt: nowIso(),
        sessions: await getAllRecords('sessions'),
        messages: await getAllRecords('messages'),
        recommendations: await getAllRecords('recommendations')
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `客户全流程小助手备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('本地档案已导出');
    } catch (error) {
      toast(`导出失败：${error.message}`);
    }
  }

  // ===== 单条对话的导出 / 导入：用于同事之间分享某一次完整的客户沟通 =====
  const CONVERSATION_FILE_TYPE = 'zx-client-assistant-conversation';

  async function exportConversation(sessionId) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) { toast('没有找到要导出的对话'); return; }
    try {
      const [allMessages, allRecs] = await Promise.all([
        getAllRecords('messages'),
        getAllRecords('recommendations')
      ]);
      const messages = allMessages
        .filter((m) => m.sessionId === sessionId)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      if (!messages.length) { toast('这条对话还没有内容，无需导出'); return; }

      const payload = {
        type: CONVERSATION_FILE_TYPE,
        version: 1,
        exportedAt: nowIso(),
        exportedBy: currentUserEmail || '未登录用户',
        session,
        messages,
        recommendations: allRecs.filter((r) => r.sessionId === sessionId)
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const safeName = String(session.name || '未命名客户').replace(/[\\/:*?"<>|]/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `对话_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast(`已导出「${session.name || '未命名客户'}」共 ${messages.length} 条消息，可发给同事导入`);
    } catch (error) {
      toast(`导出对话失败：${error.message}`);
    }
  }

  async function importConversation(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.type !== CONVERSATION_FILE_TYPE || !payload.session || !Array.isArray(payload.messages)) {
        throw new Error('这不是一份对话分享文件');
      }
      const sourceName = payload.session.name || '未命名客户';
      const from = payload.exportedBy ? `（来自 ${payload.exportedBy}）` : '';
      if (!confirm(`导入「${sourceName}」${from}\n共 ${payload.messages.length} 条消息。\n\n将作为一条新的对话存入你的档案，不会覆盖你现有的任何内容。是否继续？`)) return;

      // 重新分配 ID：保证导入方永远是「新增一份副本」，不会覆盖自己或他人的记录
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      // 名称标注来源，避免和自己的同名对话混淆
      const sender = String(payload.exportedBy || '').split('@')[0];
      const importedName = sender ? `${sourceName}（来自 ${sender}）` : `${sourceName}（导入）`;
      const imported = normalizeSession({
        ...payload.session,
        id: newSessionId,
        name: importedName,
        manualName: true,
        importedFrom: payload.exportedBy || null,
        importedAt: nowIso(),
        updatedAt: nowIso()
      });
      await putRecord('sessions', imported);

      for (const message of payload.messages) {
        await putRecord('messages', {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          sessionId: newSessionId
        });
      }
      for (const rec of payload.recommendations || []) {
        await putRecord('recommendations', {
          ...rec,
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          sessionId: newSessionId
        });
      }

      sessions = (await getAllRecords('sessions')).map(normalizeSession);
      await switchSession(newSessionId);
      toast(`已导入「${sourceName}」${from}`);
    } catch (error) {
      toast(`导入对话失败：${error.message}`);
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.sessions) || !Array.isArray(payload.messages)) throw new Error('备份格式不正确');
      if (!confirm(`将导入 ${payload.sessions.length} 个客户会话。相同 ID 的记录会被更新，是否继续？`)) return;
      for (const session of payload.sessions) await putRecord('sessions', normalizeSession(session));
      for (const message of payload.messages) await putRecord('messages', message);
      for (const rec of (payload.recommendations || [])) await putRecord('recommendations', rec);
      sessions = (await getAllRecords('sessions')).map(normalizeSession);
      await switchSession(sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0].id);
      toast('备份导入完成');
    } catch (error) {
      toast(`导入失败：${error.message}`);
    }
  }

  async function loadWorkbookRows(fileName) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS 未加载');
    const response = await fetch(encodeURI(fileName), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${fileName} 加载失败 (${response.status})`);
    const bytes = await response.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  async function loadJson(fileName) {
    const response = await fetch(encodeURI(fileName), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${fileName} 加载失败 (${response.status})`);
    return response.json();
  }

  async function loadSources() {
    const status = $('#caSourceStatus');
    try {
      const [allPainRows, allSkuRows, wideQuestions] = await Promise.all([
        loadWorkbookRows(PAIN_FILE),
        loadWorkbookRows(SKU_FILE),
        loadJson(SKU_WIDE_QUESTIONS_FILE)
      ]);
      painRows = allPainRows.filter((row) => String(row['同步状态'] || '').trim() === '已同步');
      skuRows = allSkuRows.filter((row) => row['Number'] || row['name'] || row['中文全称']);
      if (!wideQuestions || !Array.isArray(wideQuestions.skus) || wideQuestions.skus.length !== 15) {
        throw new Error('SKU 宽表问题库不是预期的 15 个测试 SKU');
      }
      skuQuestionBank = wideQuestions;
      try {
        const sop = await loadJson(SKU_LANDING_SOP_FILE);
        if (sop && Array.isArray(sop.skus)) skuSopBank = sop;
      } catch (error) {
        console.warn('SKU 落地 SOP 库加载失败（不影响主流程）：', error.message);
      }
      try {
        const supplier = await loadJson(SKU_LANDING_SUPPLIER_FILE);
        if (supplier && Array.isArray(supplier.skus)) skuSupplierBank = supplier;
        const supplierSummary = await loadJson(SKU_SUPPLIER_SUMMARY_FILE);
        if (supplierSummary && Array.isArray(supplierSummary.skus)) skuSupplierSummaryBank = supplierSummary;
        const pptContent = await loadJson(SKU_PPT_CONTENT_FILE);
        if (pptContent && Array.isArray(pptContent.skus)) skuPptBank = pptContent;
      } catch (error) {
        console.warn('SKU 供应商库加载失败（不影响主流程）：', error.message);
      }
      if (painRows.length !== 773) console.warn(`已同步痛点数量为 ${painRows.length}，设计基线为 773`);
      if (skuRows.length !== 312) console.warn(`SKU 数量为 ${skuRows.length}，设计基线为 312`);
      status.textContent = `知识库已就绪：${painRows.length} 条已同步痛点 · ${wideQuestions.skuCount} 个测试 SKU · ${wideQuestions.totalQuestions} 条宽表核心问题`;
      status.classList.remove('error');
    } catch (error) {
      sourceError = error.message;
      if (demoViewerMode) {
        // 演示版不携带知识库源表（仅供查看样例对话），这不是故障
        status.textContent = '演示版：可查看完整样例对话，如需生成新内容请使用完整版';
        status.classList.remove('error');
      } else {
        status.textContent = `知识库不可用：${error.message}`;
        status.classList.add('error');
      }
    }
  }

  function mergeProfile(session, patch, evidence, correction) {
    const changed = [];
    if (!patch || typeof patch !== 'object') return changed;
    const normalizedPatch = normalizeIncomingProfilePatch(patch);
    PROFILE_KEYS.forEach((key) => {
      const raw = normalizedPatch[key];
      if (!raw) return;
      const value = typeof raw === 'string' ? raw.trim() : String(raw.value || '').trim();
      if (!value) return;
      const previous = session.profile[key] || emptyDimension();
      const confidence = Number(typeof raw === 'object' ? raw.confidence : 0.75) || 0.75;
      const isCorrection = !!(typeof raw === 'object' && raw.confirmed) || Boolean(correction);
      if (previous.value && value !== previous.value && !isCorrection && confidence < previous.confidence) return;
      const nextEvidence = typeof raw === 'object' ? raw.evidence : evidence?.[key];
      if (value !== previous.value) changed.push(key);
      session.profile[key] = {
        value,
        evidence: String(nextEvidence || previous.evidence || ''),
        confidence: Math.max(0, Math.min(1, confidence)),
        confirmed: !!(typeof raw === 'object' ? raw.confirmed : correction),
        updatedAt: nowIso()
      };
    });
    return changed;
  }

  function questionContext(session) {
    return session.flow.askedQuestions.slice(-10).join('\n');
  }

  function orchestratorPrompt(session) {
    const pains = session.pains.map((item) => `${item.code}:${item.title}`).join('；');
    const skus = session.skus.map((item) => `${item.number}:${item.name}`).join('；');
    return `你是“朝曦客户全流程小助手”的对话编排器。网页用户是销售，销售可能在描述客户，也可能只是与助手闲聊。

你的任务同时包括自然回复、业务识别、五维画像增量抽取和下一问建议。必须只返回 JSON，不要输出代码块。

当前 session 状态：${session.stage}
痛点问题进度：${session.flow.painStep}/5
SKU 问题进度：${session.flow.skuStep}/5
当前画像：${JSON.stringify(profileSnapshot(session))}
已问问题：${questionContext(session) || '无'}
已确认痛点：${pains || '无'}
已推荐 SKU：${skus || '无'}

规则：
1. 普通闲聊正常回应，intent=casual，不强行引导业务。
2. 出现客户身份、行业、资产、事件或约束时，intent=business，business_signal=true。
3. profile_patch 只填写本轮能够从用户原话可靠得出的新信息；不确定就留空，不得为了显得"已了解"而填入笼统或猜测性的描述。confidence 必须如实反映把握程度：明确具体的事实给 0.7 以上；只是模糊提及、尚待展开的给 0.5 以下；纯粹的意向性表态（如"我来说一下客户情况"）不算新信息，不填 profile_patch。
4. 销售明确纠正旧信息时 correction=true。
5. suggested_question 每次只能有一个问题，必须与当前阶段有关，不能重复已问问题。
6. PROFILE_GATHERING 阶段的 suggested_question 只能追问画像五维（主体、行业、资产、发生了什么、约束）中仍然缺失或薄弱的维度，一次只问一个维度，不得涉及痛点确认或SKU相关问题。
7. PAIN_CONFIRMATION 的问题用于区分和确认痛点；SKU_CONFIRMATION 的下一问由系统从候选SKU宽表C列单独生成，此阶段 suggested_question 必须为空，reply 只简短回应客户刚才的回答，不要在 reply 中再提问。
8. reply 专业、亲和、简洁，普通回复尽量在 180 字内。
9. search_terms 返回 3-10 个用于检索痛点/SKU 的专业短语，例如“家族传承”“控制权”“跨境税务”。
10. 五维定义必须严格遵守：subject=客户在个人、家庭、企业中的身份和决策角色；industry=主营业务、财富来源行业及行业周期；assets=客户拥有、控制或享有实际权益的资产；events=已经发生、正在发生或计划发生的个人、家庭、企业事项；constraints=仅限外部法律、监管、税务、司法、信披、减持规则、外汇管理、牌照和审核等强制条件。
11. 家庭不和、家人反对、夫妻矛盾、兄弟姐妹纠纷、代际冲突、传承分歧、婚姻变化必须放入 events，不得放入 constraints。
12. 客户偏好或内部困难，例如不愿失去控制权、不愿承担风险、希望保密、时间紧、缺乏流动性、团队能力不足，不得放入 constraints；保留在 reply、对话证据或下一问中即可。
13. “上市计划”“股权代持”本身属于 events；不要把 events 原样抄进 constraints。
14. 【约束必须专业推断，这是你的核心价值】客户信息几乎不会直接说出自己受什么法律监管约束——识别这些约束本身就是专业判断，是你必须主动完成的工作，绝不能因为客户没明说就留空或填“待确认”。只要 subject/assets/events 中有任何可判断的信号，你就必须据此推断出该客户真实面临的、具体的法律/监管强制条件，写进 constraints（给 0.6 以上 confidence）。推断要具体到法规/监管机构/制度名称，例如：
   - A股上市公司股东/创始股东 → 证监会《上市公司股东减持股份管理办法》减持比例与预披露、短线交易6个月规则、内幕交易与窗口期限制、大额持股变动信息披露义务；
   - 上市公司股权质押融资 → 质押比例上限、平仓线与强平监管、资金用途穿透审查、质押信息披露；
   - 收购/并购上游或同业企业 → 经营者集中反垄断申报、同业竞争与关联交易审查、若构成重大资产重组的交易所审核与信披；
   - 跨境资产/离岸架构/境外身份 → CRS信息交换、受控外国公司CFC规则、ODI/37号文外汇登记、目标国税务居民/非居民信托规则；
   - 股权代持 → 代持还原的工商登记与税务处理、上市前股权清晰合规要求；
   - 企业上市/IPO → 发行上市审核、信息披露、股权结构与历史沿革合规。
   仅当客户信息实在过于空泛、无任何可据以推断的身份/资产/事件信号时，才可填“暂无足以判断的外部约束，待补充客户信息”，并给 0.55 以下 confidence。
15. 【行业必须带景气度与风险判断】一旦确定客户主营/财富来源行业，industry 不能只写行业名称，必须补充：① 细分赛道 ② 该行业当前所处周期阶段或景气度（上行/下行/强监管/技术迭代/政策红利/产能过剩等）③ 由此推断客户可能面临的问题或风险。例如“制造业-高端装备，行业处于国产替代政策红利期但下游需求分化，客户或面临订单波动与扩产资金压力”。
16. profile_patch 的写法质量要求：①用户原话中出现的具体数字、金额、比例、国家/地区、身份类型必须原样保留，不得笼统概括（如“约3000万美元离岸金融资产”不得写成“境外资产”，“约2亿元收购上游企业”不得写成“企业并购”）；②subject/assets/events 要写成完整、具体的陈述句；③subject 不使用“待进一步确认的客户主体”这类占位语，信息不足就留空等待追问，但 constraints 按第14条必须尽力推断而非留空。

JSON 结构：
{
  "reply":"自然回复",
  "intent":"casual|business",
  "business_signal":false,
  "profile_patch":{
    "subject":{"value":"","evidence":"","confidence":0.0,"confirmed":false},
    "industry":{"value":"","evidence":"","confidence":0.0,"confirmed":false},
    "assets":{"value":"","evidence":"","confidence":0.0,"confirmed":false},
    "events":{"value":"","evidence":"","confidence":0.0,"confirmed":false},
    "constraints":{"value":"","evidence":"","confidence":0.0,"confirmed":false}
  },
  "evidence":{},
  "topic_shift":false,
  "correction":false,
  "material_change":false,
  "title_suggestion":"",
  "search_terms":[],
  "suggested_question":""
}`;
  }

  function localOrchestratorFallback(text) {
    const source = String(text || '').trim();
    const patch = emptyProfile();
    const setField = (key, value, confidence = 0.72) => {
      if (!value) return;
      patch[key] = { value, evidence: source.slice(0, 220), confidence, confirmed: false };
    };

    const companyMatch = source.match(/(?:名下(?:的)?|持有|拥有|创办|经营)([^，。；]{1,18}(?:公司|企业))/);
    const roleMatch = source.match(/(创始人|实际控制人|实控人|控股股东|股东|董事长|高管|企业主|家族二代|退休)/);
    // 主体：合成客户本人的税务居民身份、角色、家族身份等显性事实
    const subjectBits = [];
    const clientTaxRes = source.match(/(?:客户|本人|他|她|其)?(?:为|是|系|属于)?\s*(中国|境内|香港|新加坡|美国|加拿大|英国|澳大利亚)(?:税务居民|税籍|永久居民|永居)/);
    if (/(?:客户|本人|他|她)?(?:为|是|系)?\s*(?:中国|境内)税务居民/.test(source)) subjectBits.push('中国税务居民');
    else if (clientTaxRes && !/女儿|儿子|子女|配偶|妻子|丈夫|父母/.test(source.slice(Math.max(0, clientTaxRes.index - 6), clientTaxRes.index))) subjectBits.push(`${clientTaxRes[1]}税务居民`);
    if (companyMatch) subjectBits.push(`${companyMatch[1]}的实际权益人`);
    else if (roleMatch) subjectBits.push(roleMatch[1] === '退休' ? '退休人士' : roleMatch[1]);
    if (/高净值|超高净值/.test(source)) subjectBits.push('高净值个人');
    if (!subjectBits.length && /家族|家办/.test(source)) subjectBits.push('家族财富决策人');
    if (subjectBits.length) setField('subject', `客户为${Array.from(new Set(subjectBits)).join('、')}`, 0.82);
    else if (/客户|本人|他|她/.test(source)) setField('subject', '待进一步确认的客户主体', 0.5);

    const industries = [
      ['科技', /科技|互联网|软件|人工智能|AI|芯片|半导体|SaaS/],
      ['制造业', /制造|工厂|设备|工业|汽车|机械/],
      ['房地产', /地产|房地产|物业|建筑/],
      ['金融', /金融|证券|基金|私募|投资公司|银行/],
      ['医疗健康', /医疗|医药|医院|诊所|生物/],
      ['消费零售', /消费|零售|餐饮|连锁|电商/],
      ['能源资源', /能源|矿业|煤炭|石油|新能源/]
    ];
    const industry = industries.find(([, pattern]) => pattern.test(source));
    if (industry) setField('industry', industry[0], 0.78);

    const assetParts = [];
    // 优先保留原话中的具体金额与描述（如“约3000万美元离岸金融资产”）
    const amountMatch = source.match(/约?\s*[\d.]+\s*(?:万|亿)?\s*(?:美元|美金|港币|港元|人民币|新元|欧元|英镑|元)(?:[^，。；、]{0,16}?(?:金融资产|资产|资金|存款|现金|理财|市值|股权|房产|不动产|信托))?/);
    if (amountMatch) assetParts.push(amountMatch[0].replace(/\s+/g, '').trim());
    if (/股权|股份|持股|代持|控制权/.test(source)) assetParts.push(/代持/.test(source) ? '公司股权（存在代持安排）' : '公司股权');
    if (/房产|物业|不动产/.test(source)) assetParts.push('房产或不动产');
    if (!amountMatch && /现金|存款|理财|流动资金/.test(source)) assetParts.push('现金及流动资产');
    if (!amountMatch && /境外资产|海外资产|离岸|境外金融/.test(source)) assetParts.push('境外资产');
    if (assetParts.length) setField('assets', Array.from(new Set(assetParts)).join('、'), 0.8);

    const eventParts = [];
    if (/上市|IPO/.test(source)) eventParts.push('计划推进企业上市');
    if (/代持/.test(source)) eventParts.push('存在股权代持安排');
    // 设立信托 / 财富分配（本例的核心事件）
    if (/设立|搭建|架设|计划.{0,4}(信托|架构)/.test(source) && /信托/.test(source)) {
      const trustType = /离岸信托|境外信托|海外信托/.test(source) ? '离岸信托'
        : /家族信托/.test(source) ? '家族信托'
        : /保险金信托/.test(source) ? '保险金信托' : '信托';
      const purpose = /分配/.test(source) ? '进行财富分配' : /传承/.test(source) ? '进行财富传承' : '进行财富规划';
      eventParts.push(`计划设立${trustType}${purpose}`);
    } else if (/信托/.test(source)) {
      eventParts.push('涉及信托安排');
    }
    if (/传承|接班|二代/.test(source)) eventParts.push('家族或企业传承');
    // 家族成员身份变化（如“女儿刚成为加拿大税务居民”）
    const memberStatus = source.match(/(女儿|儿子|子女|配偶|妻子|丈夫|孙|父母)[^，。；]{0,8}?(?:成为|取得|获得|移居|定居)?[^，。；]{0,6}?(中国|香港|新加坡|美国|加拿大|英国|澳大利亚)(?:税务居民|税籍|永久居民|永居|身份|国籍)/);
    if (memberStatus) eventParts.push(`${memberStatus[1]}身份变化（${memberStatus[2]}税务居民/身份）`);
    else if (/移民|海外身份|境外定居/.test(source)) eventParts.push('跨境身份安排');
    if (/(?<!金)融资|引战|投资人/.test(source)) eventParts.push('企业融资或引入投资人');
    if (/婚姻|离婚/.test(source)) eventParts.push('婚姻关系变化');
    if (INTERNAL_EVENT_PATTERN.test(source)) eventParts.push('家庭关系或内部意见存在分歧');
    if (eventParts.length) setField('events', Array.from(new Set(eventParts)).join('、'), 0.82);

    // 约束——即使客户未明说，也据身份/资产/事件做专业推断
    const constraintParts = [];
    if (/代持/.test(source) && /法律|监管|审核|合规|规范清理|权属要求/.test(source)) constraintParts.push('股权代持面临外部合规或审核要求');
    if (/上市审核|IPO审核|审核要求|信披|信息披露|股权清晰|股权规范/.test(source)) constraintParts.push('上市审核及股权结构合规要求');
    // 上市公司股东（尤其减持/全流通/大股东）→ 证监会减持规则、信披、短线交易
    if (/上市公司|A股|上市|挂牌/.test(source) && /股东|创始|实控|控股|减持|全流通|持股/.test(source)) {
      constraintParts.push('证监会减持新规（大股东减持比例与预披露、短线交易6个月及窗口期限制）与上市公司信息披露义务');
    }
    // 股权质押融资 → 质押率与平仓线监管
    if (/质押/.test(source) && /融资|贷款|资金/.test(source)) constraintParts.push('股票质押融资监管（质押比例上限、平仓线与资金用途穿透）');
    // 收购/并购 → 反垄断经营者集中申报
    if (/收购|并购|受让.{0,6}股权|入股/.test(source)) constraintParts.push('收购涉及反垄断经营者集中申报及同业竞争/关联交易审查');
    // 带辖区的税务合规（如“加拿大税务合规”），并对跨境信托做合理推断
    const jurisTax = source.match(/(中国|香港|新加坡|美国|加拿大|英国|澳大利亚)(?:的)?税务合规/);
    if (jurisTax) constraintParts.push(`${jurisTax[1]}税务合规要求`);
    if (/信托/.test(source) && /(美国|加拿大|英国|澳大利亚)/.test(source)) constraintParts.push('跨境信托需关注受益人所在国合规要求（含加拿大非居民信托NRT规则/受控外国公司CFC规则/CRS信息交换）');
    else if (/跨境|境外|海外|移民|离岸/.test(source) && /税务|税收|外汇|外管|法律|监管|合规|CRS|37号文|ODI|QDII|QDLP/.test(source)) constraintParts.push('跨境税务、外汇或监管要求');
    if (!jurisTax && /税|税务/.test(source) && !constraintParts.some((p) => /税务/.test(p))) constraintParts.push('税务合规');
    if (/减持规定|减持规则|减持限制/.test(source) && !constraintParts.some((p) => /减持/.test(p))) constraintParts.push('外部减持规则限制');
    if (/司法|法院|诉讼|仲裁/.test(source)) constraintParts.push('司法或争议程序约束');
    if (constraintParts.length) setField('constraints', Array.from(new Set(constraintParts)).join('、'), 0.8);

    const businessSignal = /客户|公司|企业|股权|股份|资产|上市|IPO|代持|传承|移民|融资|税务|控制权|家族|信托|保险/.test(source);
    const terms = Array.from(new Set([
      industry?.[0],
      /代持/.test(source) ? '股权代持' : '',
      /上市|IPO/.test(source) ? '上市合规' : '',
      /股权|股份|持股/.test(source) ? '股权结构' : '',
      /传承|接班|二代/.test(source) ? '企业传承' : '',
      /跨境|境外|海外|移民/.test(source) ? '跨境合规' : ''
    ].filter(Boolean)));
    const suggestedQuestion = /代持/.test(source)
      ? '先确认代持关系：姐姐是否签署过代持协议，实际出资、分红和表决权目前分别由谁掌握？'
      : '';
    const summaryBits = [patch.assets.value, patch.events.value, patch.constraints.value].filter(Boolean);

    return {
      reply: businessSignal
        ? `我已记录这条客户信息${summaryBits.length ? `：${summaryBits.join('；')}` : ''}。接下来我会逐步确认关键事实，避免一次询问过多。`
        : '我已收到这条消息。',
      intent: businessSignal ? 'business' : 'casual',
      business_signal: businessSignal,
      profile_patch: normalizeIncomingProfilePatch(patch),
      evidence: {},
      topic_shift: false,
      correction: false,
      material_change: false,
      title_suggestion: companyMatch ? `${companyMatch[1]}客户` : '',
      search_terms: terms,
      suggested_question: suggestedQuestion,
      local_fallback: true
    };
  }

  async function withOrchestratorTimeout(promise) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('画像分析等待超时')), CHAT_ORCHESTRATOR_TIMEOUT_MS);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function callOrchestrator(session) {
    const recent = activeMessages
      .filter((message) => (message.type === 'text' || message.type === 'guided-question') && (message.role === 'user' || message.role === 'assistant'))
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.type === 'guided-question'
          ? `${message.content ? `${message.content}\n` : ''}${message.data?.question?.originalQuestion || message.data?.question?.displayQuestion || ''}`
          : message.content
      }));
    const latestUserText = [...recent].reverse().find((message) => message.role === 'user')?.content || '';
    try {
      return await withOrchestratorTimeout(callDeepSeekJSON([
        { role: 'system', content: orchestratorPrompt(session) },
        ...recent
      ], 2));
    } catch (error) {
      const fallback = localOrchestratorFallback(latestUserText);
      if (fallback.business_signal || session.stage !== 'CASUAL') {
        console.warn('模型编排暂不可用，已切换本地画像识别：', error.message);
        return fallback;
      }
      throw error;
    }
  }

  function fallbackQuestion(session, suggested) {
    if (suggested && String(suggested).trim()) return String(suggested).trim();
    if (session.stage === 'SKU_CONFIRMATION') return session.skuAnalysis?.lastQuestion?.displayQuestion || '';
    if (session.stage === 'REFRESH_NEEDED') return '这条新信息会影响现有建议。请确认它对客户当前目标或约束的具体影响是什么？';
    return PAIN_FALLBACK_QUESTIONS[Math.max(0, session.flow.painStep - 1)];
  }

  function profileGaps(session) {
    return PROFILE_KEYS.filter((key) => !session.profile[key]?.value);
  }

  const PROFILE_READY_CONFIDENCE = 0.6;

  function profileReady(session) {
    return PROFILE_CORE_KEYS.every((key) => {
      const dim = session.profile[key];
      return Boolean(dim?.value) && Number(dim?.confidence || 0) >= PROFILE_READY_CONFIDENCE;
    });
  }

  function profileGapQuestion(session, suggested) {
    if (suggested && String(suggested).trim()) return String(suggested).trim();
    const gaps = new Set(profileGaps(session));
    const next = PROFILE_CORE_KEYS.find((key) => gaps.has(key)) || PROFILE_CORE_KEYS[0];
    return PROFILE_GAP_QUESTIONS[next];
  }

  const PAIN_ANALYST_SYSTEM_PROMPT = '你是一个专注于金融领域的专业分析师，擅长对金融领域涉及的法律、税务、科技、合规、风控全领域智能分析，负责基于用户已有的KYC数据进行风险画像评估，根据客户特质自主化生成结构化的动态问题组，用于进一步明确客户画像，便于后续在痛点库中寻找最合适的痛点。你的工作流程包括：首先整合用户提供的基本信息、同一分析对象的历史KYC记录等内容；其次识别其中的重要信息缺失、逻辑矛盾或潜在高风险信号；然后据此生成有明确数据依据的验证性或补充性问题。你不得使用任何外部工具或调用额外数据，所有推理必须严格基于系统内已有信息。你必须遵守隐私保护与数据最小化原则，确保所有输出符合金融监管要求，不编造、不假设、不诱导，且提问内容需专业、中立、可解释。';

  async function buildPainQuestionPlan(session) {
    const evidence = activeMessages.filter((message) => message.role === 'user').slice(-15).map((message) => message.content).join('\n');
    const result = await callDeepSeekJSON([
      { role: 'system', content: PAIN_ANALYST_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `假设你主要负责协助客户处理全球金融、法律、税务、资本市场以及全球金融机构的相关业务，同时谨慎评估合规、风险信息。\n\n客户KYC数据：\n${profileSummary(session)}\n\n对话补充信息：\n${evidence || '暂无'}\n\n我希望更好地了解客户的进一步信息，请帮我精选最有效的5个问题。\n【核心要求】\n1. 每个问题聚焦一个独立的核心维度，且每个问题的选项设计要能够帮助我快速匹配对应的服务方案。\n2. 问题需覆盖以下维度（可根据客户场景动态调整生成）：资产/资金来源性质、主体/架构状态、标的/投向类型、路径/通道选择、税务/身份状态、时间/退出规划、配套/特殊需求。\n3. 每个问题的答案以选择项方式罗列，控制在5-8个核心选项，确保选项能直接指向明确痛点和解决方案，而非枚举所有可能性；如5-8个选项以外还有未穷尽场景，增加一个选项为"以上均不是"。\n\n只返回JSON，不要输出代码块：{"questions":[{"dimension":"维度名","question":"问题文本","options":["选项1","选项2","..."]}]}，数组长度必须恰好为5，每个问题的options数组长度在5到9之间（含"以上均不是"）。`
      }
    ], 2);
    const questions = Array.isArray(result.questions) ? result.questions : [];
    if (questions.length !== 5) throw new Error('痛点确认问题数量不为5');
    return questions.map((item) => {
      const question = String(item.question || '').trim();
      const options = Array.isArray(item.options) ? item.options.map((opt) => String(opt || '').trim()).filter(Boolean) : [];
      if (!question || options.length < 3) throw new Error('痛点确认问题内容不完整');
      return { dimension: String(item.dimension || '').trim(), question, options };
    });
  }

  function createPlannedPainQuestion(planItem, step) {
    const id = `guided-pain_confirmation-${step}-${Date.now()}`;
    const options = planItem.options.map((label, index) => optionRecord(`${id}-${index + 1}`, label.length > 20 ? `${label.slice(0, 19)}…` : label, label));
    options.push(optionRecord(`${id}-unknown`, '不清楚，需要核查', '当前信息不清楚，需要进一步核查', '', { exclusive: true }));
    options.push(optionRecord(`${id}-other`, OTHER_OPTION_LABEL, '存在其他需要补充的客户事实', '', { requiresText: true }));
    return {
      id,
      stage: 'PAIN_CONFIRMATION',
      step,
      displayQuestion: planItem.question,
      originalQuestion: planItem.question,
      sourceIds: [`PAIN-Q${step}`],
      sources: [],
      directionKey: planItem.dimension || '',
      options,
      draftOptionIds: [],
      otherText: '',
      createdAt: nowIso()
    };
  }

  async function addPlannedPainQuestion(session, step, intro = '') {
    const planItem = session.painQuestionPlan && session.painQuestionPlan[step - 1];
    if (!planItem) throw new Error('痛点确认问题计划缺失');
    const question = createPlannedPainQuestion(planItem, step);
    return addMessage('assistant', intro, 'guided-question', { stage: 'PAIN_CONFIRMATION', step, question }, session.id);
  }

  async function enterPainConfirmation(session, reply, messageData, transitionText) {
    session.stage = 'PAIN_CONFIRMATION';
    session.flow.painStep = 1;
    const intro = reply ? `${reply}\n\n${transitionText}` : transitionText;
    try {
      session.painQuestionPlan = await buildPainQuestionPlan(session);
      session.flow.askedQuestions.push(session.painQuestionPlan[0].question);
      await addPlannedPainQuestion(session, 1, intro);
    } catch (error) {
      console.warn('痛点确认问题组生成失败，使用本地逐题兜底：', error.message);
      session.painQuestionPlan = null;
      const question = fallbackQuestion(session, '');
      session.flow.askedQuestions.push(question);
      await addGuidedQuestion(session, 'PAIN_CONFIRMATION', 1, question, intro, null, messageData);
    }
  }

  function buildSearchTerms(session) {
    const terms = new Set((session.searchTerms || []).map((item) => String(item).trim()).filter(Boolean));
    PROFILE_KEYS.forEach((key) => {
      const value = session.profile[key]?.value || '';
      value.split(/[，。；、,;\s|/]+/).forEach((part) => {
        const clean = part.trim();
        if (clean.length >= 2 && clean.length <= 18) terms.add(clean);
      });
    });
    const messageText = activeMessages.filter((m) => m.role === 'user').slice(-12).map((m) => m.content).join(' ');
    const synonymRules = [
      [/传承|接班|二代|儿子|女儿/, ['家族传承', '企业传承', '二代接班', '股权传承']],
      [/海外|境外|跨境|香港|新加坡/, ['跨境架构', '海外资产', '跨境税务', '境外合规']],
      [/上市|股东|增持|减持|控制权/, ['上市公司', '股权', '控制权', '股东']],
      [/离婚|婚姻|夫妻/, ['婚姻风险', '夫妻财产', '资产隔离']],
      [/税|税务/, ['税务合规', '税务筹划']],
      [/信托/, ['家族信托', '保险金信托']],
      [/保险/, ['保险', '保障', '保险金信托']],
      [/现金流|融资|资金/, ['融资需求', '流动性', '现金流']]
    ];
    synonymRules.forEach(([regex, values]) => { if (regex.test(messageText)) values.forEach((value) => terms.add(value)); });
    return Array.from(terms).slice(0, 24);
  }

  function fieldText(row, keys) {
    return keys.map((key) => stripHtml(row[key] || '')).join(' ').toLowerCase();
  }

  function scoreRow(text, terms, multiplier = 1) {
    let score = 0;
    terms.forEach((term) => {
      const needle = String(term).toLowerCase();
      if (!needle) return;
      if (text.includes(needle)) score += multiplier * (needle.length >= 4 ? 1.5 : 1);
    });
    return score;
  }

  function painCandidates(session) {
    const terms = buildSearchTerms(session);
    const scored = painRows.map((row) => {
      const tags = Array.from({ length: 10 }, (_, index) => row[`Tag${index + 1}`]).filter(Boolean).join(' ');
      const score =
        scoreRow(fieldText(row, ['痛点描述']), terms, 5) +
        scoreRow(String(tags).toLowerCase(), terms, 6) +
        scoreRow(fieldText(row, ['核心冲突', '潜在风险', '解决方案']), terms, 2) +
        scoreRow(fieldText(row, ['BU', 'SKU Group']), terms, 1.5);
      return { row, score };
    }).sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0) return scored.slice(0, 30);
    const perBu = new Map();
    scored.forEach((item) => {
      const bu = String(item.row.BU || '其他');
      const items = perBu.get(bu) || [];
      if (items.length < 4) items.push(item);
      perBu.set(bu, items);
    });
    return Array.from(perBu.values()).flat().slice(0, 30);
  }

  const PAIN_MATCH_SYSTEM_PROMPT = '你是一位服务于"朝曦家办"的高级财富规划智能顾问。你的核心职责是：基于客户的KYC画像，从家办沉淀的"业务痛点库"中，精准定位客户最可能面临的核心痛点，并生成专业、清晰、有洞察的解决方案报告和建议。你的所有推理必须严格基于inputs信息及提供的候选痛点列表，不得发明列表之外的编码或内容。你必须遵守隐私保护与数据最小化原则，确保所有输出符合金融监管要求，不编造、不假设、不诱导，且提问内容需专业、中立、可解释。';

  async function selectPainsWithAI(session, candidates) {
    const payload = candidates.map(({ row }) => ({
      code: String(row['总编码'] || ''),
      bu: String(row['BU'] || ''),
      title: stripHtml(row['痛点描述']),
      tags: Array.from({ length: 10 }, (_, index) => row[`Tag${index + 1}`]).filter(Boolean),
      conflict: stripHtml(row['核心冲突'])
    }));
    const result = await callDeepSeekJSON([
      {
        role: 'system',
        content: PAIN_MATCH_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: `客户画像：${profileSummary(session)}\n检索词：${buildSearchTerms(session).join('、')}\n候选痛点（只能从中选择，不得发明列表外的编码）：${JSON.stringify(payload)}\n\n请遍历候选痛点，分别从标签/因子命中、语义相似、核心冲突匹配三个维度评估客户信息与每条痛点的匹配程度：\n- 标签命中得分：候选痛点的tags字段中，客户画像/对话证据明确提及或可合理推断（只能反推上级层级，不得假设下级层级）的标签占比，0-1。\n- 语义相似得分：客户描述与该痛点title/conflict在语义上的相近程度（可识别语义相近但文字不同的表达），0-1。\n- 核心冲突匹配得分：客户核心诉求与该痛点conflict是否指向同一类矛盾（问题本质、涉及主体、矛盾性质是否一致），0-1。\n最终得分 = 0.35×标签命中得分 + 0.4×语义相似得分 + 0.25×核心冲突匹配得分。\n选出得分最高的3条（不得重复），只返回JSON：{"selections":[{"code":"P-xxx","score":0.0,"tag_score":0.0,"semantic_score":0.0,"conflict_score":0.0,"hit_tags":["命中的标签"],"reason":"匹配依据"}]}，selections 必须按 score 从高到低排列。`
      }
    ], 2);
    return Array.isArray(result.selections) ? result.selections : [];
  }

  async function suggestNewPains(session) {
    const result = await callDeepSeekJSON([
      { role: 'system', content: PAIN_MATCH_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `客户画像：${profileSummary(session)}\n检索词：${buildSearchTerms(session).join('、')}\n\n您的客户遇到的问题与库内痛点匹配度均低于80%，请模仿家办痛点库的行文风格，给出新增痛点建议（数量不限，但只输出确有依据的建议，不确定时不要输出）。每条建议包含：\n- description：以"面临...问题/困境/挑战/障碍"为核心句式，清晰界定"什么主体"在"什么场景下"遇到"什么问题"，不超过20字。\n- conflict：不超过25字，提炼客户的核心目标（通常正面、主动）与阻碍该目标实现的根本性、结构性矛盾。\n- risk：说明核心冲突若得不到解决，最坏、次坏会发生什么情况，具体化风险后果，避免泛泛而谈。\n- solution：前瞻性、分步骤的专业行动建议，客观平实描述解决方案本身，不加"我们协助您"等营销语言。\n- effect：客观平实描述若成功实施能带来的正面价值和商业成果，不使用营销语言、不夸大。\n\n只返回JSON：{"suggestions":[{"description":"","conflict":"","risk":"","solution":"","effect":""}]}`
      }
    ], 2);
    return Array.isArray(result.suggestions) ? result.suggestions.map((item) => ({
      description: String(item.description || '').trim(),
      conflict: String(item.conflict || '').trim(),
      risk: String(item.risk || '').trim(),
      solution: String(item.solution || '').trim(),
      effect: String(item.effect || '').trim()
    })).filter((item) => item.description) : [];
  }

  async function generatePainRecommendations(session, refreshMode = false) {
    if (!painRows.length) throw new Error(sourceError || '痛点库尚未加载');
    const candidates = painCandidates(session);
    let selections = [];
    try { selections = await selectPainsWithAI(session, candidates); }
    catch (error) { console.warn('AI 痛点排序失败，使用本地排序', error); }
    const candidateMap = new Map(candidates.map((item) => [String(item.row['总编码']), item.row]));
    const picked = [];
    selections.forEach((selection) => {
      const row = candidateMap.get(String(selection.code));
      if (row && !picked.some((item) => item.code === String(row['总编码']))) {
        picked.push({ row, selection });
      }
    });
    candidates.forEach(({ row }) => {
      if (picked.length < 3 && !picked.some((item) => item.code === String(row['总编码']))) picked.push({ row, selection: {} });
    });
    const items = picked.slice(0, 3).map(({ row, selection }) => {
      const matchScore = Number.isFinite(Number(selection.score)) ? Math.max(0, Math.min(1, Number(selection.score))) : null;
      return {
        code: String(row['总编码'] || ''),
        bu: String(row['BU'] || ''),
        title: stripHtml(row['痛点描述']),
        description: stripHtml(row['痛点说明']),
        reason: String(selection.reason || `与当前客户画像中的“${buildSearchTerms(session).slice(0, 4).join('、') || '关键情境'}”相匹配`),
        urgency: String(selection.urgency || '待确认'),
        conflict: stripHtml(row['核心冲突']),
        risk: stripHtml(row['潜在风险']),
        solution: stripHtml(row['解决方案']),
        skuGroup: String(row['SKU Group'] || ''),
        matchPercent: matchScore === null ? null : Math.round(matchScore * 100),
        tagScore: Number.isFinite(Number(selection.tag_score)) ? Math.round(Number(selection.tag_score) * 100) : null,
        semanticScore: Number.isFinite(Number(selection.semantic_score)) ? Math.round(Number(selection.semantic_score) * 100) : null,
        conflictScore: Number.isFinite(Number(selection.conflict_score)) ? Math.round(Number(selection.conflict_score) * 100) : null,
        hitTags: Array.isArray(selection.hit_tags) ? selection.hit_tags.map(String) : []
      };
    });
    session.pains = items;
    session.recommendationVersion += 1;
    let newPainSuggestions = [];
    const allBelowThreshold = items.length > 0 && items.every((item) => item.matchPercent !== null && item.matchPercent < 80);
    if (allBelowThreshold) {
      try { newPainSuggestions = await suggestNewPains(session); }
      catch (error) { console.warn('新增痛点建议生成失败：', error.message); }
    }
    await putRecord('recommendations', {
      id: `${session.id}-pain-v${session.recommendationVersion}`,
      sessionId: session.id,
      type: 'pain',
      version: session.recommendationVersion,
      items,
      newPainSuggestions,
      createdAt: nowIso()
    });
    await addMessage('assistant', '', 'pain-recommendation', { items, version: session.recommendationVersion, newPainSuggestions }, session.id);
    if (!refreshMode) {
      await enterSkuConfirmation(session);
    }
    await saveSession(session);
  }

  function wideSkuRecord(number) {
    return skuQuestionBank?.skus?.find((item) => String(item.sku) === String(number)) || null;
  }

  function testSkuNumbers() {
    return new Set((skuQuestionBank?.skus || []).map((item) => String(item.sku)));
  }

  function normalizeQuestionText(value) {
    return String(value || '')
      .replace(/【[^】]*】/g, '')
      .replace(/[？?，,。；;：:\s]/g, '')
      .toLowerCase();
  }

  function skuCandidates(session) {
    if (!skuQuestionBank?.skus?.length) return [];
    const terms = new Set(buildSearchTerms(session));
    const painParts = [];
    session.pains.forEach((pain) => {
      [pain.title, pain.solution, pain.skuGroup].forEach((text) => String(text || '').split(/[;；、,，|/]+/).forEach((part) => {
        const clean = part.trim();
        if (clean.length >= 2) {
          terms.add(clean);
          painParts.push(clean);
        }
      }));
    });
    const termList = Array.from(terms).slice(0, 60);
    const allowed = testSkuNumbers();
    const evaluations = session.skuAnalysis?.evaluations || {};
    return skuRows
      .filter((row) => allowed.has(String(row['Number'] || '')))
      .map((row) => {
        const number = String(row['Number'] || '');
        const nameText = fieldText(row, ['Number', 'name', '中文全称']);
        const scenarioText = fieldText(row, ['客户痛点/场景关键词', '定义', '主要特点和功能']);
        const riskText = fieldText(row, ['必备前置条件', '不适用场景/风险提示', '关联SKU']);
        const painLinkScore = scoreRow(nameText, painParts, 12) + scoreRow(scenarioText, painParts, 3);
        const baseScore = painLinkScore
          + scoreRow(nameText, termList, 8)
          + scoreRow(scenarioText, termList, 4)
          + scoreRow(riskText, termList, 1.5);
        const evaluation = evaluations[number] || { score: 0, history: [] };
        const answerScore = Number(evaluation.score || 0);
        const origins = [];
        if (painLinkScore > 0) origins.push('痛点关联');
        if (baseScore - painLinkScore > 0) origins.push('画像/对话');
        if (answerScore > 0) origins.push('五问新证据');
        if (!origins.length) origins.push('测试样本扫描');
        return { row, number, baseScore, answerScore, score: baseScore + answerScore, evaluation, origins };
      })
      .sort((a, b) => b.score - a.score || b.baseScore - a.baseScore || a.number.localeCompare(b.number));
  }

  function persistSkuCandidateSnapshot(session, candidates) {
    session.skuAnalysis.candidates = candidates.slice(0, 5).map((item) => ({
      number: item.number,
      name: String(item.row['name'] || item.row['中文全称'] || ''),
      score: Number(item.score.toFixed(2)),
      baseScore: Number(item.baseScore.toFixed(2)),
      answerScore: Number(item.answerScore.toFixed(2)),
      origins: item.origins
    }));
    session.skuAnalysis.updatedAt = nowIso();
  }

  function atomicWideQuestions(source) {
    const raw = String(source.question || '').trim();
    const withoutTags = raw.replace(/【[^】]*】/g, '').trim();
    const numbered = withoutTags
      .split(/(?=\d+[.、]\s*)/)
      .map((item) => item.replace(/^\d+[.、]\s*/, '').trim())
      .filter(Boolean);
    const chunks = numbered.length > 1 ? numbered : withoutTags.split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    const atomic = chunks.flatMap((chunk) => {
      const parts = chunk.split(/(?<=？)/).map((item) => item.trim()).filter(Boolean);
      return parts.length > 1 ? parts : [chunk];
    });
    return (atomic.length ? atomic : [withoutTags]).map((question, index) => ({
      ...source,
      id: `${source.id}-P${index + 1}`,
      rowQuestionId: source.id,
      rawQuestion: raw,
      question: question.replace(/^\d+[.、]\s*/, '').trim()
    }));
  }

  function buildWideQuestionPool(session, candidates) {
    const askedIds = new Set((session.skuAnalysis.asked || []).flatMap((item) => item.sourceIds || []));
    const askedTexts = (session.skuAnalysis.asked || []).map((item) => normalizeQuestionText(item.displayQuestion));
    const terms = buildSearchTerms(session);
    const pool = [];
    candidates.slice(0, 5).forEach((candidate, rank) => {
      const wide = wideSkuRecord(candidate.number);
      (wide?.questions || []).forEach((source) => {
        if (askedIds.has(source.id)) return;
        atomicWideQuestions(source).forEach((atomic) => {
          if (askedIds.has(atomic.id)) return;
          const normalized = normalizeQuestionText(atomic.question);
          if (!normalized || askedTexts.some((asked) => asked && (asked.includes(normalized) || normalized.includes(asked)))) return;
          const priority = (5 - rank) * 8
            + (atomic.isKeyConfirmation ? 24 : 0)
            + (atomic.targetAnswer ? 12 : 0)
            + (/需求初判|资格|前置|确认/.test(`${atomic.primaryStage} ${atomic.secondaryNode}`) ? 10 : 0)
            + scoreRow(String(atomic.question).toLowerCase(), terms, 2)
            - Number(String(atomic.id).match(/-P(\d+)$/)?.[1] || 1) * 0.1;
          pool.push({
            id: atomic.id,
            rowQuestionId: atomic.rowQuestionId,
            sku: candidate.number,
            skuName: String(candidate.row['name'] || candidate.row['中文全称'] || wide?.name || ''),
            sourceFile: wide?.sourceFile || '',
            rowNumber: atomic.rowNumber,
            primaryStage: atomic.primaryStage,
            secondaryNode: atomic.secondaryNode,
            question: atomic.question,
            rawQuestion: atomic.rawQuestion,
            isKeyConfirmation: !!atomic.isKeyConfirmation,
            targetAnswer: atomic.targetAnswer || '',
            priority
          });
        });
      });
    });
    return pool.sort((a, b) => b.priority - a.priority || a.rowNumber - b.rowNumber);
  }

  const WIDE_QUESTION_TOPICS = [
    ['代持还原', /代持|还原|实际权属|工商登记|股东名册/],
    ['上市合规', /上市|IPO|辅导|申报|信息披露|股权清晰/],
    ['传承接班', /传承|接班|子女|继承|遗产|遗嘱|控制权过渡/],
    ['信托角色', /信托|委托人|受托人|受益人|保护人|分配/],
    ['跨境税务', /境外|离岸|NRT|FGT|加拿大|税务居民|税务|申报/],
    ['债务风险', /债务|担保|诉讼|冻结|强制执行|撤销/],
    ['婚姻家庭', /婚姻|配偶|婚变|夫妻|家庭|家族成员/],
    ['资产条件', /资产|股权|不动产|未分配利润|估值|现金流|资金/],
    ['融资质押', /并购|融资|贷款|质押|限售股|流通股|还款/],
    ['实施约束', /期限|时间|成本|配合|审批|监管|合规|前置条件/]
  ];

  function wideQuestionTopic(item) {
    const text = `${item.primaryStage || ''} ${item.secondaryNode || ''} ${item.question || ''}`;
    return WIDE_QUESTION_TOPICS.find(([, pattern]) => pattern.test(text))?.[0] || `其他：${item.secondaryNode || item.primaryStage || '待确认'}`;
  }

  function planWideQuestionDirections(session, pool, remainingCount) {
    const covered = new Set((session.skuAnalysis.asked || []).map((item) => item.directionKey).filter(Boolean));
    const groups = new Map();
    pool.forEach((item) => {
      const topic = wideQuestionTopic(item);
      if (covered.has(topic)) return;
      const group = groups.get(topic) || { topic, items: [], skus: new Set(), score: 0 };
      group.items.push(item);
      group.skus.add(item.sku);
      group.score = Math.max(group.score, item.priority) + (item.isKeyConfirmation ? 2 : 0);
      groups.set(topic, group);
    });
    const planned = Array.from(groups.values())
      .map((group) => ({
        directionKey: group.topic,
        purpose: group.skus.size > 1 ? '区分多个候选 SKU 并核验共同关键条件' : '核验候选 SKU 的关键适格条件',
        score: group.score + group.skus.size * 10,
        candidateSkus: Array.from(group.skus),
        sourceIds: group.items.slice(0, 8).map((item) => item.id)
      }))
      .sort((a, b) => b.score - a.score || a.directionKey.localeCompare(b.directionKey))
      .slice(0, remainingCount);
    session.skuAnalysis.plan = planned;
    return planned;
  }

  function normalizedBigrams(value) {
    const text = normalizeQuestionText(value);
    const result = new Set();
    for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
    return result;
  }

  function claimSupportedBySources(claimText, sources) {
    const claimPairs = normalizedBigrams(claimText);
    if (!claimPairs.size) return false;
    const sourcePairs = normalizedBigrams(sources.map((item) => item.question).join(' '));
    let overlap = 0;
    claimPairs.forEach((pair) => { if (sourcePairs.has(pair)) overlap += 1; });
    return overlap >= 2 || overlap / claimPairs.size >= 0.22;
  }

  function conciseWideClause(value) {
    const text = String(value || '')
      .replace(/【[^】]*】/g, '')
      .replace(/^\d+[.、]\s*/, '')
      .replace(/[？?]+$/g, '')
      .trim();
    const first = text.split(/[；;]/)[0].trim();
    return first.length > 72 ? `${first.slice(0, 72)}…` : first;
  }

  function localComposeWideQuestion(direction, directionPool, fullPool) {
    const ranked = [...directionPool, ...fullPool.filter((item) => !directionPool.some((own) => own.id === item.id))];
    const selected = [];
    ranked.forEach((item) => {
      if (selected.length >= 3) return;
      if (selected.some((picked) => picked.id === item.id || normalizeQuestionText(picked.question) === normalizeQuestionText(item.question))) return;
      if (selected.length && selected.every((picked) => picked.sku === item.sku) && ranked.some((candidate) => candidate.sku !== item.sku)) return;
      selected.push(item);
    });
    while (selected.length < 2) {
      const extra = ranked.find((item) => !selected.some((picked) => picked.id === item.id));
      if (!extra) break;
      selected.push(extra);
    }
    if (selected.length < 2) throw new Error('可信问题池不足以组合生成问题');
    const clauses = selected.slice(0, 3).map((item) => conciseWideClause(item.question)).filter(Boolean);
    const first = clauses[0];
    const rest = clauses.slice(1).map((item) => `同时，${item}`).join('；');
    return {
      displayQuestion: `为了判断“${direction.directionKey}”相关 SKU 是否适格，请确认：${first}；${rest}？`,
      sourceIds: selected.map((item) => item.id),
      claims: selected.map((item) => ({ text: conciseWideClause(item.question), sourceIds: [item.id] })),
      reason: `本地证据锁定组题：${direction.purpose}`
    };
  }

  async function selectWideQuestionWithAI(session, candidates, pool, direction) {
    const payload = pool.map((item) => ({
      id: item.id,
      sku: item.sku,
      sku_name: item.skuName,
      node: item.secondaryNode,
      original_question: item.question,
      key: item.isKeyConfirmation,
      target_answer: item.targetAnswer
    }));
    const result = await callDeepSeekJSON([
      {
        role: 'system',
        content: '你是朝曦家办SKU宽表证据锁定组题器。必须从给定的BU审核C列问题池中选择2到3条原题，提取它们的判断点，去重、组合并重写成一个面向销售的自然问题。展示问题不必与原题文字相同，但不得增加来源原题中不存在的适格条件。每个判断点都必须列出支持它的source_ids，且所有ID必须来自问题池。问题应高信息量但一次只围绕一个必问方向。只返回JSON：{"question":"动态组合重写后的一个问题","source_ids":["SKU-R2-P1","SKU-R5-P1"],"claims":[{"text":"问题中的判断点","source_ids":["SKU-R2-P1"]}],"reason":"为什么这是当前必须问的问题"}'
      },
      {
        role: 'user',
        content: `本轮必问方向：${JSON.stringify(direction)}\n客户画像：${profileSummary(session)}\n已确认痛点：${JSON.stringify(session.pains)}\n当前候选：${JSON.stringify(candidates.slice(0, 5).map((item) => ({ number: item.number, score: item.score, origins: item.origins })))}\n已完成问答：${JSON.stringify(session.skuAnalysis.answers)}\nBU审核C列问题池：${JSON.stringify(payload)}`
      }
    ], 2);
    const sourceIds = Array.isArray(result.source_ids) ? Array.from(new Set(result.source_ids.map(String))) : [];
    const poolIds = new Set(pool.map((item) => item.id));
    const claims = Array.isArray(result.claims) ? result.claims.map((claim) => ({
      text: String(claim.text || '').trim(),
      sourceIds: Array.isArray(claim.source_ids) ? Array.from(new Set(claim.source_ids.map(String))) : []
    })) : [];
    const sourceMap = new Map(pool.map((item) => [item.id, item]));
    const question = String(result.question || '').trim();
    const invalidClaims = claims.some((claim) => !claim.text || !claim.sourceIds.length
      || claim.sourceIds.some((id) => !sourceIds.includes(id) || !poolIds.has(id))
      || !claimSupportedBySources(claim.text, claim.sourceIds.map((id) => sourceMap.get(id)).filter(Boolean))
      || !claimSupportedBySources(claim.text, [{ question }]));
    const unusedSource = sourceIds.some((id) => !claims.some((claim) => claim.sourceIds.includes(id)));
    const questionUnsupported = !claimSupportedBySources(question, sourceIds.map((id) => sourceMap.get(id)).filter(Boolean));
    const duplicatesRawQuestion = pool.some((item) => normalizeQuestionText(item.question) === normalizeQuestionText(question));
    if (!question || sourceIds.length < 2 || sourceIds.length > 3 || sourceIds.some((id) => !poolIds.has(id))
      || !claims.length || invalidClaims || unusedSource || questionUnsupported || duplicatesRawQuestion || (question.match(/[？?]/g) || []).length > 2) {
      throw new Error('模型生成的问题无法完整追溯到宽表 C 列');
    }
    return { displayQuestion: question, sourceIds, claims, reason: String(result.reason || '') };
  }

  const SKU_RECOMMENDER_SYSTEM_PROMPT = '你是一名专业的"高净值客户非金融服务产品推荐智能体"，专注于为高净值客户、企业家客户识别并推荐合规、税务、架构、信托、身份规划等非金融服务解决方案。你的任务：根据已为客户匹配的潜在适格SKU，从其宽表"从家办角度（核心确认问题）"字段中定位关键确认问题（尤其是标注【★关键确认项】的问题），结合客户KYC与痛点，动态生成5个带选项的关键确认问题，用于进一步引导客户明确SKU需求。要求：①每个问题清晰、可直接回答，体现法税/架构专业度，不得空泛；②每题提供3~4个覆盖常见情形的选项，可含"其他"；③若【客户情况】已明确回答某关键确认问题则跳过该问题；④问题排序体现优先级（最可能影响方案选择的靠前）；⑤所有问题必须来源于给定的SKU宽表问题池，不得编造池外的适格条件。你不得假设、不诱导，输出需专业、中立、可解释。';

  async function buildSkuQuestionPlan(session, candidates) {
    const pool = buildWideQuestionPool(session, candidates);
    if (pool.length < 3) throw new Error('候选SKU宽表问题不足以组题');
    const seen = new Set();
    const ranked = [];
    pool.forEach((item) => {
      const norm = normalizeQuestionText(item.question);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      ranked.push(item);
    });
    const poolMap = new Map(ranked.map((item) => [item.id, item]));
    const payload = ranked.slice(0, 30).map((item) => ({
      id: item.id,
      sku: item.sku,
      sku_name: item.skuName,
      key_confirmation: item.isKeyConfirmation,
      question: item.rawQuestion || item.question,
      target_answer: item.targetAnswer || ''
    }));
    const skuNames = candidates.slice(0, 3).map((item) => `${item.number} ${String(item.row['name'] || item.row['中文全称'] || '')}`.trim());
    const painBrief = session.pains.map((pain) => `${pain.code}:${pain.title}（核心冲突:${pain.conflict || '—'}）`).join('；');
    const result = await callDeepSeekJSON([
      { role: 'system', content: SKU_RECOMMENDER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `【客户情况】\n${profileSummary(session)}\n\n【潜在痛点】\n${painBrief || '暂无'}\n\n【潜在适格SKU】\n${skuNames.join('\n') || '暂无'}\n\n【SKU宽表关键确认问题池】（key_confirmation=true 为★关键确认项，须优先）\n${JSON.stringify(payload)}\n\n请据此生成恰好5个带选项的关键确认问题。只返回JSON，不要输出代码块：{"questions":[{"question":"问题文本","options":["选项A","选项B","选项C"],"source_ids":["SKU-..","..."]}]}。要求：questions长度恰好5；每题options长度3到5；每题source_ids必须全部来自问题池的id字段，且至少1个；问题须体现专业度并可直接勾选。`
      }
    ], 2);
    const questions = Array.isArray(result.questions) ? result.questions : [];
    if (questions.length !== 5) throw new Error('SKU确认问题数量不为5');
    return questions.map((item) => {
      const question = String(item.question || '').trim();
      const options = Array.isArray(item.options) ? item.options.map((opt) => String(opt || '').trim()).filter(Boolean) : [];
      if (!question || options.length < 3) throw new Error('SKU确认问题内容不完整');
      const sourceIds = Array.isArray(item.source_ids) ? Array.from(new Set(item.source_ids.map(String))).filter((id) => poolMap.has(id)) : [];
      if (!sourceIds.length) throw new Error('SKU确认问题无法追溯到宽表问题池');
      const sources = sourceIds.map((id) => poolMap.get(id)).filter(Boolean);
      return { question, options, sourceIds, sources };
    });
  }

  function createPlannedSkuQuestion(session, planItem, step) {
    const id = `guided-sku_confirmation-${step}-${Date.now()}`;
    const options = planItem.options.map((label, index) => optionRecord(`${id}-${index + 1}`, label.length > 26 ? `${label.slice(0, 25)}…` : label, label));
    options.push(optionRecord(`${id}-unknown`, '不清楚，需要核查', '当前信息不清楚，需要进一步核查', '', { exclusive: true }));
    options.push(optionRecord(`${id}-other`, OTHER_OPTION_LABEL, '存在其他需要补充的客户事实', '', { requiresText: true }));
    const record = {
      step,
      displayQuestion: planItem.question,
      sourceIds: planItem.sourceIds || [],
      sources: planItem.sources || [],
      claims: [],
      reason: 'SKU宽表关键确认项组题',
      directionKey: 'SKU关键确认',
      candidateSnapshot: session.skuAnalysis.candidates,
      askedAt: nowIso()
    };
    session.skuAnalysis.lastQuestion = record;
    session.skuAnalysis.asked.push(record);
    session.flow.askedQuestions.push(record.displayQuestion);
    return {
      id,
      stage: 'SKU_CONFIRMATION',
      step,
      displayQuestion: planItem.question,
      originalQuestion: planItem.question,
      sourceIds: planItem.sourceIds || [],
      sources: planItem.sources || [],
      directionKey: 'SKU关键确认',
      options,
      draftOptionIds: [],
      otherText: '',
      createdAt: nowIso()
    };
  }

  async function addPlannedSkuQuestion(session, step, intro = '') {
    const planItem = session.skuQuestionPlan && session.skuQuestionPlan[step - 1];
    if (!planItem) throw new Error('SKU确认问题计划缺失');
    const question = createPlannedSkuQuestion(session, planItem, step);
    return addMessage('assistant', intro, 'guided-question', { stage: 'SKU_CONFIRMATION', step, question }, session.id);
  }

  async function enterSkuConfirmation(session) {
    session.stage = 'SKU_CONFIRMATION';
    session.skuAnalysis = emptySkuAnalysis();
    session.flow.skuStep = 1;
    const intro = '痛点已经形成第一版判断。接下来会围绕候选 SKU 的关键确认项完成 5 轮快捷确认；可直接勾选，无需输入长段文字。';
    await addMessage('assistant', '已定位优先痛点。接下来我会据此从候选 SKU 的宽表中生成 5 个适配确认问题，请稍候（约需数秒）…', 'text', null, session.id);
    showTyping();
    const candidates = skuCandidates(session);
    persistSkuCandidateSnapshot(session, candidates);
    try {
      session.skuQuestionPlan = await buildSkuQuestionPlan(session, candidates);
      await addPlannedSkuQuestion(session, 1, intro);
    } catch (error) {
      console.warn('SKU确认问题组生成失败，使用本地逐题兜底：', error.message);
      session.skuQuestionPlan = null;
      const question = await prepareNextSkuQuestion(session, 1);
      await addGuidedQuestion(session, 'SKU_CONFIRMATION', 1, question, intro, session.skuAnalysis.lastQuestion);
    }
  }

  async function prepareNextSkuQuestion(session, step) {
    const candidates = skuCandidates(session);
    if (!candidates.length) throw new Error('15 个测试 SKU 未能与知识卡片建立对应关系');
    persistSkuCandidateSnapshot(session, candidates);
    const pool = buildWideQuestionPool(session, candidates);
    if (!pool.length) throw new Error('候选 SKU 的宽表 C 列已没有可继续询问的问题');
    const remainingCount = Math.max(1, 6 - step);
    const plan = planWideQuestionDirections(session, pool, remainingCount);
    const direction = plan[0] || { directionKey: '关键适格条件', purpose: '核验当前候选', sourceIds: pool.slice(0, 8).map((item) => item.id) };
    const directionIds = new Set(direction.sourceIds || []);
    const directionPool = pool.filter((item) => directionIds.has(item.id));
    const generationPool = directionPool.length >= 2
      ? directionPool.slice(0, 24)
      : [...directionPool, ...pool.filter((item) => !directionIds.has(item.id))].slice(0, 24);
    let selected;
    try {
      selected = await selectWideQuestionWithAI(session, candidates, generationPool, direction);
    } catch (error) {
      console.warn('动态问题提炼失败，使用本地证据锁定组题器：', error.message);
      selected = localComposeWideQuestion(direction, directionPool, generationPool);
    }
    const sourceMap = new Map(generationPool.map((item) => [item.id, item]));
    const record = {
      step,
      displayQuestion: selected.displayQuestion,
      sourceIds: selected.sourceIds,
      sources: selected.sourceIds.map((id) => sourceMap.get(id)).filter(Boolean),
      claims: selected.claims || [],
      reason: selected.reason,
      directionKey: direction.directionKey,
      remainingPlan: plan,
      candidateSnapshot: session.skuAnalysis.candidates,
      askedAt: nowIso()
    };
    session.skuAnalysis.lastQuestion = record;
    session.skuAnalysis.asked.push(record);
    session.flow.askedQuestions.push(record.displayQuestion);
    return SHOW_SKU_QUESTION_IDS
      ? `${record.displayQuestion}\n\n问题ID：${record.sourceIds.join(' + ')}`
      : record.displayQuestion;
  }

  function answerPolarity(text) {
    const source = String(text || '').trim();
    if (/^(不是|否|没有|不可以|不能|不愿意|不接受)|不存在|未曾|尚未/.test(source)) return 'negative';
    if (/^(是|对|有|可以|能|愿意|接受|已经)|确实|没问题/.test(source)) return 'positive';
    return 'unknown';
  }

  async function evaluateSkuAnswerWithAI(session, questionRecord, answer) {
    const affected = Array.from(new Set(questionRecord.sources.map((item) => item.sku)));
    const result = await callDeepSeekJSON([
      {
        role: 'system',
        content: '你是SKU适格性核验器。根据客户回答和宽表C列原始问题，逐个判断受影响SKU为satisfied、conflict或unknown。不得评价未列出的SKU，不得补充客户未说的信息。只返回JSON：{"evaluations":[{"number":"SKU编号","status":"satisfied|conflict|unknown","evidence":"客户原话中的依据","reason":"与原始问题或目标答案的关系"}]}'
      },
      {
        role: 'user',
        content: `展示问题：${questionRecord.displayQuestion}\n原始来源：${JSON.stringify(questionRecord.sources)}\n客户回答：${answer}\n受影响SKU：${JSON.stringify(affected)}`
      }
    ], 2);
    const allowed = new Set(affected);
    return (Array.isArray(result.evaluations) ? result.evaluations : [])
      .filter((item) => allowed.has(String(item.number)) && ['satisfied', 'conflict', 'unknown'].includes(String(item.status)))
      .map((item) => ({ number: String(item.number), status: String(item.status), evidence: String(item.evidence || answer), reason: String(item.reason || '') }));
  }

  async function recordSkuAnswer(session, answer) {
    const questionRecord = session.skuAnalysis.lastQuestion;
    if (!questionRecord) return;
    let evaluations = [];
    try {
      evaluations = await evaluateSkuAnswerWithAI(session, questionRecord, answer);
    } catch (error) {
      console.warn('SKU回答核验失败，使用目标答案本地判断：', error.message);
    }
    if (!evaluations.length) {
      const polarity = answerPolarity(answer);
      evaluations = Array.from(new Set(questionRecord.sources.map((item) => item.sku))).map((number) => {
        const sources = questionRecord.sources.filter((item) => item.sku === number);
        const target = sources.map((item) => item.targetAnswer).find(Boolean) || '';
        let status = 'unknown';
        if (target && polarity !== 'unknown') {
          const expectsNegative = /否|不是|没有|不需要|不属于/.test(target);
          status = (polarity === 'negative') === expectsNegative ? 'satisfied' : 'conflict';
        }
        return { number, status, evidence: answer, reason: target ? `本地按目标答案“${target}”核验` : '回答需进一步人工判断' };
      });
    }
    evaluations.forEach((item) => {
      const current = session.skuAnalysis.evaluations[item.number] || { score: 0, history: [] };
      const delta = item.status === 'satisfied' ? 10 : item.status === 'conflict' ? -18 : 0;
      current.score = Math.max(-80, Math.min(60, Number(current.score || 0) + delta));
      current.history = Array.isArray(current.history) ? current.history : [];
      current.history.push({
        step: questionRecord.step,
        status: item.status,
        evidence: item.evidence,
        reason: item.reason,
        sourceIds: questionRecord.sourceIds,
        answeredAt: nowIso()
      });
      session.skuAnalysis.evaluations[item.number] = current;
    });
    session.skuAnalysis.answers.push({
      step: questionRecord.step,
      question: questionRecord.displayQuestion,
      sourceIds: questionRecord.sourceIds,
      answer: String(answer || ''),
      evaluations,
      answeredAt: nowIso()
    });
    session.skuAnalysis.lastQuestion = null;
    persistSkuCandidateSnapshot(session, skuCandidates(session));
  }

  async function selectSkusWithAI(session, candidates) {
    const payload = candidates.map((item) => ({
      number: item.number,
      name: String(item.row['name'] || item.row['中文全称'] || ''),
      score: Number(item.score.toFixed(2)),
      origins: item.origins,
      definition: stripHtml(item.row['定义']),
      prerequisite: stripHtml(item.row['必备前置条件']),
      risk: stripHtml(item.row['不适用场景/风险提示']),
      related: stripHtml(item.row['关联SKU']),
      five_question_evidence: item.evaluation.history || []
    }));
    const result = await callDeepSeekJSON([
      {
        role: 'system',
        content: '你是朝曦家办SKU适配专家。最终推荐可以脱离痛点最初关联SKU，必须以客户画像、五问证据、前置条件和风险为准。只能从15个测试候选中选择0到3个主SKU，不得发明编号；冲突证据明显时不得强推。related_skus只能引用候选知识卡片已有的关联SKU。只返回JSON：{"selections":[{"number":"Legal-0000","reason":"画像与五问证据","fit":"强匹配|条件匹配","condition":"仍需线下确认的条件","related_skus":"辅助SKU"}]}'
      },
      {
        role: 'user',
        content: `客户画像：${profileSummary(session)}\n已确认痛点：${JSON.stringify(session.pains)}\n五轮问答：${JSON.stringify(session.skuAnalysis.answers)}\n15个测试SKU：${JSON.stringify(payload)}`
      }
    ], 2);
    return Array.isArray(result.selections) ? result.selections : [];
  }

  function normalizeSkuKey(value) {
    return String(value || '').replace(/[\s-]/g, '').toLowerCase();
  }

  function skuSopRecord(number, name) {
    if (!skuSopBank?.skus?.length) return null;
    const target = normalizeSkuKey(number);
    const targetName = normalizeSkuKey(name);
    return skuSopBank.skus.find((rec) => {
      const keys = [rec.sku_id, rec.sku_name, ...(Array.isArray(rec.aliases) ? rec.aliases : [])].map(normalizeSkuKey);
      return keys.includes(target) || (targetName && keys.includes(targetName));
    }) || null;
  }

  function dedupeStrings(list) {
    const seen = new Set();
    const out = [];
    list.forEach((raw) => {
      const value = String(raw || '').trim();
      if (!value) return;
      const key = value.replace(/[\s，,。；;、]/g, '');
      if (seen.has(key)) return;
      seen.add(key);
      out.push(value);
    });
    return out;
  }

  // 依据落地 SOP 库的 A列(一级阶段)/B列(二级阶段)/E列(客户配合事项) + G列(供应商牌照与职责)，
  // 将多个适格 SKU 综合成"供应商 SOP"：按阶段/步骤归并、客户配合与供应商职责逐步对应、重复项去重清洗。
  function buildCombinedSop(items) {
    const matched = [];
    const missing = [];
    items.forEach((item) => {
      const rec = skuSopRecord(item.number, item.name);
      if (rec) matched.push({ item, rec, supplierRec: supplierRecord(item.number, item.name) });
      else missing.push(item);
    });
    if (!matched.length) return null;

    // primaryStage -> { stage, order, nodes: Map(node -> {node, cooperation:[], suppliers:Map(type->{type,category,duties:[]}), skus:Set}) }
    const stageMap = new Map();
    const ensureNode = (stage, order, node) => {
      const stageKey = String(stage || '').trim() || '其他阶段';
      const nodeKey = String(node || '').trim() || '（未命名步骤）';
      if (!stageMap.has(stageKey)) stageMap.set(stageKey, { stage: stageKey, order: Number(order || 999), nodes: new Map() });
      const stageEntry = stageMap.get(stageKey);
      stageEntry.order = Math.min(stageEntry.order, Number(order || 999));
      if (!stageEntry.nodes.has(nodeKey)) stageEntry.nodes.set(nodeKey, { node: nodeKey, cooperation: [], suppliers: new Map(), skus: new Set() });
      return stageEntry.nodes.get(nodeKey);
    };

    matched.forEach(({ item, rec, supplierRec }) => {
      (rec.rows || []).forEach((row) => {
        const nodeEntry = ensureNode(row.primary_stage, row.stage_order, row.secondary_node);
        const actions = Array.isArray(row.actions) && row.actions.length
          ? row.actions
          : String(row.client_cooperation || '').split(/[；;]/);
        actions.forEach((action) => nodeEntry.cooperation.push(action));
        nodeEntry.skus.add(item.number);
      });
      // 把宽表 G 列供应商职责挂到对应的一二级步骤上
      (supplierRec?.rows || []).forEach((row) => {
        const entries = Array.isArray(row.supplier_entries) ? row.supplier_entries : [];
        if (!entries.length) return;
        const nodeEntry = ensureNode(row.primary_stage, row.stage_order, row.secondary_node);
        nodeEntry.skus.add(item.number);
        entries.forEach((entry) => {
          const type = String(entry.supplier || '').trim();
          if (!type) return;
          if (!nodeEntry.suppliers.has(type)) nodeEntry.suppliers.set(type, { type, category: supplierLicenseCategory(type), duties: [] });
          const duty = String(entry.duty || entry.prompt || '').replace(/<br\s*\/?>/gi, ' ／ ').replace(/\s+/g, ' ').trim();
          if (duty) nodeEntry.suppliers.get(type).duties.push(duty);
        });
      });
    });

    const stages = Array.from(stageMap.values())
      .sort((a, b) => a.order - b.order || a.stage.localeCompare(b.stage))
      .map((stageEntry) => ({
        stage: stageEntry.stage,
        nodes: Array.from(stageEntry.nodes.values()).map((nodeEntry) => ({
          node: nodeEntry.node,
          cooperation: dedupeStrings(nodeEntry.cooperation),
          suppliers: Array.from(nodeEntry.suppliers.values()).map((sup) => ({
            type: sup.type,
            category: sup.category,
            duties: dedupeStrings(sup.duties)
          })),
          skus: Array.from(nodeEntry.skus)
        }))
      }));

    const clientTasks = dedupeStrings(
      matched.flatMap(({ rec }) => (rec.rows || []).flatMap((row) =>
        Array.isArray(row.actions) && row.actions.length ? row.actions : String(row.client_cooperation || '').split(/[；;]/)
      ))
    );

    // 供应商牌照总览（按类别归并去重，作为底部汇总）
    const supplierCombined = buildCombinedSuppliers(items);

    return {
      skuList: matched.map(({ item }) => ({ number: item.number, name: item.name })),
      combined: matched.length > 1,
      stages,
      clientTasks,
      supplierCategories: supplierCombined ? supplierCombined.categories : [],
      missing: missing.map((item) => ({ number: item.number, name: item.name }))
    };
  }

  function skuSopCardHtml(message) {
    const sop = message.data?.sop;
    if (!sop) return '';
    const totalNodes = sop.stages.reduce((n, s) => n + s.nodes.length, 0);
    const header = sop.combined
      ? `已合并 ${sop.skuList.length} 个适格 SKU 的落地步骤（${sop.stages.length} 个阶段 / ${totalNodes} 个步骤，重复项已去重）`
      : `适格 SKU 方案落地步骤（${sop.stages.length} 个阶段 / ${totalNodes} 个步骤）`;
    const skuTags = sop.skuList.map((item) => `<span>${escapeHtml(item.number)} · ${escapeHtml(item.name)}</span>`).join('');
    const showSku = sop.combined;
    let seq = 0;
    const rowsHtml = sop.stages.map((stage) => stage.nodes.map((node, ni) => {
      seq += 1;
      const stageCell = ni === 0
        ? `<td class="ca-sop-stagecell" rowspan="${stage.nodes.length}">${escapeHtml(String(stage.stage).replace(/^\s*\d+[.、\s]*/, ''))}</td>`
        : '';
      const coop = node.cooperation.length
        ? `<ul class="ca-sop-td-list">${node.cooperation.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
        : '<span class="ca-sop-td-none">本步骤无需客户额外配合</span>';
      return `<tr>
        <td class="ca-sup-idx">${seq}</td>
        ${stageCell}
        <td><b>${escapeHtml(node.node)}</b></td>
        <td>${coop}</td>
        ${showSku ? `<td class="ca-sup-src">${node.skus.map((n) => escapeHtml(n)).join('<br>')}</td>` : ''}
      </tr>`;
    }).join('')).join('');
    const missingHtml = sop.missing.length
      ? `<div class="ca-sop-missing">以下 SKU 暂无落地步骤记录，需线下补充：${sop.missing.map((item) => escapeHtml(`${item.number} ${item.name}`)).join('、')}</div>`
      : '';
    return `<div class="ca-message assistant"><div class="ca-avatar">朝</div><div class="ca-message-body ca-sop-message">
      <div class="ca-sop-card">
        <div class="ca-card-head"><h3>方案落地步骤</h3><span>${escapeHtml(header)}</span></div>
        <div class="ca-sop-skus">${skuTags}</div>
        <div class="ca-supsum-tablewrap">
          <table class="ca-supsum-table ca-soptable">
            <thead><tr><th>#</th><th>一级阶段</th><th>二级步骤</th><th>客户需配合事项</th>${showSku ? '<th>来源SKU</th>' : ''}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        ${missingHtml}
      </div>
      <div class="ca-message-meta">${escapeHtml(formatTime(message.createdAt))}</div>
    </div></div>`;
  }

  async function presentSkuSop(session) {
    if (!Array.isArray(session.skus) || !session.skus.length) return;
    const sop = buildCombinedSop(session.skus);
    if (!sop) {
      await addMessage('assistant', '当前适格 SKU 暂无可展示的方案落地步骤记录，建议结合线下方案手册补充。', 'text', null, session.id);
      return;
    }
    const intro = sop.combined
      ? '已根据以上适格 SKU 合并出统一的方案落地步骤（一级阶段 / 二级步骤 / 客户需配合事项），重复项已去重清洗，供客户经理直接推进。'
      : '以下是该适格 SKU 的方案落地步骤（一级阶段 / 二级步骤 / 客户需配合事项），供客户经理直接推进。';
    await addMessage('assistant', intro, 'text', null, session.id);
    await addMessage('assistant', '', 'sku-sop', { sop }, session.id);
  }

  function supplierRecord(number, name) {
    if (!skuSupplierBank?.skus?.length) return null;
    const target = normalizeSkuKey(number);
    const targetName = normalizeSkuKey(name);
    return skuSupplierBank.skus.find((rec) => {
      const keys = [rec.sku_id, rec.sku_name, ...(Array.isArray(rec.aliases) ? rec.aliases : [])].map(normalizeSkuKey);
      return keys.includes(target) || (targetName && keys.includes(targetName));
    }) || null;
  }

  // 依据宽表 G 列，将供应商映射到其牌照/资质类别（银行、信托、律所、税所、保险、券商等）。
  function supplierLicenseCategory(type) {
    const t = String(type || '');
    if (/律师|律所|法律顾问|法务/.test(t)) return '律所';
    if (/会计|审计/.test(t)) return '会计师事务所';
    if (/税/.test(t)) return '税所';
    if (/银行|监管账户|保管机构/.test(t)) return '银行';
    if (/信托/.test(t)) return '信托公司';
    if (/券商|证券|保荐/.test(t)) return '券商';
    if (/保险/.test(t)) return '保险公司';
    if (/评估/.test(t)) return '评估机构';
    if (/公证|见证/.test(t)) return '公证机构';
    if (/移民/.test(t)) return '移民服务机构';
    return '其他专业机构';
  }

  const SUPPLIER_CATEGORY_ORDER = ['银行', '信托公司', '券商', '保险公司', '律所', '税所', '会计师事务所', '评估机构', '公证机构', '移民服务机构', '其他专业机构'];

  // 依据宽表 G 列，动态组合多个适格 SKU 涉及的供应商牌照与工作内容，重复项去重清洗。
  function buildCombinedSuppliers(items) {
    const matched = [];
    const missing = [];
    items.forEach((item) => {
      const rec = supplierRecord(item.number, item.name);
      if (rec) matched.push({ item, rec });
      else missing.push(item);
    });
    if (!matched.length) return null;

    const catMap = new Map(); // category -> Map(supplierType -> { duties:[], skus:Set })
    matched.forEach(({ item, rec }) => {
      (rec.rows || []).forEach((row) => {
        (row.supplier_entries || []).forEach((entry) => {
          const type = String(entry.supplier || '').trim();
          if (!type) return;
          const cat = supplierLicenseCategory(type);
          if (!catMap.has(cat)) catMap.set(cat, new Map());
          const subMap = catMap.get(cat);
          if (!subMap.has(type)) subMap.set(type, { duties: [], skus: new Set() });
          const bucket = subMap.get(type);
          const duty = String(entry.duty || entry.prompt || '').replace(/<br\s*\/?>/gi, ' ／ ').replace(/\s+/g, ' ').trim();
          if (duty) bucket.duties.push(duty);
          bucket.skus.add(item.number);
        });
      });
    });

    const categories = Array.from(catMap.entries())
      .map(([category, subMap]) => ({
        category,
        suppliers: Array.from(subMap.entries())
          .map(([type, bucket]) => ({ type, duties: dedupeStrings(bucket.duties), skus: Array.from(bucket.skus) }))
          .sort((a, b) => b.duties.length - a.duties.length || a.type.localeCompare(b.type))
      }))
      .sort((a, b) => {
        const ia = SUPPLIER_CATEGORY_ORDER.indexOf(a.category);
        const ib = SUPPLIER_CATEGORY_ORDER.indexOf(b.category);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.category.localeCompare(b.category);
      });

    return {
      skuList: matched.map(({ item }) => ({ number: item.number, name: item.name })),
      combined: matched.length > 1,
      categories,
      missing: missing.map((item) => ({ number: item.number, name: item.name }))
    };
  }

  function supplierCardHtml(message) {
    const data = message.data?.suppliers;
    if (!data) return '';
    const header = data.combined
      ? `已为 ${data.skuList.length} 个适格 SKU 动态组合供应商协作清单（重复职责已去重）`
      : '适格 SKU 供应商协作清单';
    const skuTags = data.skuList.map((item) => `<span>${escapeHtml(item.number)} · ${escapeHtml(item.name)}</span>`).join('');
    const catsHtml = data.categories.map((cat) => `<div class="ca-supplier-cat">
      <div class="ca-supplier-cat-head"><span class="ca-supplier-badge">牌照/资质</span>${escapeHtml(cat.category)}</div>
      ${cat.suppliers.map((sup) => `<div class="ca-supplier-node">
        <div class="ca-supplier-node-title">${escapeHtml(sup.type)}${sup.skus.length > 1 || data.combined ? `<em>${sup.skus.map((n) => escapeHtml(n)).join(' / ')}</em>` : ''}</div>
        ${sup.duties.length ? `<ul class="ca-supplier-duties">${sup.duties.map((duty) => `<li>${escapeHtml(duty)}</li>`).join('')}</ul>` : '<div class="ca-supplier-duty-empty">具体职责待线下明确</div>'}
      </div>`).join('')}
    </div>`).join('');
    const missingHtml = data.missing.length
      ? `<div class="ca-sop-missing">以下 SKU 暂无供应商记录，需线下补充：${data.missing.map((item) => escapeHtml(`${item.number} ${item.name}`)).join('、')}</div>`
      : '';
    return `<div class="ca-message assistant"><div class="ca-avatar">朝</div><div class="ca-message-body ca-sop-message">
      <div class="ca-sop-card ca-supplier-card">
        <div class="ca-card-head"><h3>供应商协作清单</h3><span>${escapeHtml(header)}</span></div>
        <div class="ca-sop-skus">${skuTags}</div>
        ${catsHtml}
        ${missingHtml}
      </div>
      <div class="ca-message-meta">${escapeHtml(formatTime(message.createdAt))}</div>
    </div></div>`;
  }

  // ===== 供应商需配合事项提炼总结表（宽表第二个 sheet，表格化展示） =====
  function supplierSummaryRecord(number, name) {
    if (!skuSupplierSummaryBank?.skus?.length) return null;
    const target = normalizeSkuKey(number);
    const targetName = normalizeSkuKey(name);
    return skuSupplierSummaryBank.skus.find((rec) => {
      const keys = [rec.sku_id, rec.sku_name, ...(Array.isArray(rec.aliases) ? rec.aliases : [])].map(normalizeSkuKey);
      return keys.includes(target) || (targetName && keys.includes(targetName));
    }) || null;
  }

  // 多个适格 SKU 时合并成一张表：按「供应商类别+主要配合事项」去重，并标注来源 SKU
  function buildSupplierSummary(items) {
    const matched = [];
    const missing = [];
    items.forEach((item) => {
      const rec = supplierSummaryRecord(item.number, item.name);
      if (rec) matched.push({ item, rec });
      else missing.push(item);
    });
    if (!matched.length) return null;
    const map = new Map();
    matched.forEach(({ item, rec }) => {
      (rec.rows || []).forEach((row) => {
        const category = String(row.category || '').trim();
        const duties = String(row.duties || '').trim();
        if (!category && !duties) return;
        const key = `${category}||${duties}`.replace(/[\s，,。；;、]/g, '');
        if (!map.has(key)) {
          map.set(key, { category, stages: String(row.stages || '').trim(), role: String(row.role || '').trim(), duties, skus: new Set() });
        }
        map.get(key).skus.add(item.number);
      });
    });
    const rows = Array.from(map.values()).map((r) => ({ ...r, skus: Array.from(r.skus) }));
    return {
      skuList: matched.map(({ item }) => ({ number: item.number, name: item.name })),
      combined: matched.length > 1,
      rows,
      missing: missing.map((item) => ({ number: item.number, name: item.name }))
    };
  }

  function supplierSummaryCardHtml(message) {
    const data = message.data?.summary;
    if (!data) return '';
    const header = data.combined
      ? `已合并 ${data.skuList.length} 个适格 SKU 的供应商配合事项（重复项已去重）`
      : '适格 SKU 供应商需配合事项';
    const skuTags = data.skuList.map((item) => `<span>${escapeHtml(item.number)} · ${escapeHtml(item.name)}</span>`).join('');
    const showSku = data.combined;
    const rowsHtml = data.rows.map((r, i) => `<tr>
      <td class="ca-sup-idx">${i + 1}</td>
      <td><b>${escapeHtml(r.category)}</b></td>
      <td>${escapeHtml(r.stages || '—')}</td>
      <td>${escapeHtml(r.role || '—')}</td>
      <td>${escapeHtml(r.duties || '—')}</td>
      ${showSku ? `<td class="ca-sup-src">${r.skus.map((n) => escapeHtml(n)).join('<br>')}</td>` : ''}
    </tr>`).join('');
    const missingHtml = data.missing.length
      ? `<div class="ca-sop-missing">以下 SKU 暂无供应商总结表，需线下补充：${data.missing.map((item) => escapeHtml(`${item.number} ${item.name}`)).join('、')}</div>`
      : '';
    return `<div class="ca-message assistant"><div class="ca-avatar">朝</div><div class="ca-message-body ca-sop-message">
      <div class="ca-sop-card ca-supsum-card">
        <div class="ca-card-head"><h3>供应商需配合事项</h3><span>${escapeHtml(header)}</span></div>
        <div class="ca-sop-skus">${skuTags}</div>
        <div class="ca-supsum-tablewrap">
          <table class="ca-supsum-table">
            <thead><tr><th>#</th><th>供应商类别</th><th>参与阶段</th><th>角色定位</th><th>主要配合事项</th>${showSku ? '<th>来源SKU</th>' : ''}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        ${missingHtml}
      </div>
      <div class="ca-message-meta">${escapeHtml(formatTime(message.createdAt))}</div>
    </div></div>`;
  }

  // ===== 客户网页版方案：SKU 图文（源自PPT，结构化非图片）+ 落地步骤表 + 供应商表，合成单个可编辑 HTML =====
  function pptRecord(number, name) {
    if (!skuPptBank?.skus?.length) return null;
    const target = normalizeSkuKey(number);
    const targetName = normalizeSkuKey(name);
    return skuPptBank.skus.find((rec) => {
      const keys = [rec.sku_id, rec.sku_name, ...(Array.isArray(rec.aliases) ? rec.aliases : [])].map(normalizeSkuKey);
      return keys.includes(target) || (targetName && keys.includes(targetName));
    }) || null;
  }

  function planEsc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pptBlocksHtml(blocks) {
    const out = [];
    let labelRun = [];
    const flushLabels = () => {
      if (!labelRun.length) return;
      out.push(`<div class="nodes">${labelRun.map((t) => `<span class="node">${planEsc(t)}</span>`).join('')}</div>`);
      labelRun = [];
    };
    (blocks || []).forEach((b) => {
      if (b.kind === 'label') { labelRun.push(b.text); return; }
      flushLabels();
      if (b.kind === 'paragraph') {
        out.push(`<p>${planEsc(b.text).replace(/\n/g, '<br>')}</p>`);
      } else if (b.kind === 'table') {
        const head = (b.header || []).map((h) => `<th>${planEsc(h)}</th>`).join('');
        const body = (b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${planEsc(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('');
        out.push(`<div class="tablewrap"><table>${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${body}</tbody></table></div>`);
      }
    });
    flushLabels();
    return out.join('\n');
  }

  // PPT 中的关系图（有连接线/SmartArt）纯文字还原会丢失结构，改为内嵌整页图片
  const planImageCache = new Map();
  async function inlinePlanImage(path) {
    if (!path) return '';
    if (planImageCache.has(path)) return planImageCache.get(path);
    let dataUri = '';
    try {
      const res = await fetch(path, { cache: 'force-cache' });
      if (res.ok) {
        const blob = await res.blob();
        dataUri = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn('[clientplan] 图片内嵌失败', path, err);
    }
    planImageCache.set(path, dataUri);
    return dataUri;
  }

  async function prefetchPlanImages(skus) {
    const paths = [];
    (skus || []).forEach((item) => {
      const rec = pptRecord(item.number, item.name);
      (rec?.slides || []).forEach((s) => { if (s.image) paths.push(s.image); });
    });
    await Promise.all([...new Set(paths)].map(inlinePlanImage));
  }

  function slideBodyHtml(slide) {
    if (slide.image) {
      const src = planImageCache.get(slide.image) || slide.image;
      const alt = planEsc(slide.title || '方案示意图');
      // 图内表格仍以可编辑表格补充在下方，方便后续修改
      const tables = (slide.blocks || []).filter((b) => b.kind === 'table');
      const extra = tables.length ? pptBlocksHtml(tables) : '';
      return `<figure class="diagram"><img src="${src}" alt="${alt}" loading="lazy">
        <figcaption>结构示意图（如需修改请替换此图片）</figcaption></figure>${extra}`;
    }
    return pptBlocksHtml(slide.blocks);
  }

  function buildClientPlanHtml(session) {
    const skus = Array.isArray(session.skus) ? session.skus : [];
    const sop = buildCombinedSop(skus);
    const supplier = buildSupplierSummary(skus);
    const customer = session.name || '未命名客户';
    const dateStr = new Date().toLocaleDateString('zh-CN');

    // 1) SKU 图文（来自 PPT 的结构化内容）
    const skuSections = skus.map((item) => {
      const rec = pptRecord(item.number, item.name);
      const slides = rec?.slides || [];
      const body = slides.length
        ? slides.map((s) => `<section class="slide">
            ${s.title ? `<h3>${planEsc(s.title)}</h3>` : ''}
            ${slideBodyHtml(s)}
          </section>`).join('\n')
        : `<p class="muted">该 SKU 暂无图文资料，可在此自行补充。</p>`;
      return `<article class="sku">
        <div class="sku-head"><span class="code">${planEsc(item.number)}</span><h2>${planEsc(item.name)}</h2></div>
        ${item.reason ? `<p class="why"><b>为什么推荐：</b>${planEsc(item.reason)}</p>` : ''}
        ${body}
      </article>`;
    }).join('\n');

    // 2) 方案落地步骤表
    let seq = 0;
    const sopRows = sop ? sop.stages.map((stage) => stage.nodes.map((node, ni) => {
      seq += 1;
      const stageCell = ni === 0 ? `<td class="stage" rowspan="${stage.nodes.length}">${planEsc(String(stage.stage).replace(/^\s*\d+[.、\s]*/, ''))}</td>` : '';
      const coop = node.cooperation.length
        ? `<ul>${node.cooperation.map((t) => `<li>${planEsc(t)}</li>`).join('')}</ul>`
        : '<span class="muted">本步骤无需客户额外配合</span>';
      return `<tr><td class="idx">${seq}</td>${stageCell}<td><b>${planEsc(node.node)}</b></td><td>${coop}</td></tr>`;
    }).join('')).join('') : '';
    const sopHtml = sop
      ? `<div class="tablewrap"><table><thead><tr><th>#</th><th>一级阶段</th><th>二级步骤</th><th>客户需配合事项</th></tr></thead><tbody>${sopRows}</tbody></table></div>`
      : '<p class="muted">暂无落地步骤数据。</p>';

    // 3) 供应商需配合事项表
    const supHtml = supplier
      ? `<div class="tablewrap"><table><thead><tr><th>#</th><th>供应商类别</th><th>参与阶段</th><th>角色定位</th><th>主要配合事项</th></tr></thead><tbody>${
          supplier.rows.map((r, i) => `<tr><td class="idx">${i + 1}</td><td><b>${planEsc(r.category)}</b></td><td>${planEsc(r.stages || '—')}</td><td>${planEsc(r.role || '—')}</td><td>${planEsc(r.duties || '—')}</td></tr>`).join('')
        }</tbody></table></div>`
      : '<p class="muted">暂无供应商配合事项数据。</p>';

    const painList = (session.pains || []).map((p) => `<li><b>${planEsc(p.code)}</b> ${planEsc(p.title)}</li>`).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>客户方案 · ${planEsc(customer)}</title>
<style>
  :root { --navy:#183a5a; --navy2:#245477; --ink:#1f2d38; --sub:#6f7d88; --line:#dfe5e9; --bg:#f5f3ee; }
  * { box-sizing:border-box; }
  body { margin:0; padding:0; background:var(--bg); color:var(--ink);
         font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif; line-height:1.7; }
  .page { max-width:960px; margin:0 auto; padding:28px 20px 60px; }
  header.top { background:var(--navy); color:#fff; padding:26px 20px; }
  header.top .inner { max-width:960px; margin:0 auto; }
  header.top h1 { margin:0 0 6px; font-size:22px; }
  header.top .meta { font-size:12px; opacity:.85; }
  h2 { font-size:18px; color:var(--navy); margin:0; }
  h3 { font-size:15px; color:var(--navy2); margin:18px 0 8px; padding-left:10px; border-left:3px solid var(--navy2); }
  .block { background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px 20px; margin-bottom:18px; }
  .block > h2.sec { margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  .sku { background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px 20px; margin-bottom:18px; }
  .sku-head { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-bottom:6px; }
  .code { background:#eef3f6; color:var(--sub); border-radius:10px; padding:2px 8px; font-size:12px; }
  .why { background:#f7f9fa; border-radius:8px; padding:10px 12px; font-size:13px; margin:10px 0 4px; }
  .slide { padding:10px 0; border-top:1px dashed #e6ebee; }
  .slide:first-of-type { border-top:0; }
  p { margin:8px 0; font-size:13.5px; }
  .nodes { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
  .node { background:#eef4f8; color:var(--navy); border:1px solid #d7e3ec; border-radius:8px;
          padding:6px 12px; font-size:12.5px; }
  .tablewrap { overflow-x:auto; margin:12px 0; border:1px solid var(--line); border-radius:9px; background:#fff; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:560px; }
  th { background:#eef2f8; color:#2f4a6b; text-align:left; padding:9px 10px; font-size:12px;
       border-bottom:1px solid var(--line); white-space:nowrap; }
  td { padding:9px 10px; vertical-align:top; border-bottom:1px solid #f0f2f4; }
  tr:last-child td { border-bottom:0; }
  tbody tr:nth-child(even) { background:#fafbfd; }
  td.idx { width:30px; text-align:center; color:#9aa4aa; }
  td.stage { background:#f4f8fb; font-weight:600; color:var(--navy); }
  ul { margin:0; padding-left:16px; }
  li { margin:2px 0; }
  .muted { color:#9aa4aa; font-style:italic; }
  figure.diagram { margin:14px 0; padding:0; }
  figure.diagram img { display:block; width:100%; height:auto; border:1px solid var(--line);
                       border-radius:9px; background:#fff; }
  figure.diagram figcaption { margin-top:6px; text-align:center; color:#9aa4aa; font-size:11.5px; }
  footer { text-align:center; color:var(--sub); font-size:11.5px; margin-top:26px; line-height:1.8; }
  @media print { body { background:#fff; } .block,.sku,figure.diagram { break-inside:avoid; border-color:#ccc; } }
</style>
</head>
<body>
<header class="top"><div class="inner">
  <h1>客户方案建议书</h1>
  <div class="meta">客户：${planEsc(customer)} ｜ 生成日期：${planEsc(dateStr)}</div>
</div></header>
<div class="page">

  ${painList ? `<div class="block"><h2 class="sec">一、已识别的核心痛点</h2><ul>${painList}</ul></div>` : ''}

  <div class="block"><h2 class="sec">二、推荐方案（SKU）</h2>
    <p class="muted">以下内容取自各方案的图文资料，均为可直接编辑的文字与表格。</p>
  </div>
  ${skuSections || '<div class="block"><p class="muted">暂无推荐 SKU。</p></div>'}

  <div class="block"><h2 class="sec">三、方案落地步骤</h2>${sopHtml}</div>

  <div class="block"><h2 class="sec">四、供应商需配合事项</h2>${supHtml}</div>

  <footer>
    本方案由朝曦家办智能驾驶舱生成，内容供客户沟通参考；<br>
    涉及法律、税务的具体结论请以专业机构出具的正式意见为准。
  </footer>
</div>
</body>
</html>`;
  }

  async function generateClientPlanPage(session) {
    if (!Array.isArray(session.skus) || !session.skus.length) {
      toast('请先完成 SKU 适配，再生成客户网页版方案');
      return;
    }
    toast('正在生成客户网页版方案…');
    await prefetchPlanImages(session.skus);
    const html = buildClientPlanHtml(session);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const name = `客户方案_${(session.name || '未命名客户').replace(/[\\/:*?"<>|]/g, '')}_${new Date().toISOString().slice(0, 10)}.html`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    const sizeKb = Math.max(1, Math.round(blob.size / 1024));
    await addMessage('assistant', `客户网页版方案已生成并下载：**${name}**（约 ${sizeKb} KB）。\n\n该网页把「推荐 SKU 图文」「方案落地步骤表」「供应商需配合事项表」集成在一个 HTML 文件里，用浏览器可直接打开、用任意编辑器可直接修改。\n\n其中 PPT 的**文字页与表格页**已转成结构化文字和可编辑表格；**带连接线的关系结构图**（如信托架构图、股权路径图）保留为整页图片，避免拆成文字后丢失结构关系。`, 'text', null, session.id);
  }

  async function presentSuppliers(session) {
    if (!Array.isArray(session.skus) || !session.skus.length) return;
    const summary = buildSupplierSummary(session.skus);
    if (!summary) {
      await addMessage('assistant', '当前适格 SKU 暂无「供应商需配合事项提炼总结表」记录，建议结合线下资源库补充。', 'text', null, session.id);
      return;
    }
    const intro = summary.combined
      ? '已根据以上适格 SKU 的「供应商需配合事项提炼总结表」合并出下表，重复项已去重并标注来源 SKU。'
      : '以下是该适格 SKU 的「供应商需配合事项提炼总结表」。';
    await addMessage('assistant', intro, 'text', null, session.id);
    await addMessage('assistant', '', 'sku-supplier-summary', { summary }, session.id);
  }

  async function generateSkuRecommendations(session) {
    if (!skuRows.length || !skuQuestionBank?.skus?.length) throw new Error(sourceError || '测试 SKU 宽表问题库未加载');
    const candidates = skuCandidates(session);
    persistSkuCandidateSnapshot(session, candidates);
    let selections = [];
    try { selections = await selectSkusWithAI(session, candidates); }
    catch (error) { console.warn('AI SKU 排序失败，使用本地动态评分', error); }
    const candidateMap = new Map(candidates.map((item) => [item.number, item]));
    const picked = [];
    selections.forEach((selection) => {
      const candidate = candidateMap.get(String(selection.number));
      if (candidate && !picked.some((item) => item.candidate.number === candidate.number)) picked.push({ candidate, selection });
    });
    if (!picked.length) {
      candidates.filter((item) => item.score > 0 && item.answerScore > -18).slice(0, 3).forEach((candidate) => picked.push({ candidate, selection: {} }));
    }
    const items = picked.slice(0, 3).map(({ candidate, selection }) => {
      const row = candidate.row;
      const evidenceHistory = (candidate.evaluation.history || []).filter((item) => String(item.evidence || '').trim());
      const satisfied = evidenceHistory.filter((item) => item.status === 'satisfied');
      const unknown = evidenceHistory.filter((item) => item.status === 'unknown');
      return {
        number: candidate.number,
        name: String(row['name'] || row['中文全称'] || ''),
        definition: stripHtml(row['定义']),
        reason: String(selection.reason || `${candidate.origins.join('、')}形成候选；五问形成 ${evidenceHistory.length} 条相关客户证据，其中 ${satisfied.length} 项得到正向验证`),
        fit: String(selection.fit || (satisfied.length >= 2 && candidate.answerScore > 0 ? '强匹配' : '条件匹配')),
        condition: String(selection.condition || (unknown.length ? '仍有宽表条件需要线下核验' : '请结合完整材料做专业复核')),
        prerequisite: stripHtml(row['必备前置条件']),
        risk: stripHtml(row['不适用场景/风险提示']),
        related: String(selection.related_skus || stripHtml(row['关联SKU'])),
        origin: candidate.origins.join('、'),
        questionEvidence: evidenceHistory.slice(0, 3).map((item) => item.evidence).filter(Boolean)
      };
    });
    session.skus = items;
    session.stage = 'SKU_READY';
    await putRecord('recommendations', {
      id: `${session.id}-sku-v${session.recommendationVersion}`,
      sessionId: session.id,
      type: 'sku',
      version: session.recommendationVersion,
      items,
      noFit: !items.length,
      createdAt: nowIso()
    });
    await addMessage('assistant', '', 'sku-recommendation', { items, noFit: !items.length, version: session.recommendationVersion }, session.id);
    await addMessage('assistant', items.length
      ? '两阶段十问已经完成。SKU 建议已根据 15 个测试样本的宽表 C 列五问动态核验；痛点只作为初始线索，最终结果以客户适格性为准。'
      : '两阶段十问已经完成。根据当前画像与宽表五问证据，15 个测试样本中暂无足够适格的 SKU；建议补充关键材料后再评估。', 'text', null, session.id);
    if (items.length) {
      await presentSkuSop(session);
      await presentSuppliers(session);
    }
    await saveSession(session);
  }

  async function handleStageCompletion(session, result, changedKeys) {
    const reply = String(result.reply || '我已记录。');
    const messageData = changedKeys.length ? { profileSnapshot: profileSnapshot(session) } : null;

    if (session.stage === 'CASUAL') {
      const business = result.intent === 'business' || result.business_signal || changedKeys.length > 0;
      if (!business) {
        await addMessage('assistant', reply, 'text', messageData, session.id);
        return;
      }
      if (profileReady(session)) {
        await enterPainConfirmation(session, reply, messageData, '听起来这里已经涉及客户画像和业务安排，我会用 5 个快捷选择题帮助确认最可能的痛点。');
      } else {
        session.stage = 'PROFILE_GATHERING';
        const question = profileGapQuestion(session, result.suggested_question);
        session.flow.askedQuestions.push(question);
        await addMessage('assistant', `${reply}\n\n${question}`, 'text', messageData, session.id);
      }
      return;
    }

    if (session.stage === 'PROFILE_GATHERING') {
      if (profileReady(session)) {
        await enterPainConfirmation(session, reply, messageData, '客户画像已经补充得比较完整了，接下来我会用 5 个快捷选择题帮助确认最可能的痛点。');
      } else {
        const question = profileGapQuestion(session, result.suggested_question);
        session.flow.askedQuestions.push(question);
        await addMessage('assistant', `${reply}\n\n${question}`, 'text', messageData, session.id);
      }
      return;
    }

    if (session.stage === 'PAIN_CONFIRMATION') {
      if (session.flow.painStep < 5) {
        session.flow.painStep += 1;
        if (session.painQuestionPlan && session.painQuestionPlan[session.flow.painStep - 1]) {
          session.flow.askedQuestions.push(session.painQuestionPlan[session.flow.painStep - 1].question);
          await addPlannedPainQuestion(session, session.flow.painStep, reply);
        } else {
          const question = fallbackQuestion(session, result.suggested_question);
          session.flow.askedQuestions.push(question);
          await addGuidedQuestion(session, 'PAIN_CONFIRMATION', session.flow.painStep, question, reply, null, messageData);
        }
      } else {
        await addMessage('assistant', `${reply}\n\n痛点确认五问已完成，正在从痛点库中匹配优先痛点，请稍候（约需数秒）…`, 'text', messageData, session.id);
        showTyping();
        await generatePainRecommendations(session, false);
      }
      return;
    }

    if (session.stage === 'SKU_CONFIRMATION') {
      const latestAnswer = [...activeMessages].reverse().find((message) => message.role === 'user')?.content || '';
      await recordSkuAnswer(session, latestAnswer);
      if (session.flow.skuStep < 5) {
        session.flow.skuStep += 1;
        if (session.skuQuestionPlan) {
          await addPlannedSkuQuestion(session, session.flow.skuStep, reply);
        } else {
          const question = await prepareNextSkuQuestion(session, session.flow.skuStep);
          await addGuidedQuestion(session, 'SKU_CONFIRMATION', session.flow.skuStep, question, reply, session.skuAnalysis.lastQuestion, messageData);
        }
      } else {
        await addMessage('assistant', `${reply}\n\nSKU 适配五问已完成，正在根据 15 个测试 SKU 的宽表证据重新核验全部候选，请稍候（约需数秒）…`, 'text', messageData, session.id);
        showTyping();
        await generateSkuRecommendations(session);
      }
      return;
    }

    if (session.stage === 'SKU_READY') {
      const material = result.material_change || (result.intent === 'business' && changedKeys.length > 0);
      if (material) {
        session.stage = 'REFRESH_NEEDED';
        session.flow.refreshStep = 1;
        const question = fallbackQuestion(session, result.suggested_question);
        session.flow.askedQuestions.push(question);
        await addMessage('assistant', `${reply}\n\n这条新信息可能影响现有痛点或 SKU，我会做一次局部刷新。${question}`, 'text', { ...(messageData || {}), stage: 'REFRESH_NEEDED', step: 1 }, session.id);
      } else {
        await addMessage('assistant', reply, 'text', messageData, session.id);
      }
      return;
    }

    if (session.stage === 'REFRESH_NEEDED') {
      if (session.flow.refreshStep < 2) {
        session.flow.refreshStep += 1;
        const question = fallbackQuestion(session, result.suggested_question);
        session.flow.askedQuestions.push(question);
        await addMessage('assistant', `${reply}\n\n${question}`, 'text', { ...(messageData || {}), stage: 'REFRESH_NEEDED', step: session.flow.refreshStep }, session.id);
      } else {
        await addMessage('assistant', `${reply}\n\n受影响信息已确认，正在生成新版痛点与 SKU 建议。`, 'text', messageData, session.id);
        await generatePainRecommendations(session, true);
        await generateSkuRecommendations(session);
      }
      return;
    }

    await addMessage('assistant', reply, 'text', messageData, session.id);
  }

  async function sendCurrentInput() {
    const input = $('#caInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    await sendText(text);
  }

  async function sendText(text, userMessageData = null) {
    if (busy || !activeSessionId || !text.trim()) return;
    const sessionId = activeSessionId;
    const session = getActiveSession();
    const nonce = ++requestNonce;
    await addMessage('user', text.trim(), 'text', userMessageData, sessionId);
    setBusy(true);
    try {
      const result = await callOrchestrator(session);
      if (nonce !== requestNonce || activeSessionId !== sessionId) return;
      const changedKeys = mergeProfile(session, result.profile_patch, result.evidence, result.correction);
      if (Array.isArray(result.search_terms)) {
        session.searchTerms = Array.from(new Set([...session.searchTerms, ...result.search_terms.map(String)])).slice(-40);
      }
      if (!session.nameLocked && !session.manualName && result.title_suggestion && String(result.title_suggestion).trim()) {
        session.name = String(result.title_suggestion).trim().slice(0, 40);
      }
      await handleStageCompletion(session, result, changedKeys);
      await saveSession(session);
    } catch (error) {
      if (nonce === requestNonce && activeSessionId === sessionId) {
        await addMessage('assistant', `本轮回复失败：${error.message}。您的输入已经保留，可以检查 API 设置后重试。`, 'error', null, sessionId);
      }
    } finally {
      if (nonce === requestNonce) setBusy(false);
      $('#caInput')?.focus({ preventScroll: true });
    }
  }

  const DIAG_KEY = 'ca_diag_log_v1';

  function diagLog(kind, detail) {
    try {
      const entries = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]');
      entries.push({ t: new Date().toISOString(), kind, detail: String(detail || '').slice(0, 500) });
      localStorage.setItem(DIAG_KEY, JSON.stringify(entries.slice(-30)));
    } catch (_) {}
    try {
      navigator.sendBeacon(`/api/health?diag=${encodeURIComponent(`${kind}|${String(detail || '').slice(0, 300)}`)}`);
    } catch (_) {}
  }

  function installDiagnostics() {
    const describeElement = (el) => {
      if (!el || !el.tagName) return '(非元素)';
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `<${tag}${id}${cls}> "${text}"`;
    };
    const recentClicks = [];
    document.addEventListener('click', (event) => {
      recentClicks.push(`${new Date().toISOString().slice(11, 23)} ${describeElement(event.target)}`);
      if (recentClicks.length > 5) recentClicks.shift();
    }, true);
    document.addEventListener('submit', (event) => {
      diagLog('form-submit', `表单提交！form=${describeElement(event.target)}，action=${event.target.action || '(当前页)'}，来源点击=${recentClicks[recentClicks.length - 1] || '无'}`);
    }, true);
    window.addEventListener('error', (event) => {
      diagLog('js-error', `${event.message} @${event.filename || ''}:${event.lineno || ''}`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      diagLog('promise-rejection', event.reason?.message || String(event.reason));
    });
    window.addEventListener('pagehide', (event) => {
      diagLog('pagehide', `页面被卸载(persisted=${event.persisted})。最后${recentClicks.length}次点击：${recentClicks.join(' | ') || '无'}`);
    });
    document.addEventListener('freeze', () => diagLog('freeze', '页面被浏览器冻结(内存回收前兆)'));
    document.addEventListener('resume', () => diagLog('resume', '页面从冻结中恢复'));
    let lastLayoutState = '';
    const captureLayout = () => {
      try {
        const app = document.getElementById('assistantApp');
        const rect = app ? app.getBoundingClientRect() : null;
        const center = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight / 2));
        const topLeft = document.elementFromPoint(10, 10);
        const state = [
          `vis=${document.visibilityState}`,
          `app=${app ? `${getComputedStyle(app).display} ${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.x)},${Math.round(rect.y)}` : '不存在'}`,
          `屏幕中心=${describeElement(center)}`,
          `左上角=${describeElement(topLeft)}`,
          `body.class=${document.body.className}`,
          `视口=${innerWidth}x${innerHeight}`
        ].join('；');
        if (state !== lastLayoutState) {
          lastLayoutState = state;
          diagLog('layout', state);
        }
      } catch (error) {
        diagLog('layout-err', error.message);
      }
    };
    setInterval(captureLayout, 10000);
    setTimeout(captureLayout, 3000);
    document.addEventListener('visibilitychange', captureLayout);
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) diagLog('page-load', `本次加载方式=${nav.type}，wasDiscarded=${document.wasDiscarded === true}（true=上个页面被浏览器因内存不足丢弃）`);
    } catch (_) {}
    const observer = new MutationObserver(() => {
      const app = document.getElementById('assistantApp');
      if (!app) {
        diagLog('dom-wipe', `#assistantApp 从DOM中消失，body.class=${document.body.className}，body子节点数=${document.body.children.length}`);
        return;
      }
      const display = getComputedStyle(app).display;
      if (display === 'none') diagLog('app-hidden', `#assistantApp display:none，body.class=${document.body.className}`);
    });
    observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
    const previous = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]');
    if (previous.length) {
      console.warn('【诊断黑匣子】历史记录（最近' + previous.length + '条，复现白屏后请把这段截图给开发者）：');
      previous.forEach((entry) => console.warn(`  [${entry.t}] ${entry.kind}: ${entry.detail}`));
    }
  }

  function warnIfFileProtocol() {
    if (window.location.protocol !== 'file:') return;
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(20,30,40,.75);font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif;';
    banner.innerHTML = `<div style="max-width:480px;padding:26px 28px;border-radius:12px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.3);">
      <h2 style="margin:0 0 12px;font-size:17px;color:#1f2d38;">当前打开方式不正确</h2>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#4a555e;">您是通过 <code>file://</code> 直接打开这个页面的，浏览器会阻止它读取本地数据库和保存客户会话，导致知识库加载失败、会话无法保存。</p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.7;color:#4a555e;">请关闭本标签页，改为双击运行：<br><code>启动客户全流程小助手demo.bat</code><br>它会自动启动本地服务并用正确地址打开本页面。</p>
      <button id="caFileProtocolDismiss" style="padding:8px 16px;border:1px solid #dbe1e6;border-radius:8px;background:#f6f7f8;color:#183a5a;cursor:pointer;font:inherit;">我知道了，先看看界面</button>
    </div>`;
    document.body.appendChild(banner);
    banner.querySelector('#caFileProtocolDismiss').addEventListener('click', () => banner.remove());
  }

  // ===== 演示样例种子：发布版随包附带 demo_seed.json，首次访问时导入样例会话 =====
  // 本地开发环境没有该文件，fetch 404 后静默跳过，不影响真实客户档案。
  const DEMO_SEED_FILE = 'demo_seed.json';
  async function loadDemoSeed() {
    let payload = null;
    try {
      const res = await fetch(DEMO_SEED_FILE, { cache: 'no-store' });
      if (!res.ok) return;
      payload = await res.json();
    } catch (error) {
      return; // 无种子文件 = 常规部署
    }
    if (!payload) return;
    if (payload.demoViewer) demoViewerMode = true;
    if (payload.disableServerSync) {
      // 静态托管没有后端，把"本地服务不可用"的告警换成演示态说明
      serverSyncEnabled = false;
      setServerSyncStatus('演示模式：内容保存在本浏览器', 'saved');
    }

    const items = Array.isArray(payload.sessions) ? payload.sessions : [payload];
    let restored = 0;
    for (const item of items) {
      const seedSession = item && item.session;
      if (!seedSession || !seedSession.id) continue;
      const existing = sessions.findIndex((s) => s.id === seedSession.id);
      // alwaysRestore：每次打开都把样例会话还原成标准版本，
      // 保证任何人（包括改过/删过它的人）看到的内容完全一致。
      if (existing >= 0 && !payload.alwaysRestore) continue;
      try {
        if (existing >= 0) {
          const stale = (await getAllRecords('messages')).filter((m) => m.sessionId === seedSession.id);
          for (const m of stale) await deleteRecordById('messages', m.id);
        }
        const normalized = normalizeSession(seedSession);
        await putRecord('sessions', normalized);
        for (const msg of item.messages || []) await putRecord('messages', msg);
        for (const rec of item.recommendations || []) await putRecord('recommendations', rec);
        if (existing >= 0) sessions[existing] = normalized;
        else sessions.push(normalized);
        restored += 1;
      } catch (error) {
        console.warn('[demo] 样例会话载入失败：', seedSession.id, error.message);
      }
    }
    if (restored) {
      console.info(`[demo] 样例会话已就绪：${restored} 条`);
      if (payload.preferredSessionId && !localStorage.getItem(ACTIVE_SESSION_KEY)) {
        localStorage.setItem(ACTIVE_SESSION_KEY, payload.preferredSessionId);
      }
    }
  }

  async function initialize() {
    installDiagnostics();
    warnIfFileProtocol();
    mountApp();
    window.ChaoxiPlanModule?.mount();
    bindEvents();
    loadRoleplaySessions();
    renderRoleplaySessionList();
    const appShell = $('#assistantApp');
    if (appShell) {
      appShell.addEventListener('scroll', () => {
        if (appShell.scrollLeft || appShell.scrollTop) {
          diagLog('void-scroll-blocked', `外壳被滚动到 ${appShell.scrollLeft},${appShell.scrollTop}，已强制归位`);
          appShell.scrollLeft = 0;
          appShell.scrollTop = 0;
        }
      });
    }
    // 等登录完成后再决定打开谁的档案库（未接入登录闸门时此步立即通过）
    if (window.ZXAuth?.whenAuthenticated) {
      const email = await window.ZXAuth.whenAuthenticated();
      applyUserScope(email);
      console.info(`[auth] 当前用户 ${email}，本地档案库 ${DB_NAME}`);
    }
    try {
      db = await openDatabase();
    } catch (error) {
      $('#caSourceStatus').textContent = `本地存储不可用：${error.message}`;
      $('#caSourceStatus').classList.add('error');
      return;
    }
    sessions = (await getAllRecords('sessions')).map(normalizeSession);
    await mergeServerSessions();
    await loadDemoSeed();
    const migratedSessions = sessions.filter((session) => session._profileMigrated);
    if (migratedSessions.length) {
      try {
        await Promise.all(migratedSessions.map((session) => putRecord('sessions', session)));
        console.info(`已按新版 5D 定义自动纠正 ${migratedSessions.length} 个客户画像`);
      } catch (error) {
        console.warn('旧客户画像自动纠正未能写回本地存储：', error.message);
        toast('画像分类已在当前页面纠正，但暂未写回本地存储');
      }
    }
    loadSources();
    if (!sessions.length) {
      await createAndOpenSession();
    } else {
      const remembered = localStorage.getItem(ACTIVE_SESSION_KEY);
      const target = sessions.find((item) => item.id === remembered)
        || sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      await switchSession(target.id);
    }
    $('#caInput').focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
