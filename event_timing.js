(function () {
  'use strict';

  // Maps from event hashes to pending performance entries. TODO - use a better
  // data structure, sorted on timestamp.
  const pendingEntries = new Map();

  function rIC() {
    window.requestIdleCallback(rIC);
    for (const [hash, entry] of pendingEntries.entries()) {
      // Wait until nextPaint is received from the iframe to be dispatch.
      if (!entry.nextPaint) continue;
      performance.emit(entry);
      pendingEntries.delete(hash);
    }
  }

  function eventHash(e) {
    // TODO - better hash function.
    return e.timeStamp + e.type;
  }

  let paintTimes = [];
  let cntPaintsToRecort = 0;
  function logPaintTimes() {
    window.requestAnimationFrame(logPaintTimes);
    if (cntPaintsToRecort <= 0) {
      paintTimes = [];
      return;
    }
    const now = performance.now();
    paintTimes.push(now);
    console.log("paint: " + performance.now());
    cntPaintsToRecort--;
  }

  window.addEventListener("message", (event) => {
    const id = parseInt(event.data.frameId);
    iframes[id].iframe.remove();
    iframes[id].entry.nextPaint = event.data.fp - performance.timeOrigin;
    delete iframes[id];
  }, false);

  window.requestAnimationFrame(logPaintTimes);

  const iframes = {};
  let frameId = 0;
  function addOrCoalesceEntry(e, newEntryData) {
    window.requestIdleCallback(rIC);
    const hash = eventHash(e);
    let entry = pendingEntries.get(hash);
    if (!entry) {
      pendingEntries.set(hash, newEntryData);
      entry = newEntryData;
    } else {
      // We aren't certain this is the last event listener. Overwrite
      // processingEnd each time another listener ends. We'll see the correct end
      // time in the idle callback.
      entry.processingEnd = newEntryData.processingEnd;
    }
    const iframe = document.createElement('iframe');
    iframe.src = 'nextpaint_childframe.html';
    // When width and height are too small, iframe are not painted.
    iframe.style.width = "40px";
    iframe.style.height = "30px";
    iframe.scrolling = "no";
    iframe.name = frameId;
    iframes[frameId] = {iframe, entry};
    frameId++;
    document.body.appendChild(iframe);
    // Record 4 more paintTimes ahead.
    cntPaintsToRecort += 4;
    return entry;
  }

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, f, args) {
    originalAddEventListener.call(this, type, (e) => {
      const processingStart = performance.now();
      f(e);
      const processingEnd = performance.now();
      const entry = {
        name: type,
        entryType: 'event',
        startTime: e.timeStamp,
        processingStart: processingStart,
        processingEnd: processingEnd,
        duration: 0,
        cancelable: e.cancelable,
      };
      addOrCoalesceEntry(e, entry);
    }, args);
  };

  const eventTypeNames = ["click", "mousemove", "keydown", "input", "keyup", "touchstart", "touchmove", "pointerdown"]
  for (let i of eventTypeNames) {
    document.addEventListener(i, () => {});
  }

  // temporary
  const po = new PerformanceObserver((e) => {
    for (let entry of e.getEntries()) {
      console.log(JSON.stringify(entry));
      const paintsInRange = paintTimes.filter(p=> p > entry.processingStart && p < entry.nextPaint);
      console.log(`processing end: ${entry.processingEnd}, paintTimes in between: ${paintsInRange.length}, next paint: ${entry.nextPaint}`);
    }
  });
  po.observe({entryTypes:["event"]})
})();
