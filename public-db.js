/* 公开只读数据层：仅读取本目录的静态快照，不接触本机数据库。 */
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  let snapshot = null;
  let loading = null;
  const chunkCache = new Map();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  async function verified(path, expected) {
    const response=await nativeFetch(path,{cache:'no-cache'});
    if(!response.ok)throw new Error('公开快照读取失败（HTTP '+response.status+'）');
    const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==expected)throw new Error('快照完整性校验失败；请稍后重试');
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  async function load(force=false) {
    if(snapshot&&!force)return snapshot;
    if(loading)return loading;
    loading=(async()=>{
      const response=await nativeFetch('data/current.json',{cache:'no-cache'});
      if(!response.ok)throw new Error('快照版本读取失败');
      const manifest=await response.json();
      if(manifest.schemaVersion!=='asrulai-release-1')throw new Error('公开版本格式不正确');
      const ref=manifest.files?.['snapshot.json'];
      if(!ref||ref.path!==`data/releases/${manifest.snapshotVersion}/snapshot.json`)throw new Error('快照路径不正确');
      const value=await verified(ref.path,ref.sha256);
      if(value.schemaVersion!=='asrulai-public-2'||value.snapshotVersion!==manifest.snapshotVersion)throw new Error('快照版本不一致');
      value.publication={snapshotVersion:manifest.snapshotVersion,publishedAt:manifest.publishedAt};
      chunkCache.clear();snapshot=value;return snapshot;
    })().finally(()=>{loading=null;});return loading;
  }

  function json(value, status = 200) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  function quote(symbol) {
    const q = snapshot?.quotes?.[String(symbol || '').toUpperCase()] || {};
    const price = Number(q.price);
    const previous = Number(q.prevClose);
    const validPrevious = Number.isFinite(previous) && previous > 0;
    return {
      chart: {
        result: [{
          meta: {
            symbol: String(symbol || '').toUpperCase(),
            regularMarketPrice: Number.isFinite(price) && price > 0 ? price : null,
            chartPreviousClose: validPrevious ? previous : null,
            previousClose: validPrevious ? previous : null,
            regularMarketTime: Number(q.time) || null,
            savedChange: Number.isFinite(q.change) ? q.change : null,
            quoteDate: q.quoteDate || (typeof q.time==='string' ? q.time : null),
            dataIssue: q.dataIssue || null
          }
        }],
        error: null
      }
    };
  }

  window.fetch = async function publicFetch(input, options = {}) {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, options);
    }
    await load();
    const path = url.pathname.slice(5);
    let body = {};
    try { body = options.body ? JSON.parse(options.body) : {}; } catch (_) {}
    if (path === 'health') return json({ ok: true, runtime: 'public-readonly' });
    if (path === 'yahoo/chart') return json(quote(body.symbol));
    if (path === 'display/heatmap') {
      const kind = String(body.kind || 'INDUSTRY').toUpperCase();
      return json(clone(snapshot.heatmaps?.[kind]) || { status: 'unavailable', items: [], message: '暂无数据' });
    }
    if (path === 'metals/spot') {
      return json(clone(snapshot.metals) || { status: 'unavailable' });
    }
    if (path === 'display/plates') {
      return json(clone(snapshot.plates?.[body.symbol]) || {
        status: 'unsupported', industries: [], concepts: [], untyped: [],
        message: '公开快照未包含该股所属板块'
      });
    }
    if (path === 'display/plate-members') {
      return json(clone(snapshot.plateMembers?.[body.plate_code]) || {
        status: 'unavailable', rows: [], total: 0,
        message: '本次公开快照未包含板块成员明细'
      });
    }
    return json({ ok: false, message: '公开镜像为只读模式，本机操作请在雷达应用内完成。' }, 410);
  };

  async function barRecord(key) {
    const s = await load(), symbol = String(key || '').toUpperCase();
    if (s.bars?.[symbol]) return clone(s.bars[symbol]);
    const path = s.barChunks?.[symbol];
    if (!path) return undefined;
    if (!chunkCache.has(path)) {
      const pending = nativeFetch(path, { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error('公开日K读取失败（HTTP ' + response.status + '）');
        const value = await response.json();
        if (!value || value.schemaVersion !== 'asrulai-bars-1' || !value.records) throw new Error('公开日K数据块格式不正确');
        return value.records;
      });
      chunkCache.set(path, pending);
      pending.catch(() => chunkCache.delete(path));
    }
    return clone((await chunkCache.get(path))?.[symbol]);
  }

  window.RadarDB = {
    open: () => load().then(() => true),
    reload: () => load(true),
    snapshot: async () => clone(await load()),
    get: async (store, key) => {
      const s = await load();
      if (store === 'bars') return barRecord(key);
      if (store === 'reports') return s.report?.id === key ? clone(s.report) : undefined;
      if (store === 'meta' && key === 'lastReport') return s.report ? { key, id: s.report.id } : undefined;
      if (store === 'meta' && key === 'marketIntelligence') return { key, dashboard: clone(s.intelligence) };
      return undefined;
    },
    getMany: async (store, keys) => {
      if (store === 'bars') return Promise.all(keys.map(barRecord));
      return [];
    },
    getAll: async store => {
      const s = await load();
      if (store === 'bars') {
        const symbols = new Set([...Object.keys(s.bars || {}), ...Object.keys(s.barChunks || {})]);
        return Promise.all([...symbols].map(barRecord));
      }
      if (store === 'reports') return s.report ? [clone(s.report)] : [];
      return [];
    },
    count: async store => {
      const s = await load();
      return store === 'bars' ? new Set([...Object.keys(s.bars || {}), ...Object.keys(s.barChunks || {})]).size : store === 'reports' && s.report ? 1 : 0;
    },
    coverage: async () => clone((await load()).coverage || {}),
    canonicalSource(source) {
      const value = String(source || '').trim().toLowerCase();
      if (value === 'massive' || value.startsWith('massive-')) return 'massive';
      if (value.includes('futu') || value.includes('moomoo')) return 'futu-qfq';
      if (value.includes('alpaca') && value.includes('sip')) return 'alpaca-sip';
      if (value.includes('alpaca')) return 'alpaca-iex';
      if (value.includes('yahoo') || value.includes('global-stock-data')) return 'yahoo-fallback';
      if (value.includes('sqlite')) return 'sqlite-import';
      if (value.includes('csv')) return 'csv-import';
      return value && value !== 'unknown' ? value : 'legacy-unknown';
    },
    adjustmentForSource(source, adjusted) {
      const canonical = this.canonicalSource(source);
      if (canonical === 'massive') return adjusted === false ? 'raw' : 'split-adjusted';
      if (canonical === 'futu-qfq') return 'QFQ';
      if (canonical.startsWith('alpaca-')) return 'all-adjusted';
      return 'unknown';
    }
  };
})();
