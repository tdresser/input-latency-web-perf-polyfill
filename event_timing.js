(function () {
  'use strict';

  // Maps from event hashes to pending performance entries. TODO - use a better
  // data structure, sorted on timestamp.
  const pendingEntries = new Map();

  function rIC() {
    window.requestIdleCallback(rIC);
    for (const [hash, entry] of pendingEntries.entries()) {
      // Wait until nextPaint is received from the iframe before dispatching entries.
      if (entry.nextPaintPromise) {
        entry.nextPaintPromise.then((nextPaint) => {
          entry.duration = nextPaint - entry.startTime;
          delete entry.nextPaintPromise;
          performance.emit(entry);
        }).catch(()=>{
          entry.duration = entry.processingEnd - entry.startTime;
          delete entry.nextPaintPromise;
          performance.emit(entry);
        });
        pendingEntries.delete(hash);
      } else {
        delete entry.nextPaintPromise;
        performance.emit(entry);
        pendingEntries.delete(hash);
      }
    }
  }

  function eventHash(e) {
    // TODO - better hash function.
    return e.timeStamp + e.type;
  }

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
    if (!entry.nextPaintPromise) entry.nextPaintPromise = getNextPaintPromise();
    return entry;
  }

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  window.originalAddEventListener = originalAddEventListener;

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

  const eventTypeNames = ["click", "mousemove", "keydown", "input", "keyup", "touchstart", "touchmove", "pointerdown"];
  for (let i of eventTypeNames) {
    document.addEventListener(i, () => {});
  }
})();
