"use strict";

(function() {
  const iframes = {};

  window.onmessage = event => {
    const frameId = parseInt(event.data.frameId);
    const firstPaint = event.data.firstPaint - performance.timeOrigin;
    const iframeEvent = new CustomEvent("iframe_" + frameId, 
      {detail: {firstPaint: firstPaint, frameId: frameId}});
    window.dispatchEvent(iframeEvent);
  };

  let maxFrameId = 0;
  function generateFrameId() {
    maxFrameId++;
    return maxFrameId;
  }

  function insertIframe() {
    const iframe = document.createElement('iframe');
    iframe.src = 'nextpaint_childframe.html';
    // When width and height are too small, iframe are not painted.
    iframe.style.width = "40px";
    iframe.style.height = "30px";
    iframe.scrolling = "no";
    iframe.name = generateFrameId();
    iframes[iframe.name] = {iframe, state: "READY"};
    document.body.appendChild(iframe);
  }

  function resetAllIframes() {
    Object.keys(iframes).forEach(id => {
      iframes[id].iframe.remove();
    });
    for (let i = 0; i < 10; i++) {
      insertIframe();
    }
  };

  window.onload = resetAllIframes;

  window.getNextPaintPromise = function() {
    const frameId = requestFirstPaintFromIframe();
    return new Promise((resolve, reject) => {
      if (!frameId) {
        resetAllIframes();
        resolve(null);
        return;
      }
      const iframeEventId = "iframe_" + frameId;
      let received = false;
      const onReceivedIframeEvent = function(e) {
        received = true;
        resolve(e.detail.firstPaint);
        window.removeEventListener(iframeEventId, onReceivedIframeEvent, false);
        iframes[e.detail.frameId].state = "PAINTED";
      };
      window.originalAddEventListener(iframeEventId, onReceivedIframeEvent, false);
    });
  }

  function requestFirstPaintFromIframe() {
    const readyIds = Object.keys(iframes).filter(id => iframes[id].state === "READY");
    if (readyIds.length === 0) return null;
    const id = readyIds[0];
    iframes[id].state = "PAINTING";
    iframes[id].iframe.contentWindow.postMessage("PAINT", "*");
    return id;
  }
})();