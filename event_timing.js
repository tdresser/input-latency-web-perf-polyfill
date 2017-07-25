(function () {
  'use strict';

  // Maps from event hashes to pending performance entries. TODO - use a better
  // data structure, sorted on timestamp.
  const pendingEntries = new Map();

  function frameStart() {
    let now = performance.now();
    for (const [hash, entry] of pendingEntries.entries()) {
      let elapsed = now - entry.startTime;
      if (elapsed > 50) {
        entry.commitTime = now;
        performance.emit(entry);
      }
      pendingEntries.delete(hash);
    }
  }

  function rAF(t) {
    window.requestAnimationFrame(rAF);

    if (pendingEntries.size > 0)
      window.setTimeout(frameStart, 0);
  }

  window.requestAnimationFrame(rAF);

  function eventHash(e) {
    // TODO - better hash function.
    return e.timeStamp + e.type;
  }

  function addOrCoalesceEntry(e, newEntryData) {
    const hash = eventHash(e);
    const entry = pendingEntries.get(hash);
    if (!entry) {
      pendingEntries.set(hash, newEntryData);
      return newEntryData;
    }
    entry.processingEnd = newEntryData.processingEnd;
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
        cancelable: event.cancelable,
        eventHasCommit: true,
      };
      addOrCoalesceEntry(e, entry);
    }, args);
  };
})();
