(function () {
  'use strict';

  const CATALOG_URL = 'sku_landing_sop_15.json';
  const IMAGE_WIDTH = 1080;
  const IMAGE_MAX_HEIGHT = 6500;
  const catalogCache = { promise: null };
  const packageCache = new Map();

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

  function bigrams(value) {
    const chars = Array.from(normalize(value));
    if (chars.length < 2) return new Set(chars);
    return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
  }

  function jaccard(left, right) {
    const a = bigrams(left);
    const b = bigrams(right);
    if (!a.size && !b.size) return 1;
    let intersection = 0;
    a.forEach((item) => { if (b.has(item)) intersection += 1; });
    return intersection / (a.size + b.size - intersection || 1);
  }

  function nodesCanMerge(left, right) {
    const a = normalize(left);
    const b = normalize(right);
    if (a === b) return true;
    return a.length >= 6 && b.length >= 6 && jaccard(a, b) >= 0.88;
  }

  function findCatalogSku(catalog, skuId, skuName) {
    const idKey = normalize(skuId);
    const nameKey = normalize(skuName);
    return catalog.skus.find((item) => normalize(item.sku_id) === idKey)
      || catalog.skus.find((item) => [item.sku_name, ...(item.aliases || [])]
        .map(normalize)
        .some((value) => value && (value === nameKey || (nameKey.length >= 5 && (value.includes(nameKey) || nameKey.includes(value))))))
      || null;
  }

  function loadCatalog() {
    if (!catalogCache.promise) {
      catalogCache.promise = fetch(CATALOG_URL, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`SOP 宽表清单读取失败（${response.status}）`);
          return response.json();
        })
        .then((catalog) => {
          if (catalog.sku_count !== 15 || catalog.total_rows !== 319 || !Array.isArray(catalog.skus)) {
            throw new Error('SOP 宽表清单完整性校验失败');
          }
          return catalog;
        })
        .catch((error) => {
          catalogCache.promise = null;
          throw error;
        });
    }
    return catalogCache.promise;
  }

  function addUniqueSource(list, source) {
    const key = `${source.sku_id}:${source.row_number}`;
    if (!list.some((item) => `${item.sku_id}:${item.row_number}` === key)) list.push(source);
  }

  function buildSop(catalog, packageData) {
    const matched = [];
    const missing = [];
    (packageData.selections || []).forEach((selection) => {
      const item = findCatalogSku(catalog, selection.item?.sku_id, selection.item?.sku_name);
      if (!item) {
        missing.push({ role: selection.role, sku_id: selection.item?.sku_id || '', sku_name: selection.item?.sku_name || '' });
      } else {
        matched.push({ role: selection.role, item });
      }
    });
    const missingCore = missing.filter((item) => item.role === 'main');
    if (missingCore.length) throw new Error(`核心方案缺少落地步骤数据：${missingCore.map((item) => item.sku_id).join('、')}`);
    if (!matched.length) throw new Error('本次方案没有可用的 SOP 宽表');

    const stages = [];
    const stageMap = new Map();
    matched.forEach((selection) => {
      selection.item.rows.forEach((row) => {
        const stageKey = `${row.stage_order}:${normalize(row.primary_stage)}`;
        let stage = stageMap.get(stageKey);
        if (!stage) {
          stage = { order: row.stage_order, name: row.primary_stage, nodes: [] };
          stageMap.set(stageKey, stage);
          stages.push(stage);
        }
        let node = stage.nodes.find((candidate) => nodesCanMerge(candidate.name, row.secondary_node));
        if (!node) {
          node = { name: row.secondary_node, originalNames: [], actions: [], records: [], roles: new Set(), skuIds: new Set() };
          stage.nodes.push(node);
        }
        if (!node.originalNames.includes(row.secondary_node)) node.originalNames.push(row.secondary_node);
        node.roles.add(selection.role);
        node.skuIds.add(selection.item.sku_id);
        const record = {
          sku_id: selection.item.sku_id,
          sku_name: selection.item.sku_name,
          role: selection.role,
          row_number: row.row_number,
          secondary_node: row.secondary_node,
          client_cooperation: row.client_cooperation
        };
        node.records.push(record);
        (row.actions || [row.client_cooperation]).forEach((actionText) => {
          const key = normalize(actionText);
          let action = node.actions.find((candidate) => candidate.key === key);
          if (!action) {
            action = { key, text: actionText, sources: [] };
            node.actions.push(action);
          }
          addUniqueSource(action.sources, record);
        });
      });
    });
    stages.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'));
    stages.forEach((stage) => stage.nodes.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
    return {
      schemaVersion: catalog.schema_version,
      generatedAt: catalog.generated_at,
      stages,
      matched,
      missing,
      totalNodes: stages.reduce((sum, stage) => sum + stage.nodes.length, 0),
      totalActions: stages.reduce((sum, stage) => sum + stage.nodes.reduce((nodeSum, node) => nodeSum + node.actions.length, 0), 0),
      sourceRows: matched.reduce((sum, selection) => sum + selection.item.row_count, 0)
    };
  }

  function roleLabel(role) {
    return role === 'main' ? '核心' : '辅助';
  }

  function skuTagsHtml(values) {
    return values.map((selection) => `<span class="ca-sop-sku ${selection.role === 'main' ? 'core' : 'auxiliary'}">${roleLabel(selection.role)} · ${escapeHtml(selection.item.sku_id)} ${escapeHtml(selection.item.sku_name)}</span>`).join('');
  }

  function sourceTagsHtml(sources) {
    const unique = [];
    sources.forEach((source) => {
      if (!unique.some((item) => item.sku_id === source.sku_id && item.role === source.role)) unique.push(source);
    });
    return unique.map((source) => `<span class="ca-sop-source-tag ${source.role === 'main' ? 'core' : 'auxiliary'}">${roleLabel(source.role)} · ${escapeHtml(source.sku_id)}</span>`).join('');
  }

  function timelineHtml(sop) {
    return sop.stages.map((stage) => `<details class="ca-sop-stage" open>
      <summary><span class="ca-sop-stage-no">${escapeHtml(stage.order)}</span><strong>${escapeHtml(stage.name.replace(/^\s*\d+\s*/, ''))}</strong><span>${stage.nodes.length} 个节点</span></summary>
      <div class="ca-sop-stage-body">${stage.nodes.map((node) => `<article class="ca-sop-node">
        <div class="ca-sop-node-head"><h4>${escapeHtml(node.name)}</h4><div>${sourceTagsHtml(node.records)}</div></div>
        <ul>${node.actions.map((action) => `<li>${escapeHtml(action.text)}</li>`).join('')}</ul>
        <details class="ca-sop-audit"><summary>查看完整事项与来源（${node.records.length} 条）</summary>
          <div>${node.records.map((record) => `<div class="ca-sop-audit-row"><div><b>${roleLabel(record.role)} · ${escapeHtml(record.sku_id)}</b><span>宽表第 ${record.row_number} 行 · ${escapeHtml(record.secondary_node)}</span></div><p>${escapeHtml(record.client_cooperation)}</p></div>`).join('')}</div>
        </details>
      </article>`).join('')}</div>
    </details>`).join('');
  }

  function ensureModal() {
    let modal = document.querySelector('#caSopModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'caSopModal';
      modal.className = 'ca-sop-modal';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function closeModal() {
    document.querySelector('#caSopModal')?.classList.remove('show');
  }

  function showLoading() {
    const modal = ensureModal();
    modal.innerHTML = `<div class="ca-sop-backdrop" data-sop-close></div><div class="ca-sop-dialog ca-sop-loading"><button class="ca-sop-close" data-sop-close>×</button><div class="ca-package-spinner"></div><h3>正在整理落地 SOP</h3><p>正在融合入选方案的落地 A、B、E 列…</p></div>`;
    modal.classList.add('show');
    modal.querySelectorAll('[data-sop-close]').forEach((element) => element.addEventListener('click', closeModal));
  }

  function showError(error) {
    const modal = ensureModal();
    modal.innerHTML = `<div class="ca-sop-backdrop" data-sop-close></div><div class="ca-sop-dialog ca-sop-loading"><button class="ca-sop-close" data-sop-close>×</button><h3>暂时无法生成 SOP</h3><p>${escapeHtml(error.message || String(error))}</p><button class="ca-primary-btn" data-sop-close>返回客户方案</button></div>`;
    modal.classList.add('show');
    modal.querySelectorAll('[data-sop-close]').forEach((element) => element.addEventListener('click', closeModal));
  }

  function safeName(value) {
    return String(value || '未命名客户').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 50) || '未命名客户';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function wrapLines(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    Array.from(String(text || '')).forEach((char) => {
      const candidate = line + char;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function textBlock(ctx, text, options) {
    ctx.font = options.font;
    const lines = wrapLines(ctx, text, options.maxWidth);
    return {
      height: lines.length * options.lineHeight,
      draw(target, x, y) {
        target.font = options.font;
        target.fillStyle = options.color;
        lines.forEach((line, index) => target.fillText(line, x, y + index * options.lineHeight));
      }
    };
  }

  function buildImageBlocks(sop, session) {
    const measure = document.createElement('canvas').getContext('2d');
    const blocks = [];
    blocks.push({
      type: 'cover', height: 300,
      draw(ctx, y) {
        ctx.fillStyle = '#0b4166'; ctx.fillRect(0, y, IMAGE_WIDTH, 300);
        ctx.fillStyle = '#c9aa75'; ctx.fillRect(58, y + 46, 86, 6);
        ctx.fillStyle = '#fff'; ctx.font = '700 46px "Microsoft YaHei", sans-serif'; ctx.fillText('客户方案落地 SOP', 58, y + 125);
        ctx.fillStyle = '#d9e7ef'; ctx.font = '400 24px "Microsoft YaHei", sans-serif'; ctx.fillText(session.name || '未命名客户', 58, y + 178);
        ctx.fillStyle = '#b9cfdb'; ctx.font = '400 19px "Microsoft YaHei", sans-serif';
        ctx.fillText(`${new Date().toLocaleDateString('zh-CN')} · ${sop.stages.length} 个阶段 · ${sop.totalNodes} 个节点 · ${sop.totalActions} 项客户配合事项`, 58, y + 248);
      }
    });
    sop.stages.forEach((stage) => {
      blocks.push({
        type: 'stage', height: 112,
        draw(ctx, y) {
          ctx.fillStyle = '#efe6d8'; ctx.fillRect(0, y, IMAGE_WIDTH, 112);
          ctx.fillStyle = '#9b7443'; ctx.fillRect(0, y, 14, 112);
          ctx.fillStyle = '#0b4166'; ctx.beginPath(); ctx.arc(66, y + 56, 28, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 25px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(stage.order), 66, y + 65); ctx.textAlign = 'left';
          ctx.fillStyle = '#0b4166'; ctx.font = '700 31px "Microsoft YaHei", sans-serif'; ctx.fillText(stage.name.replace(/^\s*\d+\s*/, ''), 116, y + 67);
        }
      });
      stage.nodes.forEach((node) => {
        const title = textBlock(measure, node.name, { font: '700 25px "Microsoft YaHei", sans-serif', color: '#183a5a', maxWidth: 930, lineHeight: 36 });
        const actionBlocks = node.actions.map((action, index) => ({ index, block: textBlock(measure, action.text, { font: '400 21px "Microsoft YaHei", sans-serif', color: '#2c3b45', maxWidth: 884, lineHeight: 31 }) }));
        const groups = [];
        let current = [];
        let height = 86 + title.height;
        actionBlocks.forEach((action) => {
          const nextHeight = action.block.height + 18;
          if (current.length && height + nextHeight > 5250) {
            groups.push(current); current = []; height = 86 + title.height;
          }
          current.push(action); height += nextHeight;
        });
        if (current.length) groups.push(current);
        groups.forEach((group, groupIndex) => {
          const blockHeight = 80 + title.height + group.reduce((sum, action) => sum + action.block.height + 18, 0) + 26;
          blocks.push({
            type: 'node', height: blockHeight,
            draw(ctx, y) {
              ctx.fillStyle = '#fff'; ctx.fillRect(0, y, IMAGE_WIDTH, blockHeight);
              ctx.strokeStyle = '#dfe5e9'; ctx.beginPath(); ctx.moveTo(45, y + blockHeight - 1); ctx.lineTo(1035, y + blockHeight - 1); ctx.stroke();
              title.draw(ctx, 58, y + 43);
              if (groupIndex) { ctx.fillStyle = '#6f7d88'; ctx.font = '400 17px "Microsoft YaHei", sans-serif'; ctx.fillText('（续）', 935, y + 43); }
              let actionY = y + 60 + title.height;
              group.forEach((action) => {
                ctx.fillStyle = '#c7a969'; ctx.beginPath(); ctx.arc(70, actionY - 7, 5, 0, Math.PI * 2); ctx.fill();
                action.block.draw(ctx, 96, actionY);
                actionY += action.block.height + 18;
              });
            }
          });
        });
      });
    });
    return blocks;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('SOP 长图编码失败')), 'image/png'));
  }

  async function buildImages(sop, session) {
    const blocks = buildImageBlocks(sop, session);
    const contentLimit = IMAGE_MAX_HEIGHT - 46;
    const pages = [];
    let units = [];
    let height = 0;
    blocks.forEach((block, index) => {
      const next = blocks[index + 1];
      const keepWithNext = block.type === 'stage' && next;
      const required = block.height + (keepWithNext ? next.height : 0);
      if (units.length && height + required > contentLimit) {
        pages.push({ units, height }); units = []; height = 0;
      }
      if (units.length && height + block.height > contentLimit) {
        pages.push({ units, height }); units = []; height = 0;
      }
      units.push(block); height += block.height;
    });
    if (units.length) pages.push({ units, height });

    const customer = safeName(session.name);
    const dateToken = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const files = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const canvas = document.createElement('canvas');
      canvas.width = IMAGE_WIDTH; canvas.height = page.height + 46;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      let y = 0;
      page.units.forEach((block) => { block.draw(ctx, y); y += block.height; });
      ctx.fillStyle = '#f3f5f6'; ctx.fillRect(0, page.height, IMAGE_WIDTH, 46);
      ctx.fillStyle = '#6f7d88'; ctx.font = '400 16px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`客户方案落地 SOP · 第 ${pageIndex + 1} / ${pages.length} 页`, IMAGE_WIDTH / 2, page.height + 29); ctx.textAlign = 'left';
      const blob = await canvasToBlob(canvas);
      const number = String(pageIndex + 1).padStart(2, '0');
      files.push({ name: `客户方案落地SOP_${customer}_${dateToken}_${number}.png`, blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
      canvas.width = 1; canvas.height = 1;
    }
    return { files, customer, dateToken };
  }

  function revokeImages(imagePackage) {
    (imagePackage?.files || []).forEach((file) => URL.revokeObjectURL(file.url));
  }

  async function downloadZip(imagePackage) {
    if (typeof JSZip !== 'function') throw new Error('ZIP 组件未加载');
    const zip = new JSZip();
    imagePackage.files.forEach((file) => zip.file(file.name, file.blob));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    downloadBlob(blob, `客户方案落地SOP_${imagePackage.customer}_${imagePackage.dateToken}.zip`);
  }

  async function showImagePreview(sop, session, cacheKey) {
    const modal = ensureModal();
    let imagePackage = packageCache.get(`${cacheKey}:images`);
    const button = modal.querySelector('[data-sop-download]');
    if (button) { button.disabled = true; button.textContent = '正在生成长图…'; }
    try {
      if (!imagePackage) {
        imagePackage = await buildImages(sop, session);
        packageCache.set(`${cacheKey}:images`, imagePackage);
      }
      modal.innerHTML = `<div class="ca-sop-backdrop" data-sop-preview-close></div><div class="ca-sop-dialog ca-sop-preview-dialog">
        <div class="ca-sop-header"><div><h3>客户版 SOP 长图</h3><p>${imagePackage.files.length} 张图片 · 1080px 宽 · 可逐张或 ZIP 下载</p></div><button class="ca-sop-close" data-sop-preview-close>×</button></div>
        <div class="ca-sop-toolbar"><button class="ca-primary-btn" data-sop-zip>下载全部 ZIP</button><button class="ca-secondary-btn" data-sop-back>返回 SOP</button></div>
        <div class="ca-sop-preview-grid">${imagePackage.files.map((file, index) => `<article><div>第 ${index + 1} / ${imagePackage.files.length} 张 · ${file.width} × ${file.height}</div><img src="${file.url}" alt="SOP 长图第 ${index + 1} 张"><button class="ca-secondary-btn" data-sop-image="${index}">下载此图</button></article>`).join('')}</div>
      </div>`;
      modal.querySelectorAll('[data-sop-preview-close]').forEach((element) => element.addEventListener('click', closeModal));
      modal.querySelector('[data-sop-back]')?.addEventListener('click', () => renderSop(sop, session, cacheKey));
      modal.querySelectorAll('[data-sop-image]').forEach((element) => element.addEventListener('click', () => {
        const file = imagePackage.files[Number(element.dataset.sopImage)]; if (file) downloadBlob(file.blob, file.name);
      }));
      modal.querySelector('[data-sop-zip]')?.addEventListener('click', async () => {
        try { await downloadZip(imagePackage); } catch (error) { alert(error.message); }
      });
    } catch (error) {
      showError(error);
    }
  }

  function renderSop(sop, session, cacheKey) {
    const modal = ensureModal();
    const missing = sop.missing.length ? `<div class="ca-package-warning">未纳入缺少落地数据的辅助方案：${escapeHtml(sop.missing.map((item) => item.sku_id).join('、'))}</div>` : '';
    modal.innerHTML = `<div class="ca-sop-backdrop" data-sop-close></div><div class="ca-sop-dialog">
      <div class="ca-sop-header"><div><h3>客户方案落地 SOP</h3><p>${escapeHtml(session.name || '未命名客户')} · ${sop.stages.length} 个阶段 · ${sop.totalNodes} 个融合节点 · ${sop.totalActions} 项客户配合事项</p></div><button class="ca-sop-close" data-sop-close>×</button></div>
      <div class="ca-sop-skus">${skuTagsHtml(sop.matched)}</div>${missing}
      <div class="ca-sop-toolbar"><button class="ca-primary-btn" data-sop-download>下载客户版 SOP 长图</button><button class="ca-secondary-btn" data-sop-expand>展开全部</button><button class="ca-secondary-btn" data-sop-collapse>收起全部</button><button class="ca-secondary-btn" data-sop-regenerate>重新生成</button><button class="ca-secondary-btn" data-sop-close>返回客户方案 PPT</button></div>
      <div class="ca-sop-integrity">数据版本 ${escapeHtml(sop.generatedAt)} · 已融合 ${sop.sourceRows} 条宽表原始节点；完整事项可按方案与来源行号溯源</div>
      <div class="ca-sop-timeline">${timelineHtml(sop)}</div>
    </div>`;
    modal.classList.add('show');
    modal.querySelectorAll('[data-sop-close]').forEach((element) => element.addEventListener('click', closeModal));
    modal.querySelector('[data-sop-expand]')?.addEventListener('click', () => modal.querySelectorAll('details').forEach((details) => { details.open = true; }));
    modal.querySelector('[data-sop-collapse]')?.addEventListener('click', () => modal.querySelectorAll('details').forEach((details) => { details.open = false; }));
    modal.querySelector('[data-sop-download]')?.addEventListener('click', () => showImagePreview(sop, session, cacheKey));
    modal.querySelector('[data-sop-regenerate]')?.addEventListener('click', () => open({ packageData: { ...packageCache.get(`${cacheKey}:package`) }, session }, true));
  }

  async function open(options, force = false) {
    const packageData = options?.packageData;
    const session = options?.session || { name: '未命名客户', id: 'unknown' };
    if (!packageData) return;
    const cacheKey = `${session.id || 'session'}:${packageData.cacheKey || packageData.dateToken || 'package'}`;
    if (force) {
      revokeImages(packageCache.get(`${cacheKey}:images`));
      packageCache.delete(cacheKey);
      packageCache.delete(`${cacheKey}:images`);
    }
    packageCache.set(`${cacheKey}:package`, packageData);
    if (!force && packageCache.has(cacheKey)) {
      renderSop(packageCache.get(cacheKey), session, cacheKey);
      return;
    }
    showLoading();
    try {
      const catalog = await loadCatalog();
      const sop = buildSop(catalog, packageData);
      packageCache.set(cacheKey, sop);
      renderSop(sop, session, cacheKey);
    } catch (error) {
      console.error('落地 SOP 生成失败：', error);
      showError(error);
    }
  }

  window.ChaoxiSopModule = { open, buildSop, nodesCanMerge };
})();
