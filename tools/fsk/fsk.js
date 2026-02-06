document.addEventListener("DOMContentLoaded", () => {
  const modeTextBtn = document.getElementById("modeText");
  const modeBitsBtn = document.getElementById("modeBits");
  const modeHexBtn = document.getElementById("modeHex");
  const modeFileBtn = document.getElementById("modeFile");
  const textPanel = document.getElementById("textPanel");
  const bitsPanel = document.getElementById("bitsPanel");
  const hexPanel = document.getElementById("hexPanel");
  const filePanel = document.getElementById("filePanel");
  const textInput = document.getElementById("textInput");
  const bitsInput = document.getElementById("bitsInput");
  const hexInput = document.getElementById("hexInput");
  const fileInput = document.getElementById("fileInput");
  const fileInfo = document.getElementById("fileInfo");
  const encodingSelect = document.getElementById("encoding");
  const dataBitsSelect = document.getElementById("dataBits");
  const bitOrderSelect = document.getElementById("bitOrder");
  const startBitsInput = document.getElementById("startBits");
  const stopBitsInput = document.getElementById("stopBits");
  const preambleBitsInput = document.getElementById("preambleBits");
  const preambleRepeatInput = document.getElementById("preambleRepeat");
  const freqModeSelect = document.getElementById("freqMode");
  const freqDirectGroup = document.getElementById("freqDirect");
  const freqShiftGroup = document.getElementById("freqShift");
  const markFreqInput = document.getElementById("markFreq");
  const spaceFreqInput = document.getElementById("spaceFreq");
  const centerFreqInput = document.getElementById("centerFreq");
  const shiftFreqInput = document.getElementById("shiftFreq");
  const baudRateInput = document.getElementById("baudRate");
  const sampleRateSelect = document.getElementById("sampleRate");
  const amplitudeInput = document.getElementById("amplitude");
  const mappingSelect = document.getElementById("mapping");
  const hopModeSelect = document.getElementById("hopMode");
  const hopSettings = document.getElementById("hopSettings");
  const hopStepInput = document.getElementById("hopStep");
  const hopCountInput = document.getElementById("hopCount");
  const hopTrainingSelect = document.getElementById("hopTraining");
  const hopBitLengthInput = document.getElementById("hopBitLength");
  const hopBitPauseInput = document.getElementById("hopBitPause");
  const hopPauseInput = document.getElementById("hopPause");
  const leadInInput = document.getElementById("leadIn");
  const leadOutInput = document.getElementById("leadOut");
  const generateBtn = document.getElementById("generateBtn");
  const playBtn = document.getElementById("playBtn");
  const stopBtn = document.getElementById("stopBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const statusPill = document.getElementById("statusPill");
  const preview = document.getElementById("preview");
  const statBits = document.getElementById("statBits");
  const statBytes = document.getElementById("statBytes");
  const statDuration = document.getElementById("statDuration");
  const statSamples = document.getElementById("statSamples");
  const shiftIndicator = document.getElementById("shiftIndicator");
  const shiftSwatch = document.getElementById("shiftSwatch");
  const shiftLabel = document.getElementById("shiftLabel");
  const timingScroll = document.getElementById("timingScroll");
  const timingCanvas = document.getElementById("timingCanvas");
  const timingCtx = timingCanvas ? timingCanvas.getContext("2d") : null;
  const timingZoomInput = document.getElementById("timingZoom");
  const timingZoomValue = document.getElementById("timingZoomValue");
  const timingFitBtn = document.getElementById("timingFit");
  const timingFullscreenBtn = document.getElementById("timingFullscreen");
  const timingTrackSelect = document.getElementById("timingTrack");
  const timingBlock = document.getElementById("timingBlock") || timingCanvas?.closest(".timing-block");
  const timingActions = document.getElementById("timingActions");
  const actionsRow = document.getElementById("fskActions");
  const actionsHome = actionsRow ? { parent: actionsRow.parentElement, next: actionsRow.nextElementSibling } : null;

  let mode = "text";
  let currentUrl = null;
  let currentBlob = null;
  let fileBytes = null;
  let timingSegments = [];
  let timingOptions = null;
  let timingByteInfo = null;
  let timingByteSpans = [];
  let timingTimeline = [];
  let timingBitDuration = 0;
  let timingHasFreqSegments = false;
  let playheadTime = null;
  let playheadRaf = 0;
  let timingDrawRaf = 0;
  let hoverTime = null;
  let hoverByteIndex = null;
  let hoverSegmentIndex = null;
  let timingDuration = 0;
  let trackMode = timingTrackSelect ? timingTrackSelect.value : "off";
  const timingPixelsPerBit = 6;
  const timingPixelsPerHz = 0.12;
  const timingByteRowHeight = 18;
  let timingZoom = timingZoomInput ? Number.parseFloat(timingZoomInput.value) || 1 : 1;
  const timingPad = { left: 44, right: 12, top: 12 + timingByteRowHeight, bottom: 28 };

  function setStatus(state, label) {
    statusPill.dataset.state = state;
    statusPill.textContent = label || state;
  }

  function setMode(nextMode) {
    mode = nextMode;
    const isText = mode === "text";
    const isBits = mode === "bits";
    const isHex = mode === "hex";
    const isFile = mode === "file";
    const usesBytes = isText || isHex || isFile;

    modeTextBtn.classList.toggle("is-active", isText);
    modeBitsBtn.classList.toggle("is-active", isBits);
    modeHexBtn.classList.toggle("is-active", isHex);
    modeFileBtn.classList.toggle("is-active", isFile);
    textPanel.classList.toggle("hide", !isText);
    bitsPanel.classList.toggle("hide", !isBits);
    hexPanel.classList.toggle("hide", !isHex);
    filePanel.classList.toggle("hide", !isFile);
    encodingSelect.disabled = !isText;
    dataBitsSelect.disabled = !usesBytes;
    bitOrderSelect.disabled = !usesBytes;
    startBitsInput.disabled = !usesBytes;
    stopBitsInput.disabled = !usesBytes;
  }

  function setFreqMode(modeValue) {
    const isShift = modeValue === "shift";
    freqDirectGroup.classList.toggle("hide", isShift);
    freqShiftGroup.classList.toggle("hide", !isShift);
  }

  function setHopMode(modeValue) {
    const enabled = modeValue === "down";
    hopSettings.classList.toggle("hide", !enabled);
  }

  function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    if (min !== null && value < min) return min;
    if (max !== null && value > max) return max;
    return value;
  }

  function readNumber(el, min, max, fallback) {
    const value = Number.parseFloat(el.value);
    return clampNumber(value, min, max, fallback);
  }

  function readInteger(el, min, max, fallback) {
    const value = Number.parseInt(el.value, 10);
    return clampNumber(value, min, max, fallback);
  }

  function parseBits(raw) {
    const cleaned = (raw || "").replace(/[^01]/g, "");
    return cleaned.split("").map((bit) => (bit === "1" ? 1 : 0));
  }

  function bitsToBytes(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value << 1) | (bits[i + bit] || 0);
      }
      bytes.push(value);
    }
    return bytes;
  }

  function parseHex(raw) {
    const normalized = (raw || "").replace(/0x/gi, "");
    const invalid = normalized.match(/[^0-9a-fA-F\s,;:_-]/);
    if (invalid) {
      return { error: "invalid hex" };
    }
    const cleaned = normalized.replace(/[^0-9a-fA-F]/g, "");
    if (!cleaned.length) {
      return { bytes: [] };
    }
    if (cleaned.length % 2 !== 0) {
      return { error: "odd hex length" };
    }
    const bytes = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
    }
    return { bytes };
  }

  function encodeBytes(text, encoding) {
    if (encoding === "utf8") {
      return Array.from(new TextEncoder().encode(text));
    }
    if (encoding === "ascii7") {
      return Array.from(text, (char) => char.charCodeAt(0) & 0x7f);
    }
    return Array.from(text, (char) => char.charCodeAt(0) & 0xff);
  }

  function byteToBits(byte, width, order) {
    const bits = [];
    for (let i = 0; i < width; i += 1) {
      const shift = order === "lsb" ? i : width - 1 - i;
      bits.push((byte >> shift) & 1);
    }
    return bits;
  }

  function bytesToBitStream(bytes, dataBits, bitOrder, startBits, stopBits) {
    let bits = [];
    bytes.forEach((byte) => {
      for (let i = 0; i < startBits; i += 1) {
        bits.push(0);
      }
      bits = bits.concat(byteToBits(byte, dataBits, bitOrder));
      for (let i = 0; i < stopBits; i += 1) {
        bits.push(1);
      }
    });
    return bits;
  }

  function applyFade(samples, sampleRate, fadeMs, endIndex) {
    const maxIndex = Math.min(samples.length, endIndex || samples.length);
    const fadeSamples = Math.min(
      Math.floor((sampleRate * fadeMs) / 1000),
      Math.floor(maxIndex / 2)
    );
    for (let i = 0; i < fadeSamples; i += 1) {
      const gain = i / fadeSamples;
      samples[i] *= gain;
      samples[maxIndex - 1 - i] *= gain;
    }
  }

  function applyLowPass(samples, sampleRate, cutoffHz) {
    if (!Number.isFinite(cutoffHz) || cutoffHz <= 0) return;
    const dt = 1 / sampleRate;
    const rc = 1 / (2 * Math.PI * cutoffHz);
    const alpha = dt / (rc + dt);
    let last = samples[0] || 0;
    for (let i = 1; i < samples.length; i += 1) {
      last += alpha * (samples[i] - last);
      samples[i] = last;
    }
  }

  function concatFloat32(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Float32Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
      output.set(chunk, offset);
      offset += chunk.length;
    });
    return output;
  }

  function setTimingZoom(value) {
    timingZoom = clampNumber(value, 0.25, 6, 1);
    if (timingZoomInput) {
      timingZoomInput.value = timingZoom.toString();
    }
    if (timingZoomValue) {
      timingZoomValue.textContent = `${timingZoom.toFixed(2)}x`;
    }
  }

  function getTimingScale() {
    const baudRate = timingOptions ? timingOptions.baudRate || 1200 : 1200;
    return timingPixelsPerBit * baudRate * timingZoom;
  }

  function setTimingCanvasSize(totalDuration, range) {
    if (!timingCanvas || !timingScroll) return;
    const scale = getTimingScale();
    const targetWidth = Math.max(timingScroll.clientWidth, totalDuration * scale);
    timingCanvas.style.width = `${Math.round(targetWidth)}px`;
    const targetHeight = Math.max(
      timingScroll.clientHeight || 220,
      range * timingPixelsPerHz
    );
    timingCanvas.style.height = `${Math.round(targetHeight)}px`;
  }

  function getTimingDimensions() {
    const width = timingCanvas ? timingCanvas.clientWidth : 0;
    const height = timingCanvas ? timingCanvas.clientHeight : 0;
    const innerWidth = Math.max(1, width - timingPad.left - timingPad.right);
    const innerHeight = Math.max(1, height - timingPad.top - timingPad.bottom);
    return { width, height, innerWidth, innerHeight };
  }

  function timeFromX(x, totalDuration) {
    const { innerWidth } = getTimingDimensions();
    if (!innerWidth || totalDuration <= 0) return 0;
    const clamped = Math.max(0, x - timingPad.left);
    const time = (clamped / innerWidth) * totalDuration;
    return Math.max(0, Math.min(totalDuration, time));
  }

  function centerOnTime(time) {
    if (!timingScroll || !timingCanvas || timingDuration <= 0) return;
    const { innerWidth } = getTimingDimensions();
    const clampedTime = Math.max(0, Math.min(timingDuration, time || 0));
    const x = timingPad.left + (clampedTime / timingDuration) * innerWidth;
    const target = x - timingScroll.clientWidth / 2;
    const maxScroll = Math.max(0, timingCanvas.clientWidth - timingScroll.clientWidth);
    timingScroll.scrollLeft = Math.max(0, Math.min(maxScroll, target));
  }

  function getCenterTime() {
    if (!timingScroll || timingDuration <= 0) return 0;
    const { innerWidth } = getTimingDimensions();
    if (!innerWidth) return 0;
    const centerX = timingScroll.scrollLeft + timingScroll.clientWidth / 2;
    const time = ((centerX - timingPad.left) / innerWidth) * timingDuration;
    return Math.max(0, Math.min(timingDuration, time));
  }

  function getDisplayTime() {
    if (playheadTime !== null) return playheadTime;
    return null;
  }

  function scheduleTimingDraw() {
    if (playheadRaf) return;
    if (timingDrawRaf) return;
    timingDrawRaf = requestAnimationFrame(() => {
      timingDrawRaf = 0;
      if (timingSegments.length) {
        drawTimingMap(timingSegments, getDisplayTime());
      }
    });
  }

  function buildTimingTimeline(segments) {
    let cursor = 0;
    const timeline = [];
    let hasFreq = false;
    segments.forEach((segment) => {
      const start = cursor;
      const end = cursor + segment.duration;
      if (!hasFreq && Number.isFinite(segment.freq)) {
        hasFreq = true;
      }
      timeline.push({ start, end, segment });
      cursor = end;
    });
    timingTimeline = timeline;
    timingDuration = cursor;
    timingHasFreqSegments = hasFreq;
    const bitSegment = segments.find((segment) => segment.kind === "bit");
    timingBitDuration = bitSegment ? bitSegment.duration : 0;
  }

  function updateTimingByteSpans() {
    timingByteSpans = [];
    if (!timingByteInfo || !timingTimeline.length) return;
    let nextByteStart = timingByteInfo.dataStartBit;
    const frameBits = timingByteInfo.frameBits;
    let byteIndex = 0;
    let byteStartTime = null;
    timingTimeline.forEach((entry) => {
      const segment = entry.segment;
      if (
        segment.kind === "bit"
        && segment.phase === "data"
        && frameBits > 0
        && byteIndex < timingByteInfo.bytes.length
      ) {
        if (segment.bitIndex === nextByteStart) {
          byteStartTime = entry.start;
        }
        if (segment.bitIndex === nextByteStart + frameBits - 1) {
          timingByteSpans.push({
            start: byteStartTime ?? entry.start,
            end: entry.end,
            index: byteIndex
          });
          byteIndex += 1;
          nextByteStart += frameBits;
          byteStartTime = null;
        }
      }
    });
  }

  function findTimelineIndex(timeSec) {
    if (!timingTimeline.length || !Number.isFinite(timeSec)) return -1;
    let low = 0;
    let high = timingTimeline.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = timingTimeline[mid];
      if (timeSec < entry.start) {
        high = mid - 1;
      } else if (timeSec > entry.end) {
        low = mid + 1;
      } else {
        return mid;
      }
    }
    const index = Math.max(0, Math.min(timingTimeline.length - 1, low));
    return index;
  }

  function findSegmentAtTime(timeSec) {
    if (!timingTimeline.length || !Number.isFinite(timeSec)) return null;
    if (timeSec < 0 || timeSec > timingDuration) return null;
    const index = findTimelineIndex(timeSec);
    if (index < 0) return null;
    const entry = timingTimeline[index];
    return { segment: entry.segment, start: entry.start, end: entry.end, index };
  }

  function findByteSpanAtTime(timeSec) {
    if (!timingByteSpans.length || !Number.isFinite(timeSec)) return null;
    const index = findByteSpanIndex(timeSec);
    if (index < 0) return null;
    const span = timingByteSpans[index];
    if (!span || timeSec < span.start || timeSec > span.end) return null;
    return span;
  }

  function findByteSpanIndex(timeSec) {
    if (!timingByteSpans.length || !Number.isFinite(timeSec)) return -1;
    let low = 0;
    let high = timingByteSpans.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const span = timingByteSpans[mid];
      if (timeSec < span.start) {
        high = mid - 1;
      } else if (timeSec > span.end) {
        low = mid + 1;
      } else {
        return mid;
      }
    }
    const index = Math.max(0, Math.min(timingByteSpans.length - 1, low));
    return index;
  }

  function getVisibleTimeRange(totalDuration, innerWidth, padLeft) {
    if (!timingScroll || !Number.isFinite(totalDuration) || totalDuration <= 0 || innerWidth <= 0) {
      return { start: 0, end: totalDuration };
    }
    const viewLeft = timingScroll.scrollLeft;
    const viewRight = viewLeft + timingScroll.clientWidth;
    const leftX = Math.max(0, Math.min(innerWidth, viewLeft - padLeft));
    const rightX = Math.max(0, Math.min(innerWidth, viewRight - padLeft));
    const startTime = (leftX / innerWidth) * totalDuration;
    const endTime = (rightX / innerWidth) * totalDuration;
    const margin = timingBitDuration ? timingBitDuration * 2 : totalDuration * 0.01;
    return {
      start: Math.max(0, Math.min(totalDuration, startTime - margin)),
      end: Math.max(0, Math.min(totalDuration, endTime + margin))
    };
  }

  function getVisibleTimelineRange(startTime, endTime) {
    if (!timingTimeline.length) return { startIndex: 0, endIndex: -1 };
    const startIndex = findTimelineIndex(startTime);
    const endIndex = findTimelineIndex(endTime);
    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.max(0, endIndex)
    };
  }

  function getTrackCenterTime(modeValue, timeSec) {
    if (!Number.isFinite(timeSec)) return null;
    if (modeValue === "byte") {
      const span = findByteSpanAtTime(timeSec);
      if (span) {
        return (span.start + span.end) / 2;
      }
      return timeSec;
    }
    if (modeValue === "bit") {
      const match = findSegmentAtTime(timeSec);
      if (match && match.segment.kind === "bit") {
        return (match.start + match.end) / 2;
      }
      return timeSec;
    }
    if (modeValue === "playhead") return timeSec;
    return null;
  }

  function moveActions(toTiming) {
    if (!actionsRow || !actionsHome) return;
    if (toTiming) {
      if (timingActions) {
        timingActions.appendChild(actionsRow);
      }
      return;
    }
    if (actionsHome.next && actionsHome.next.parentElement === actionsHome.parent) {
      actionsHome.parent.insertBefore(actionsRow, actionsHome.next);
    } else {
      actionsHome.parent.appendChild(actionsRow);
    }
  }

  function fitTimingToView() {
    if (!timingSegments.length || !timingScroll) return;
    const totalDuration = timingDuration || timingSegments.reduce((sum, segment) => sum + segment.duration, 0);
    if (totalDuration <= 0) return;
    const baseScale = timingPixelsPerBit * (timingOptions ? timingOptions.baudRate || 1200 : 1200);
    const targetScale = timingScroll.clientWidth / totalDuration;
    const zoom = targetScale / baseScale;
    setTimingZoom(zoom);
    drawTimingMap(timingSegments, getDisplayTime());
  }

  function resizeTimingCanvas() {
    if (!timingCanvas || !timingCtx) return;
    const rect = timingCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (timingCanvas.width === width && timingCanvas.height === height) return;
    timingCanvas.width = width;
    timingCanvas.height = height;
    timingCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawTimingMap(segments, playheadSec = null) {
    if (!timingCanvas || !timingCtx) return;
    const totalDuration = timingDuration || segments.reduce((sum, segment) => sum + segment.duration, 0);
    if (!timingTimeline.length && segments.length) {
      buildTimingTimeline(segments);
      updateTimingByteSpans();
    }
    if (timingDuration !== totalDuration) {
      timingDuration = totalDuration;
    }
    const ctx = timingCtx;

    const style = getComputedStyle(document.body);
    const bg = style.getPropertyValue("--bg-2").trim() || "#1c1518";
    const border = style.getPropertyValue("--border").trim() || "rgba(255,255,255,0.2)";
    const muted = style.getPropertyValue("--muted").trim() || "#d7c1c1";

    if (!timingHasFreqSegments) {
      ctx.fillStyle = muted;
      ctx.font = "14px 'Smooch Sans', sans-serif";
      ctx.fillText("No timing data yet", 16, 28);
      return;
    }

    const guideLines = [];
    if (timingOptions) {
      const hopSteps = Math.max(1, timingOptions.hopSteps || 1);
      const hopStepHz = timingOptions.hopStepHz || 0;
      for (let step = 0; step < (timingOptions.hopEnabled ? hopSteps : 1); step += 1) {
        const offset = -hopStepHz * step;
        guideLines.push({ freq: timingOptions.markFreq + offset, level: "high", shiftIndex: step });
        guideLines.push({ freq: timingOptions.spaceFreq + offset, level: "low", shiftIndex: step });
      }
    }

    const allFreqs = guideLines.length
      ? guideLines.map((line) => line.freq)
      : timingTimeline
        .map((entry) => entry.segment.freq)
        .filter((freq) => Number.isFinite(freq));
    let minFreq = Math.min(...allFreqs);
    let maxFreq = Math.max(...allFreqs);
    if (minFreq === maxFreq) {
      const pad = Math.max(20, minFreq * 0.1);
      minFreq = Math.max(0, minFreq - pad);
      maxFreq += pad;
    } else {
      const pad = Math.max(10, (maxFreq - minFreq) * 0.08);
      minFreq = Math.max(0, minFreq - pad);
      maxFreq += pad;
    }
    const range = Math.max(1, maxFreq - minFreq);
    setTimingCanvasSize(totalDuration, range);
    resizeTimingCanvas();
    const width = timingCanvas.clientWidth;
    const height = timingCanvas.clientHeight;
    if (timingScroll) {
      const maxScrollLeft = Math.max(0, width - timingScroll.clientWidth);
      const maxScrollTop = Math.max(0, height - timingScroll.clientHeight);
      if (timingScroll.scrollLeft > maxScrollLeft) timingScroll.scrollLeft = maxScrollLeft;
      if (timingScroll.scrollLeft < 0) timingScroll.scrollLeft = 0;
      if (timingScroll.scrollTop > maxScrollTop) timingScroll.scrollTop = maxScrollTop;
      if (timingScroll.scrollTop < 0) timingScroll.scrollTop = 0;
    }
    const clipX = timingScroll ? timingScroll.scrollLeft : 0;
    const clipY = timingScroll ? timingScroll.scrollTop : 0;
    const clipW = timingScroll ? timingScroll.clientWidth : width;
    const clipH = timingScroll ? timingScroll.clientHeight : height;
    const safeClipW = Math.max(0, Math.min(width - clipX, clipW));
    const safeClipH = Math.max(0, Math.min(height - clipY, clipH));
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, safeClipW, safeClipH);
    ctx.clip();
    ctx.clearRect(clipX, clipY, safeClipW, safeClipH);
    ctx.fillStyle = bg;
    ctx.fillRect(clipX, clipY, safeClipW, safeClipH);
    const padLeft = timingPad.left;
    const padRight = timingPad.right;
    const padTop = timingPad.top;
    const padBottom = timingPad.bottom;
    const innerWidth = width - padLeft - padRight;
    const innerHeight = height - padTop - padBottom;
    const visibleRange = getVisibleTimeRange(totalDuration, innerWidth, padLeft);

    const freqToY = (freq) => padTop + ((maxFreq - freq) / range) * innerHeight;
    const totalShifts = timingOptions ? Math.max(1, timingOptions.hopSteps || 1) : 1;

    const byteSpans = timingByteSpans;
    const startByteIndex = byteSpans.length ? findByteSpanIndex(visibleRange.start) : -1;
    const endByteIndex = byteSpans.length ? findByteSpanIndex(visibleRange.end) : -1;
    const byteRangeStart = Math.max(0, startByteIndex);
    const byteRangeEnd = Math.min(byteSpans.length - 1, endByteIndex);
    if (byteSpans.length && byteRangeEnd >= byteRangeStart) {
      const bandTop = padTop - timingByteRowHeight;
      const bandHeight = innerHeight + timingByteRowHeight;
      const activeByteSpan = playheadSec !== null ? findByteSpanAtTime(playheadSec) : null;
      for (let i = byteRangeStart; i <= byteRangeEnd; i += 1) {
        const span = byteSpans[i];
        if (!span) break;
        const spanStart = span.start / totalDuration;
        const spanEnd = span.end / totalDuration;
        const spanX = padLeft + spanStart * innerWidth;
        const spanW = Math.max(1, (spanEnd - spanStart) * innerWidth);
        const even = span.index % 2 === 0;
        ctx.fillStyle = even ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.2)";
        ctx.fillRect(spanX, bandTop, spanW, bandHeight);
      }
      const hoverSpan = hoverByteIndex !== null ? byteSpans[hoverByteIndex] : null;
      if (hoverSpan && !(hoverSpan.end < visibleRange.start || hoverSpan.start > visibleRange.end)) {
        const spanStart = hoverSpan.start / totalDuration;
        const spanEnd = hoverSpan.end / totalDuration;
        const spanX = padLeft + spanStart * innerWidth;
        const spanW = Math.max(1, (spanEnd - spanStart) * innerWidth);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(spanX, bandTop, spanW, bandHeight);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.strokeRect(spanX, bandTop, spanW, bandHeight);
      }
      if (activeByteSpan && !(activeByteSpan.end < visibleRange.start || activeByteSpan.start > visibleRange.end)) {
        const spanStart = activeByteSpan.start / totalDuration;
        const spanEnd = activeByteSpan.end / totalDuration;
        const spanX = padLeft + spanStart * innerWidth;
        const spanW = Math.max(1, (spanEnd - spanStart) * innerWidth);
        ctx.fillStyle = "rgba(255,80,80,0.18)";
        ctx.fillRect(spanX, bandTop, spanW, bandHeight);
        ctx.strokeStyle = "rgba(255,80,80,0.6)";
        ctx.strokeRect(spanX, bandTop, spanW, bandHeight);
      }
    }

    guideLines.forEach((line) => {
      if (!Number.isFinite(line.freq)) return;
      const y = freqToY(line.freq);
      const lineColor = line.level === "high"
        ? shiftColor("high", line.shiftIndex, totalShifts, 0.4)
        : shiftColor("low", line.shiftIndex, totalShifts, 0.4);
      ctx.strokeStyle = lineColor;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillStyle = line.level === "high"
        ? shiftColor("high", line.shiftIndex, totalShifts, 0.9)
        : shiftColor("low", line.shiftIndex, totalShifts, 0.9);
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillText(`${Math.round(line.freq)} Hz`, 6, y + 4);
    });

    const lineHeight = 4;
    const separatorColor = "rgba(255,255,255,0.16)";
    const bitDuration = timingBitDuration || 0;
    const pixelsPerBit = bitDuration ? (bitDuration / totalDuration) * innerWidth : 0;
    const showSeparators = pixelsPerBit >= 6;

    const visibleTimeline = getVisibleTimelineRange(visibleRange.start, visibleRange.end);
    const startIndex = Math.max(0, visibleTimeline.startIndex);
    const endIndex = Math.min(timingTimeline.length - 1, visibleTimeline.endIndex);
    for (let i = startIndex; i <= endIndex; i += 1) {
      const entry = timingTimeline[i];
      if (!entry) break;
      const segment = entry.segment;
      const segWidth = Math.max(1, ((entry.end - entry.start) / totalDuration) * innerWidth);
      const x = padLeft + (entry.start / totalDuration) * innerWidth;
      if (showSeparators && segment.kind === "bit" && segment.bitIndex > 0) {
        ctx.strokeStyle = separatorColor;
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + innerHeight);
        ctx.stroke();
      }
      if (Number.isFinite(segment.freq)) {
        const y = freqToY(segment.freq);
        if (segment.kind === "lead") {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
        } else if (segment.level === "high") {
          ctx.fillStyle = shiftColor("high", segment.shiftIndex || 0, totalShifts, 1);
        } else if (segment.level === "low") {
          ctx.fillStyle = shiftColor("low", segment.shiftIndex || 0, totalShifts, 1);
        } else {
          ctx.fillStyle = shiftColor("low", segment.shiftIndex || 0, totalShifts, 1);
        }
        ctx.fillRect(x, y - lineHeight / 2, segWidth, lineHeight);
      }
    }

    if (timingByteInfo && byteSpans.length && byteRangeEnd >= byteRangeStart) {
      const byteRowTop = padTop - timingByteRowHeight;
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(padLeft, padTop - 1);
      ctx.lineTo(width - padRight, padTop - 1);
      ctx.stroke();
      ctx.font = "11px 'JetBrains Mono', monospace";
      for (let i = byteRangeStart; i <= byteRangeEnd; i += 1) {
        const span = byteSpans[i];
        if (!span) break;
        const spanStart = span.start / totalDuration;
        const spanEnd = span.end / totalDuration;
        const spanX = padLeft + spanStart * innerWidth;
        const spanW = Math.max(1, (spanEnd - spanStart) * innerWidth);
        const value = timingByteInfo.bytes[span.index];
        const hex = value.toString(16).padStart(2, "0").toUpperCase();
        const ascii = value >= 32 && value <= 126 ? String.fromCharCode(value) : ".";
        const label = `${hex} ${ascii}`;
        const labelWidth = ctx.measureText(label).width;
        const hexWidth = ctx.measureText(hex).width;
        if (spanW >= labelWidth + 6) {
          ctx.fillStyle = span.index === hoverByteIndex ? "#ffffff" : muted;
          ctx.fillText(label, spanX + (spanW - labelWidth) / 2, byteRowTop + timingByteRowHeight - 4);
        } else if (spanW >= hexWidth + 6) {
          ctx.fillStyle = span.index === hoverByteIndex ? "#ffffff" : muted;
          ctx.fillText(hex, spanX + (spanW - hexWidth) / 2, byteRowTop + timingByteRowHeight - 4);
        }
      }
    }

    const hoverEntry = hoverSegmentIndex !== null ? timingTimeline[hoverSegmentIndex] : null;
    const hoverInfo = hoverEntry
      ? { segment: hoverEntry.segment, start: hoverEntry.start, end: hoverEntry.end }
      : null;
    const activeInfo = playheadSec !== null ? findSegmentAtTime(playheadSec) : null;

    if (hoverInfo && hoverInfo.segment.kind === "bit") {
      if (!(hoverInfo.end < visibleRange.start || hoverInfo.start > visibleRange.end)) {
        const highlightX = padLeft + (hoverInfo.start / totalDuration) * innerWidth;
        const highlightW = Math.max(2, ((hoverInfo.end - hoverInfo.start) / totalDuration) * innerWidth);
        ctx.fillStyle = "rgba(255,80,80,0.12)";
        ctx.fillRect(highlightX, padTop, highlightW, innerHeight);
        if (Number.isFinite(hoverInfo.segment.freq)) {
          const y = freqToY(hoverInfo.segment.freq);
          ctx.strokeStyle = "rgba(255,120,120,0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(highlightX, y);
          ctx.lineTo(highlightX + highlightW, y);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    }

    if (activeInfo && activeInfo.segment.kind === "bit") {
      const highlightX = padLeft + (activeInfo.start / totalDuration) * innerWidth;
      const highlightW = Math.max(2, ((activeInfo.end - activeInfo.start) / totalDuration) * innerWidth);
      ctx.fillStyle = "rgba(255,60,60,0.28)";
      ctx.fillRect(highlightX, padTop, highlightW, innerHeight);
      if (Number.isFinite(activeInfo.segment.freq)) {
        const y = freqToY(activeInfo.segment.freq);
        ctx.strokeStyle = "rgba(255,90,90,0.95)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(highlightX, y);
        ctx.lineTo(highlightX + highlightW, y);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    updateShiftIndicator(activeInfo ? activeInfo.segment : null);

    const timeTicks = 5;
    ctx.fillStyle = muted;
    ctx.font = "11px 'JetBrains Mono', monospace";
    for (let i = 0; i <= timeTicks; i += 1) {
      const t = (i / timeTicks) * totalDuration;
      const x = padLeft + (t / totalDuration) * innerWidth;
      ctx.beginPath();
      ctx.moveTo(x, height - padBottom + 2);
      ctx.lineTo(x, height - padBottom + 8);
      ctx.stroke();
      ctx.fillText(`${t.toFixed(2)}s`, x - 10, height - 6);
    }

    if (playheadSec !== null && playheadSec >= 0 && playheadSec <= totalDuration) {
      const x = padLeft + (playheadSec / totalDuration) * innerWidth;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + innerHeight);
      ctx.stroke();
    }
    ctx.restore();
  }

  function shiftHue(index) {
    return (20 + index * 137.5) % 360;
  }

  function shiftColor(level, index, total, alpha = 1) {
    const hue = shiftHue(index % Math.max(1, total));
    const lightness = level === "high" ? 62 : 34;
    const saturation = 82;
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
  }

  function updateShiftIndicator(segment) {
    if (!shiftSwatch || !shiftLabel) return;
    if (!segment || segment.kind !== "bit") {
      shiftSwatch.style.background = "#2a1d20";
      shiftLabel.textContent = "idle";
      return;
    }
    const total = timingOptions ? Math.max(1, timingOptions.hopSteps || 1) : 1;
    const index = segment.shiftIndex || 0;
    const level = segment.level || "high";
    shiftSwatch.style.background = shiftColor(level, index, total, 1);
    const label = total > 1 ? `shift ${index + 1} / ${total}` : "shift 1";
    shiftLabel.textContent = label;
  }

  function freqForBit(bit, bitIndex, options) {
    const hopEnabled = options.hopEnabled;
    const hopStepHz = options.hopStepHz || 0;
    const hopSteps = Math.max(1, options.hopSteps || 1);
    const offset = hopEnabled ? -hopStepHz * (bitIndex % hopSteps) : 0;
    const highFreq = options.markFreq + offset;
    const lowFreq = options.spaceFreq + offset;
    if (bit === 1) {
      return options.mapping === "mark" ? highFreq : lowFreq;
    }
    return options.mapping === "mark" ? lowFreq : highFreq;
  }

  function buildTimingSegments(bits, options) {
    const segments = [];
    const dataBitDuration = 1 / options.baudRate;
    const trainingBitDuration = options.trainingBitMs
      ? options.trainingBitMs / 1000
      : dataBitDuration;
    function bitLevel(bit) {
      if (bit === 1) {
        return options.mapping === "mark" ? "high" : "low";
      }
      return options.mapping === "mark" ? "low" : "high";
    }
    function addBits(bitArray, phase, leadInMs, leadOutMs, interBitPauseMs, bitDuration) {
      if (leadInMs > 0) {
        segments.push({
          duration: leadInMs / 1000,
          freq: options.markFreq,
          phase: "lead",
          kind: "lead"
        });
      }
      bitArray.forEach((bit, index) => {
        const hopSteps = Math.max(1, options.hopSteps || 1);
        const shiftIndex = options.hopEnabled ? index % hopSteps : 0;
        segments.push({
          duration: bitDuration,
          freq: freqForBit(bit, index, options),
          phase,
          kind: "bit",
          bitIndex: index,
          level: bitLevel(bit),
          shiftIndex
        });
        if (interBitPauseMs > 0 && index < bitArray.length - 1) {
          segments.push({
            duration: interBitPauseMs / 1000,
            freq: null,
            phase: "pause",
            kind: "pause"
          });
        }
      });
      if (leadOutMs > 0) {
        segments.push({
          duration: leadOutMs / 1000,
          freq: null,
          phase: "tail",
          kind: "tail"
        });
      }
    }

    if (options.trainingBits && options.trainingBits.length) {
      addBits(
        options.trainingBits,
        "training",
        options.leadInMs,
        0,
        options.trainingBitPauseMs,
        trainingBitDuration
      );
      if (options.trainingPauseMs > 0) {
        segments.push({
          duration: options.trainingPauseMs / 1000,
          freq: null,
          phase: "pause",
          kind: "pause"
        });
      }
    }

    const dataLeadIn = options.trainingBits && options.trainingBits.length ? 0 : options.leadInMs;
    addBits(bits, "data", dataLeadIn, options.leadOutMs, 0, dataBitDuration);
    return segments;
  }
  function buildBitStream() {
    const preamble = parseBits(preambleBitsInput.value);
    const preambleRepeat = readInteger(preambleRepeatInput, 0, 50, 0);
    let bits = [];
    let bytesCount = 0;
    let error = "";
    let bytes = [];
    let dataBits = 8;
    let startBits = 0;
    let stopBits = 0;
    const usesFraming = mode !== "bits";

    if (mode === "text" || mode === "hex" || mode === "file") {
      dataBits = readInteger(dataBitsSelect, 7, 8, 8);
      const bitOrder = bitOrderSelect.value;
      startBits = readInteger(startBitsInput, 0, 2, 1);
      stopBits = readInteger(stopBitsInput, 0, 3, 1);

      if (mode === "text") {
        const encoding = encodingSelect.value;
        bytes = encodeBytes(textInput.value || "", encoding);
      } else if (mode === "hex") {
        const parsed = parseHex(hexInput.value);
        if (parsed.error) {
          error = parsed.error;
        } else {
          bytes = parsed.bytes;
        }
      } else if (!fileBytes || fileBytes.length === 0) {
        error = "no file";
      } else {
        bytes = Array.from(fileBytes);
      }

      bytesCount = bytes.length;
      if (!error) {
        bits = bytesToBitStream(bytes, dataBits, bitOrder, startBits, stopBits);
      }
    } else {
      bits = parseBits(bitsInput.value);
      bytesCount = Math.ceil(bits.length / 8);
      bytes = bitsToBytes(bits);
    }

    if (error) {
      return {
        bits: [],
        bytesCount: 0,
        bytes: [],
        dataBits,
        startBits,
        stopBits,
        usesFraming,
        error
      };
    }

    if (preamble.length > 0 && preambleRepeat > 0) {
      const prefix = [];
      for (let i = 0; i < preambleRepeat; i += 1) {
        prefix.push(...preamble);
      }
      bits = prefix.concat(bits);
    }

    return {
      bits,
      bytesCount,
      bytes,
      dataBits,
      startBits,
      stopBits,
      usesFraming
    };
  }

  function buildWaveWithPauses(bits, options) {
    const sampleRate = options.sampleRate;
    const bitSamples = Math.max(1, Math.round(sampleRate / options.baudRate));
    const interPause = Math.max(0, options.interBitPauseSamples || 0);
    const leadInSamples = Math.max(0, Math.round((sampleRate * options.leadInMs) / 1000));
    const leadOutSamples = Math.max(0, Math.round((sampleRate * options.leadOutMs) / 1000));
    const totalSamples = leadInSamples
      + bits.length * bitSamples
      + Math.max(0, bits.length - 1) * interPause
      + leadOutSamples;
    const samples = new Float32Array(totalSamples);
    const baseMarkFreq = options.markFreq;
    const baseSpaceFreq = options.spaceFreq;
    const amplitude = options.amplitude;
    const oneIsMark = options.mapping === "mark";
    const hopEnabled = options.hopEnabled;
    const hopStepHz = options.hopStepHz || 0;
    const hopSteps = Math.max(1, options.hopSteps || 1);
    const transitionMs = Number.isFinite(options.transitionMs) ? options.transitionMs : 1;
    const transitionSamples = Math.max(
      1,
      Math.min(
        Math.round((sampleRate * transitionMs) / 1000),
        Math.floor(bitSamples / 2)
      )
    );
    const pauseFadeSamples = interPause > 0
      ? Math.max(
        1,
        Math.min(
          interPause,
          Math.floor(bitSamples / 3),
          Math.round(sampleRate * 0.003)
        )
      )
      : 0;
    let phase = 0;
    let currentFreq = baseMarkFreq;
    let targetFreq = currentFreq;
    let transitionRemaining = 0;
    let freqStep = 0;
    let writeIndex = 0;

    function hopOffset(bitIndex) {
      if (!hopEnabled) return 0;
      const stepIndex = bitIndex % hopSteps;
      return -hopStepHz * stepIndex;
    }

    for (let i = 0; i < leadInSamples; i += 1) {
      phase += (2 * Math.PI * currentFreq) / sampleRate;
      samples[writeIndex++] = Math.sin(phase) * amplitude;
    }

    for (let bitIndex = 0; bitIndex < bits.length; bitIndex += 1) {
      const bit = bits[bitIndex] || 0;
      const offset = hopOffset(bitIndex);
      const highFreq = baseMarkFreq + offset;
      const lowFreq = baseSpaceFreq + offset;
      targetFreq = bit === 1
        ? (oneIsMark ? highFreq : lowFreq)
        : (oneIsMark ? lowFreq : highFreq);
      if (targetFreq !== currentFreq) {
        transitionRemaining = transitionSamples;
        freqStep = (targetFreq - currentFreq) / transitionRemaining;
      }
      for (let s = 0; s < bitSamples; s += 1) {
        if (transitionRemaining > 0) {
          currentFreq += freqStep;
          transitionRemaining -= 1;
          if (transitionRemaining === 0) {
            currentFreq = targetFreq;
          }
        }
        phase += (2 * Math.PI * currentFreq) / sampleRate;
        let gain = 1;
        if (pauseFadeSamples > 0) {
          if (bitIndex > 0 && s < pauseFadeSamples) {
            gain *= s / pauseFadeSamples;
          }
          if (bitIndex < bits.length - 1 && s >= bitSamples - pauseFadeSamples) {
            gain *= (bitSamples - s - 1) / pauseFadeSamples;
          }
        }
        samples[writeIndex++] = Math.sin(phase) * amplitude * gain;
      }
      if (bitIndex < bits.length - 1 && interPause > 0) {
        for (let p = 0; p < interPause; p += 1) {
          phase += (2 * Math.PI * currentFreq) / sampleRate;
          samples[writeIndex++] = 0;
        }
      }
    }

    const audioEnd = leadInSamples
      + bits.length * bitSamples
      + Math.max(0, bits.length - 1) * interPause;
    applyFade(samples, sampleRate, 6, audioEnd);
    if (options.enableAntiAlias) {
      applyLowPass(samples, sampleRate, options.antiAliasCutoff);
    }
    return samples;
  }

  function buildWave(bits, options) {
    const sampleRate = options.sampleRate;
    if (options.interBitPauseSamples && options.interBitPauseSamples > 0) {
      return buildWaveWithPauses(bits, options);
    }
    const samplesPerBit = sampleRate / options.baudRate;
    const totalBitSamples = Math.max(1, Math.round(bits.length * samplesPerBit));
    const leadInSamples = Math.max(0, Math.round((sampleRate * options.leadInMs) / 1000));
    const leadOutSamples = Math.max(0, Math.round((sampleRate * options.leadOutMs) / 1000));
    const totalSamples = leadInSamples + totalBitSamples + leadOutSamples;
    const samples = new Float32Array(totalSamples);
    const baseMarkFreq = options.markFreq;
    const baseSpaceFreq = options.spaceFreq;
    const amplitude = options.amplitude;
    const oneIsMark = options.mapping === "mark";
    const hopEnabled = options.hopEnabled;
    const hopStepHz = options.hopStepHz || 0;
    const hopSteps = Math.max(1, options.hopSteps || 1);
    const transitionMs = Number.isFinite(options.transitionMs) ? options.transitionMs : 1;
    const transitionSamples = Math.max(
      1,
      Math.min(
        Math.round((sampleRate * transitionMs) / 1000),
        Math.floor(samplesPerBit / 2)
      )
    );
    let phase = 0;
    let currentFreq = baseMarkFreq;
    let targetFreq = currentFreq;
    let currentBitIndex = -1;
    let transitionRemaining = 0;
    let freqStep = 0;

    function hopOffset(bitIndex) {
      if (!hopEnabled) return 0;
      const stepIndex = bitIndex % hopSteps;
      return -hopStepHz * stepIndex;
    }

    for (let i = 0; i < leadInSamples; i += 1) {
      phase += (2 * Math.PI * currentFreq) / sampleRate;
      samples[i] = Math.sin(phase) * amplitude;
    }

    for (let i = 0; i < totalBitSamples; i += 1) {
      const bitIndex = Math.min(bits.length - 1, Math.floor(i / samplesPerBit));
      if (bitIndex !== currentBitIndex) {
        currentBitIndex = bitIndex;
        const bit = bits[bitIndex] || 0;
        const offset = hopOffset(bitIndex);
        const highFreq = baseMarkFreq + offset;
        const lowFreq = baseSpaceFreq + offset;
        targetFreq = bit === 1
          ? (oneIsMark ? highFreq : lowFreq)
          : (oneIsMark ? lowFreq : highFreq);
        if (targetFreq !== currentFreq) {
          transitionRemaining = transitionSamples;
          freqStep = (targetFreq - currentFreq) / transitionRemaining;
        }
      }
      if (transitionRemaining > 0) {
        currentFreq += freqStep;
        transitionRemaining -= 1;
        if (transitionRemaining === 0) {
          currentFreq = targetFreq;
        }
      }
      phase += (2 * Math.PI * currentFreq) / sampleRate;
      samples[leadInSamples + i] = Math.sin(phase) * amplitude;
    }

    applyFade(samples, sampleRate, 6, leadInSamples + totalBitSamples);
    if (options.enableAntiAlias) {
      applyLowPass(samples, sampleRate, options.antiAliasCutoff);
    }
    return samples;
  }

  function writeString(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  function encodeWav(samples, sampleRate) {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * bytesPerSample, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
    return buffer;
  }

  function setAudioBlob(blob) {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    currentBlob = blob;
    currentUrl = URL.createObjectURL(blob);
    preview.src = currentUrl;
    preview.load();
  }

  function setActionState(enabled) {
    playBtn.disabled = !enabled;
    stopBtn.disabled = !enabled;
    downloadBtn.disabled = !enabled;
  }

  function updateStats(bitsCount, bytesCount, samplesCount, sampleRate) {
    statBits.textContent = `${bitsCount}`;
    statBytes.textContent = `${bytesCount}`;
    const duration = samplesCount / sampleRate;
    statDuration.textContent = `${duration.toFixed(2)}s`;
    statSamples.textContent = `${samplesCount}`;
  }

  function generate() {
    setStatus("idle", "working");
    const result = buildBitStream();
    if (result.error) {
      setStatus("error", result.error);
      setActionState(false);
      updateStats(0, 0, 0, 1);
      return;
    }
    const { bits, bytesCount } = result;
    if (!bits.length) {
      setStatus("error", "no data");
      setActionState(false);
      updateStats(0, 0, 0, 1);
      return;
    }

    const preambleBits = parseBits(preambleBitsInput.value);
    const preambleRepeat = readInteger(preambleRepeatInput, 0, 50, 0);
    const preambleCount = preambleBits.length * preambleRepeat;
    const frameBits = result.usesFraming
      ? result.startBits + result.dataBits + result.stopBits
      : 8;
    const mask = result.dataBits < 8 ? (1 << result.dataBits) - 1 : 0xff;
    const labelBytes = result.bytes.map((value) => value & mask);
    timingByteInfo = {
      bytes: labelBytes,
      frameBits,
      dataStartBit: preambleCount,
      dataBits: result.dataBits
    };

    const baudRate = readNumber(baudRateInput, 1, 19200, 1200);
    const sampleRate = readInteger(sampleRateSelect, 8000, 48000, 44100);
    const amplitude = readNumber(amplitudeInput, 0, 100, 70) / 100;
    const leadInMs = readNumber(leadInInput, 0, 5000, 100);
    const leadOutMs = readNumber(leadOutInput, 0, 5000, 200);
    let markFreq = 0;
    let spaceFreq = 0;
    if (freqModeSelect.value === "shift") {
      const centerFreq = readNumber(centerFreqInput, 20, 20000, 1700);
      const shiftFreq = readNumber(shiftFreqInput, 1, 20000, 1000);
      markFreq = centerFreq + shiftFreq / 2;
      spaceFreq = centerFreq - shiftFreq / 2;
    } else {
      markFreq = readNumber(markFreqInput, 20, 20000, 2200);
      spaceFreq = readNumber(spaceFreqInput, 20, 20000, 1200);
    }

    if (markFreq <= 0 || spaceFreq <= 0) {
      setStatus("error", "freq too low");
      setActionState(false);
      return;
    }
    if (markFreq >= sampleRate / 2 || spaceFreq >= sampleRate / 2) {
      setStatus("error", "freq too high");
      setActionState(false);
      return;
    }
    const hopEnabled = hopModeSelect.value === "down";
    const hopStepHz = readNumber(hopStepInput, 1, 20000, 80);
    const hopSteps = readInteger(hopCountInput, 1, 32, 4);
    const hopTraining = hopEnabled && hopTrainingSelect.value === "on";
    const hopBitLengthMs = readNumber(hopBitLengthInput, 1, 1000, 10);
    const hopBitPauseMs = readNumber(hopBitPauseInput, 0, 5000, 12);
    const hopPauseMs = readNumber(hopPauseInput, 0, 5000, 60);
    if (hopEnabled) {
      const minFreq = Math.min(markFreq, spaceFreq) - hopStepHz * (hopSteps - 1);
      if (minFreq <= 0) {
        setStatus("error", "hop too low");
        setActionState(false);
        return;
      }
    }
    const trainingBaud = hopTraining ? 1000 / hopBitLengthMs : baudRate;
    if (hopTraining && sampleRate / trainingBaud < 1) {
      setStatus("error", "training rate too high");
      setActionState(false);
      return;
    }
    if (sampleRate / baudRate < 1) {
      setStatus("error", "baud too high");
      setActionState(false);
      return;
    }

    const maxFreq = Math.max(markFreq, spaceFreq);
    const antiAliasCutoff = Math.min(sampleRate * 0.48, maxFreq * 1.6);
    const enableAntiAlias = maxFreq > sampleRate * 0.25;

    let samples = null;
    let totalBits = bits.length;
    let trainingBits = null;
    if (hopTraining) {
      trainingBits = [
        ...new Array(hopSteps).fill(1),
        ...new Array(hopSteps).fill(0)
      ];
      const interBitPauseSamples = Math.round((sampleRate * hopBitPauseMs) / 1000);
      const trainingWave = buildWave(trainingBits, {
        markFreq,
        spaceFreq,
        baudRate: trainingBaud,
        sampleRate,
        amplitude,
        mapping: mappingSelect.value,
        leadInMs,
        leadOutMs: 0,
        transitionMs: 1.2,
        enableAntiAlias,
        antiAliasCutoff,
        hopEnabled,
        hopStepHz,
        hopSteps,
        interBitPauseSamples
      });
      const pauseSamples = Math.max(0, Math.round((sampleRate * hopPauseMs) / 1000));
      const pauseWave = new Float32Array(pauseSamples);
      const dataWave = buildWave(bits, {
        markFreq,
        spaceFreq,
        baudRate,
        sampleRate,
        amplitude,
        mapping: mappingSelect.value,
        leadInMs: 0,
        leadOutMs,
        transitionMs: 1.2,
        enableAntiAlias,
        antiAliasCutoff,
        hopEnabled,
        hopStepHz,
        hopSteps
      });
      samples = concatFloat32([trainingWave, pauseWave, dataWave]);
      totalBits += trainingBits.length;
    } else {
      samples = buildWave(bits, {
        markFreq,
        spaceFreq,
        baudRate,
        sampleRate,
        amplitude,
        mapping: mappingSelect.value,
        leadInMs,
        leadOutMs,
        transitionMs: 1.2,
        enableAntiAlias,
        antiAliasCutoff,
        hopEnabled,
        hopStepHz,
        hopSteps
      });
    }

    const wavBuffer = encodeWav(samples, sampleRate);
    setAudioBlob(new Blob([wavBuffer], { type: "audio/wav" }));
    setActionState(true);
    updateStats(totalBits, bytesCount, samples.length, sampleRate);
    setStatus("ready", "ready");
    timingSegments = buildTimingSegments(bits, {
      markFreq,
      spaceFreq,
      baudRate,
      mapping: mappingSelect.value,
      hopEnabled,
      hopStepHz,
      hopSteps,
      leadInMs,
      leadOutMs,
      trainingBits,
      trainingPauseMs: hopPauseMs,
      trainingBitPauseMs: hopBitPauseMs,
      trainingBitMs: hopBitLengthMs
    });
    buildTimingTimeline(timingSegments);
    updateTimingByteSpans();
    hoverTime = null;
    hoverByteIndex = null;
    hoverSegmentIndex = null;
    timingOptions = {
      markFreq,
      spaceFreq,
      hopEnabled,
      hopStepHz,
      hopSteps,
      mapping: mappingSelect.value,
      baudRate
    };
    drawTimingMap(timingSegments, getDisplayTime());
  }

  modeTextBtn.addEventListener("click", () => setMode("text"));
  modeBitsBtn.addEventListener("click", () => setMode("bits"));
  modeHexBtn.addEventListener("click", () => setMode("hex"));
  modeFileBtn.addEventListener("click", () => setMode("file"));
  freqModeSelect.addEventListener("change", (event) => setFreqMode(event.target.value));
  hopModeSelect.addEventListener("change", (event) => setHopMode(event.target.value));
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      fileBytes = null;
      fileInfo.textContent = "No file selected";
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      fileBytes = new Uint8Array(buffer);
      fileInfo.textContent = `${file.name} (${fileBytes.length} bytes)`;
    } catch (error) {
      fileBytes = null;
      fileInfo.textContent = "Failed to read file";
    }
  });
  encodingSelect.addEventListener("change", () => {
    if (encodingSelect.value === "ascii7") {
      dataBitsSelect.value = "7";
      return;
    }
    dataBitsSelect.value = "8";
  });
  generateBtn.addEventListener("click", generate);
  playBtn.addEventListener("click", () => preview.play());
  stopBtn.addEventListener("click", () => {
    preview.pause();
    preview.currentTime = 0;
    setStatus("ready", "ready");
  });
  downloadBtn.addEventListener("click", () => {
    if (!currentBlob) return;
    const anchor = document.createElement("a");
    anchor.href = currentUrl;
    anchor.download = "fsk-audio.wav";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  });

  if (timingZoomInput) {
    setTimingZoom(timingZoom);
    timingZoomInput.addEventListener("input", (event) => {
      const anchorTime = getCenterTime();
      setTimingZoom(Number.parseFloat(event.target.value));
      if (timingSegments.length) {
        drawTimingMap(timingSegments, getDisplayTime());
        centerOnTime(anchorTime);
        scheduleTimingDraw();
      }
    });
  }
  if (timingFitBtn) {
    timingFitBtn.addEventListener("click", fitTimingToView);
  }
  if (timingTrackSelect) {
    timingTrackSelect.addEventListener("change", (event) => {
      trackMode = event.target.value;
      if (timingSegments.length) {
        drawTimingMap(timingSegments, getDisplayTime());
        const anchorTime = playheadTime !== null ? playheadTime : preview.currentTime || 0;
        const trackTime = getTrackCenterTime(trackMode, anchorTime);
        if (trackTime !== null) {
          centerOnTime(trackTime);
          scheduleTimingDraw();
        }
      }
    });
  }
  if (timingCanvas) {
    timingCanvas.addEventListener("mousemove", (event) => {
      if (!timingSegments.length) return;
      const previousHoverByte = hoverByteIndex;
      const previousHoverSegment = hoverSegmentIndex;
      const rect = timingCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      hoverTime = timeFromX(x, timingDuration);
      const hoverSpan = findByteSpanAtTime(hoverTime);
      hoverByteIndex = hoverSpan ? hoverSpan.index : null;
      const segmentInfo = findSegmentAtTime(hoverTime);
      hoverSegmentIndex = segmentInfo && segmentInfo.segment.kind === "bit" ? segmentInfo.index : null;
      if (previousHoverByte !== hoverByteIndex || previousHoverSegment !== hoverSegmentIndex) {
        scheduleTimingDraw();
      }
    });
    timingCanvas.addEventListener("mouseleave", () => {
      hoverTime = null;
      hoverByteIndex = null;
      hoverSegmentIndex = null;
      if (timingSegments.length) {
        scheduleTimingDraw();
      }
    });
  }
  if (timingScroll) {
    timingScroll.addEventListener("scroll", () => {
      if (timingSegments.length) {
        scheduleTimingDraw();
      }
    });
  }
  if (timingFullscreenBtn && timingBlock) {
    timingFullscreenBtn.addEventListener("click", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (timingBlock.requestFullscreen) {
        timingBlock.requestFullscreen().catch(() => {});
      }
    });
    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = document.fullscreenElement === timingBlock;
      timingBlock.classList.toggle("is-fullscreen", isFullscreen);
      moveActions(isFullscreen);
      if (timingSegments.length) {
        drawTimingMap(timingSegments, getDisplayTime());
      }
    });
  }

  preview.addEventListener("play", () => setStatus("playing", "playing"));
  preview.addEventListener("pause", () => {
    if (preview.ended || preview.currentTime === 0) {
      setStatus("ready", "ready");
      return;
    }
    setStatus("ready", "paused");
  });
  preview.addEventListener("ended", () => setStatus("ready", "ready"));

  function updatePlayhead() {
    if (!timingSegments.length) return;
    playheadTime = preview.currentTime || 0;
    const displayTime = getDisplayTime();
    drawTimingMap(timingSegments, displayTime);
    const trackTime = getTrackCenterTime(trackMode, playheadTime);
    if (trackTime !== null) {
      centerOnTime(trackTime);
    }
    if (!preview.paused && !preview.ended) {
      playheadRaf = requestAnimationFrame(updatePlayhead);
    }
  }

  preview.addEventListener("play", () => {
    if (playheadRaf) cancelAnimationFrame(playheadRaf);
    updatePlayhead();
  });

  preview.addEventListener("pause", () => {
    if (playheadRaf) {
      cancelAnimationFrame(playheadRaf);
      playheadRaf = 0;
    }
    if (timingSegments.length) {
      drawTimingMap(timingSegments, getDisplayTime());
    }
  });

  preview.addEventListener("ended", () => {
    if (playheadRaf) {
      cancelAnimationFrame(playheadRaf);
      playheadRaf = 0;
    }
    playheadTime = 0;
    if (timingSegments.length) {
      drawTimingMap(timingSegments, getDisplayTime());
    }
  });

  window.addEventListener("resize", () => {
    if (timingSegments.length) {
      drawTimingMap(timingSegments, getDisplayTime());
    }
  });

  setMode("text");
  setFreqMode(freqModeSelect.value);
  setHopMode(hopModeSelect.value);
  setActionState(false);
  setStatus("idle", "idle");
});
