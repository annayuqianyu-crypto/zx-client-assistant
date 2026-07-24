(function () {
  'use strict';

  const CATALOG_URL = 'sku_landing_supplier_15.json';
  const catalogCache = { promise: null };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function roleLabel(role) {
    return role === 'main' ? '核心' : '辅助';
  }

  function notify(message) {
    const toast = document.querySelector('#caToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2400);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    let payload = {};
    try { payload = await response.json(); } catch (_) { /* no-op */ }
    if (!response.ok) throw new Error(payload.error || `本地方案服务请求失败（${response.status}）`);
    return payload;
  }

  function loadCatalog() {
    if (!catalogCache.promise) {
      catalogCache.promise = fetch(CATALOG_URL, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`供应商宽表目录读取失败（${response.status}）`);
          return response.json();
        })
        .then((catalog) => {
          if (catalog.schema_version !== 2 || catalog.sku_count !== 15 || catalog.total_rows !== 319) {
            throw new Error('供应商宽表目录完整性校验失败');
          }
          return catalog;
        })
        .catch((error) => { catalogCache.promise = null; throw error; });
    }
    return catalogCache.promise;
  }

  function findSku(catalog, selection) {
    const id = normalize(selection.item?.sku_id);
    const name = normalize(selection.item?.sku_name);
    return catalog.skus.find((item) => normalize(item.sku_id) === id)
      || catalog.skus.find((item) => [item.sku_name, ...(item.aliases || [])].map(normalize)
        .some((candidate) => candidate && (candidate === name || (name.length >= 5 && (candidate.includes(name) || name.includes(candidate))))))
      || null;
  }

  function buildSuppliers(catalog, packageData) {
    const groups = new Map();
    const audit = [];
    const missing = [];
    (packageData.selections || []).forEach((selection) => {
      const sku = findSku(catalog, selection);
      if (!sku) {
        missing.push(`${selection.item?.sku_id || ''} ${selection.item?.sku_name || ''}`.trim());
        return;
      }
      let skuEntryCount = 0;
      sku.rows.forEach((row) => {
        (row.supplier_entries || []).forEach((entry) => {
          skuEntryCount += 1;
          if (!groups.has(entry.supplier)) {
            groups.set(entry.supplier, { supplier: entry.supplier, duties: [], stages: new Set(), skuMap: new Map() });
          }
          const group = groups.get(entry.supplier);
          group.stages.add(row.primary_stage);
          group.skuMap.set(sku.sku_id, { sku_id: sku.sku_id, sku_name: sku.sku_name, role: selection.role });
          const source = {
            supplier: entry.supplier,
            sku_id: sku.sku_id,
            sku_name: sku.sku_name,
            role: selection.role,
            row_number: row.row_number,
            primary_stage: row.primary_stage,
            secondary_node: row.secondary_node,
            supplier_raw: row.supplier_raw,
            prompt: entry.prompt,
            duty: entry.duty
          };
          audit.push(source);
          let duty = group.duties.find((item) => item.key === entry.duty_key);
          if (!duty) {
            duty = { key: entry.duty_key, text: entry.duty, stages: new Set(), skuMap: new Map(), source_count: 0 };
            group.duties.push(duty);
          }
          duty.stages.add(row.primary_stage);
          duty.skuMap.set(sku.sku_id, { sku_id: sku.sku_id, role: selection.role });
          duty.source_count += 1;
        });
      });
      if (!skuEntryCount) missing.push(`${sku.sku_id} ${sku.sku_name}`);
    });
    const suppliers = [...groups.values()].map((group) => ({
      supplier: group.supplier,
      stages: [...group.stages].sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)),
      skus: [...group.skuMap.values()],
      duties: group.duties.map((duty) => ({
        text: duty.text,
        stages: [...duty.stages].sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)),
        skus: [...duty.skuMap.values()],
        source_count: duty.source_count
      }))
    })).sort((a, b) => b.duties.length - a.duties.length || a.supplier.localeCompare(b.supplier, 'zh-CN'));
    return { suppliers, audit, missing };
  }

  function serializeSop(sop) {
    return {
      generated_at: sop.generatedAt,
      total_nodes: sop.totalNodes,
      total_actions: sop.totalActions,
      source_rows: sop.sourceRows,
      stages: sop.stages.map((stage) => ({
        order: stage.order,
        name: stage.name,
        nodes: stage.nodes.map((node) => ({
          name: node.name,
          sku_ids: [...new Set(node.records.map((record) => record.sku_id))],
          roles: [...new Set(node.records.map((record) => record.role))],
          actions: node.actions.map((action) => action.text)
        }))
      }))
    };
  }

  function serializeSkus(packageData) {
    return (packageData.selections || []).map((selection) => ({
      sku_id: selection.item?.sku_id || '',
      sku_name: selection.item?.sku_name || '',
      role: selection.role,
      pages: (selection.chunks || selection.item?.chunks || []).map((chunk) => ({
        file: `sku_long_images/${chunk.file}`,
        start_slide: chunk.start_slide,
        end_slide: chunk.end_slide,
        width: chunk.width,
        height: chunk.height
      }))
    }));
  }

  function ensureModal() {
    let modal = document.querySelector('#caPlanModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'caPlanModal';
      modal.className = 'ca-plan-modal';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function closeModal() {
    document.querySelector('#caPlanModal')?.classList.remove('show');
  }

  function bindClose(modal) {
    modal.querySelectorAll('[data-plan-close]').forEach((item) => item.addEventListener('click', closeModal));
  }

  function showLoading(title, text) {
    const modal = ensureModal();
    modal.innerHTML = `<div class="ca-plan-backdrop" data-plan-close></div><div class="ca-plan-dialog ca-plan-loading"><button class="ca-plan-close" data-plan-close>×</button><div class="ca-package-spinner"></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
    modal.classList.add('show');
    bindClose(modal);
  }

  function showError(error) {
    const modal = ensureModal();
    modal.innerHTML = `<div class="ca-plan-backdrop" data-plan-close></div><div class="ca-plan-dialog ca-plan-loading"><button class="ca-plan-close" data-plan-close>×</button><h3>暂时无法生成客户方案网页</h3><p>${escapeHtml(error.message || String(error))}</p><button class="ca-primary-btn" data-plan-close>返回</button></div>`;
    modal.classList.add('show');
    bindClose(modal);
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      notify('客户方案链接已复制');
    } catch (_) {
      window.prompt('请复制客户方案链接', value);
    }
  }

  function showCreated(result, snapshot) {
    const modal = ensureModal();
    const absoluteUrl = new URL(result.url, window.location.href).href;
    modal.innerHTML = `<div class="ca-plan-backdrop" data-plan-close></div><div class="ca-plan-dialog ca-plan-created">
      <button class="ca-plan-close" data-plan-close>×</button>
      <div class="ca-plan-success-mark">✓</div><h3>客户方案网页已生成</h3>
      <p>${escapeHtml(snapshot.customer_name)} · ${snapshot.skus.length} 个 SKU · ${snapshot.suppliers.length} 类供应商</p>
      <div class="ca-plan-link"><input value="${escapeHtml(absoluteUrl)}" readonly><button class="ca-primary-btn" data-plan-copy>复制链接</button></div>
      <div class="ca-plan-actions"><a class="ca-primary-btn" href="${escapeHtml(absoluteUrl)}" target="_blank" rel="noopener">打开客户网页</a><button class="ca-secondary-btn" data-plan-manage>管理全部链接</button></div>
      <div class="ca-plan-note">该链接当前有效；可在“客户方案链接”中随时设为失效或重新启用。</div>
    </div>`;
    modal.classList.add('show');
    bindClose(modal);
    modal.querySelector('[data-plan-copy]')?.addEventListener('click', () => copyText(absoluteUrl));
    modal.querySelector('[data-plan-manage]')?.addEventListener('click', openManager);
  }

  async function create(options) {
    const packageData = options?.packageData;
    const session = options?.session;
    if (!packageData || !session) return;
    showLoading('正在生成客户方案网页', '正在整合 SKU、落地 SOP 和宽表 G 列供应商职责…');
    try {
      const catalog = await loadCatalog();
      if (!window.ChaoxiSopModule?.buildSop) throw new Error('落地 SOP 模块尚未加载');
      const sop = window.ChaoxiSopModule.buildSop(catalog, packageData);
      const supplierResult = buildSuppliers(catalog, packageData);
      const skus = serializeSkus(packageData);
      const warnings = [
        ...(packageData.missing || []).map((item) => `SKU PPT 缺失：${item}`),
        ...supplierResult.missing.map((item) => `供应商 G 列数据缺失：${item}`)
      ];
      const snapshot = {
        schema_version: 1,
        session_id: session.id,
        customer_name: session.name || '未命名客户',
        recommendation_version: packageData.cacheKey || packageData.dateToken || '1',
        generated_date: new Date().toISOString(),
        skus,
        sop: serializeSop(sop),
        suppliers: supplierResult.suppliers,
        supplier_audit: supplierResult.audit,
        warnings,
        source_catalog: { generated_at: catalog.generated_at, sku_count: catalog.sku_count, total_rows: catalog.total_rows }
      };
      const result = await request('/api/manage/plans', { method: 'POST', body: JSON.stringify(snapshot) });
      showCreated(result, snapshot);
    } catch (error) {
      console.error('客户方案网页生成失败：', error);
      showError(error);
    }
  }

  function managerRows(items) {
    if (!items.length) return '<div class="ca-plan-empty">尚未生成客户方案链接。</div>';
    return items.map((item) => {
      const url = new URL(`/客户方案.html?id=${encodeURIComponent(item.plan_id)}`, window.location.href).href;
      return `<article class="ca-plan-record" data-plan-record="${escapeHtml(item.plan_id)}">
        <div class="ca-plan-record-main"><div><h4>${escapeHtml(item.customer_name)}</h4><p>${new Date(item.created_at).toLocaleString('zh-CN')} · ${item.sku_count} 个 SKU · ${item.supplier_count} 类供应商</p></div><span class="ca-plan-status ${item.status}">${item.status === 'active' ? '有效' : '已失效'}</span></div>
        <div class="ca-plan-record-actions"><a class="ca-secondary-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">预览</a><button class="ca-secondary-btn" data-plan-copy-url="${escapeHtml(url)}">复制链接</button><button class="ca-secondary-btn" data-plan-audit="${escapeHtml(item.plan_id)}">数据来源</button><button class="${item.status === 'active' ? 'ca-danger-btn' : 'ca-primary-btn'}" data-plan-status="${escapeHtml(item.plan_id)}" data-next-status="${item.status === 'active' ? 'inactive' : 'active'}">${item.status === 'active' ? '设为失效' : '重新启用'}</button></div>
      </article>`;
    }).join('');
  }

  async function openAudit(planId) {
    showLoading('正在读取供应商来源', '正在加载 G 列原文、SKU 和宽表行号…');
    try {
      const plan = await request(`/api/manage/plans/${encodeURIComponent(planId)}`);
      const groups = new Map();
      (plan.supplier_audit || []).forEach((row) => {
        if (!groups.has(row.supplier)) groups.set(row.supplier, []);
        groups.get(row.supplier).push(row);
      });
      const modal = ensureModal();
      modal.innerHTML = `<div class="ca-plan-backdrop" data-plan-close></div><div class="ca-plan-dialog ca-plan-manager-dialog"><div class="ca-plan-header"><div><h3>供应商数据来源</h3><p>${escapeHtml(plan.customer_name)} · ${(plan.supplier_audit || []).length} 条 G 列来源</p></div><button class="ca-plan-close" data-plan-close>×</button></div><div class="ca-plan-audit-list">${[...groups.entries()].map(([supplier, rows]) => `<details><summary>${escapeHtml(supplier)}（${rows.length} 条）</summary>${rows.map((row) => `<div class="ca-plan-audit-row"><div><b>${roleLabel(row.role)} · ${escapeHtml(row.sku_id)}</b><span>宽表第 ${row.row_number} 行 · ${escapeHtml(row.primary_stage)} · ${escapeHtml(row.secondary_node)}</span></div><p>${escapeHtml(row.supplier_raw)}</p></div>`).join('')}</details>`).join('')}</div><div class="ca-plan-footer"><button class="ca-secondary-btn" data-plan-back-manager>返回链接管理</button></div></div>`;
      modal.classList.add('show');
      bindClose(modal);
      modal.querySelector('[data-plan-back-manager]')?.addEventListener('click', openManager);
    } catch (error) { showError(error); }
  }

  async function openManager() {
    showLoading('正在读取客户方案链接', '正在同步本地有效与失效状态…');
    try {
      const payload = await request('/api/manage/plans');
      const modal = ensureModal();
      modal.innerHTML = `<div class="ca-plan-backdrop" data-plan-close></div><div class="ca-plan-dialog ca-plan-manager-dialog"><div class="ca-plan-header"><div><h3>客户方案链接管理</h3><p>${payload.items.length} 个历史方案 · 状态保存在本地服务</p></div><button class="ca-plan-close" data-plan-close>×</button></div><div class="ca-plan-records">${managerRows(payload.items)}</div></div>`;
      modal.classList.add('show');
      bindClose(modal);
      modal.querySelectorAll('[data-plan-copy-url]').forEach((button) => button.addEventListener('click', () => copyText(button.dataset.planCopyUrl)));
      modal.querySelectorAll('[data-plan-audit]').forEach((button) => button.addEventListener('click', () => openAudit(button.dataset.planAudit)));
      modal.querySelectorAll('[data-plan-status]').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await request(`/api/manage/plans/${encodeURIComponent(button.dataset.planStatus)}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.nextStatus }) });
          notify(button.dataset.nextStatus === 'active' ? '客户方案已重新启用' : '客户方案已设为失效');
          await openManager();
        } catch (error) { button.disabled = false; window.alert(error.message); }
      }));
    } catch (error) { showError(error); }
  }

  function mount() {
    // 「客户方案链接」入口已下线；openManager 仍通过 window.ChaoxiPlanModule 暴露，供内部按需调用
  }

  window.ChaoxiPlanModule = { mount, create, openManager, buildSuppliers };
})();
