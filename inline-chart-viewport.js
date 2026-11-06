(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RadarInlineChartViewport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const integer = (value, fallback) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
    ? Math.round(Number(value)) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normalize(view, total, minimumVisible) {
    const count = Math.max(0, integer(total, 0));
    if (!count) return { visibleCount:0, offset:0 };
    const minimum = clamp(integer(minimumVisible, 20), 1, count);
    const visibleCount = clamp(integer(view && view.visibleCount, count), minimum, count);
    const offset = clamp(integer(view && view.offset, 0), 0, count - visibleCount);
    return { visibleCount, offset };
  }

  function range(view, total, minimumVisible) {
    const normalized = normalize(view, total, minimumVisible);
    const end = Math.max(0, integer(total, 0) - normalized.offset);
    return { ...normalized, start:Math.max(0, end - normalized.visibleCount), end };
  }

  function reset(total, minimumVisible) {
    return normalize({ visibleCount:integer(total, 0), offset:0 }, total, minimumVisible);
  }

  function zoom(view, total, anchorRatio, deltaY, minimumVisible) {
    const current = range(view, total, minimumVisible);
    if (!current.visibleCount) return { visibleCount:0, offset:0 };
    const ratio = clamp(Number(anchorRatio) || 0, 0, 1);
    const wheelDelta = clamp(Number(deltaY) || 0, -240, 240);
    if (!wheelDelta) return normalize(current, total, minimumVisible);
    // Continuous exponential scaling keeps a conventional ±100 mouse-wheel
    // notch close to the former 0.82/1.22 step while making tiny Mac
    // trackpad deltas proportionally small instead of treating every event as
    // a full zoom step.
    const factor = Math.exp(wheelDelta * .00198);
    const totalCount = Math.max(0, integer(total, 0));
    const minimum = clamp(integer(minimumVisible, 20), 1, Math.max(1, totalCount));
    const newCount = clamp(Math.round(current.visibleCount * factor), minimum, totalCount);
    if (newCount === current.visibleCount) return normalize(current, totalCount, minimumVisible);
    const anchorIndex = current.start + ratio * Math.max(0, current.visibleCount - 1);
    const desiredStart = anchorIndex - ratio * Math.max(0, newCount - 1);
    const newStart = clamp(Math.round(desiredStart), 0, Math.max(0, totalCount - newCount));
    return normalize({ visibleCount:newCount, offset:totalCount - newStart - newCount }, totalCount, minimumVisible);
  }

  function pan(view, total, deltaBars, minimumVisible) {
    const current = normalize(view, total, minimumVisible);
    return normalize({ visibleCount:current.visibleCount, offset:current.offset + integer(deltaBars, 0) }, total, minimumVisible);
  }

  function accumulateZoom(view, total, anchorRatio, deltaY, pendingDelta, minimumVisible, threshold) {
    const current = normalize(view, total, minimumVisible);
    const delta = Number(deltaY) || 0;
    let pending = Number(pendingDelta) || 0;
    if (!delta) return { view:current, pendingDelta:pending, changed:false };
    if (pending && Math.sign(pending) !== Math.sign(delta)) pending = 0;
    pending = clamp(pending + delta, -240, 240);
    if (Math.abs(pending) < Math.max(1, Number(threshold) || 8)) {
      return { view:current, pendingDelta:pending, changed:false };
    }
    const next = zoom(current, total, anchorRatio, pending, minimumVisible);
    const changed = next.visibleCount !== current.visibleCount || next.offset !== current.offset;
    // Preserve a sub-bar residual until rounding can cross a whole candle;
    // clearing it on an unchanged step makes small trackpad deltas get stuck.
    return { view:next, pendingDelta:changed ? 0 : pending, changed };
  }

  return { normalize, range, reset, zoom, pan, accumulateZoom };
});
