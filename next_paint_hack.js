"use strict";

var global = this;

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

  window.onload = () => {
    for (let i = 0; i < 10; i++) {
      insertIframe();
    }
  };

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

  global.getNextPaintPromise = function() {
    const frameId = requestFirstPaintFromIframe();
    return new Promise((resolve, reject) => {
      const iframeEventId = "iframe_" + frameId;
      let received = false;
      // Check respondancy of iframes regularly
      setTimeout(()=>{
        if (!received) throw new Error(`${iframeEventId} is not responding.`);
      }, 10000);
      const onReceivedIframeEvent = function(e) {
        received = true;
        resolve(e.detail.firstPaint);
        window.removeEventListener(iframeEventId, onReceivedIframeEvent, false);
        iframes[e.detail.frameId].iframe.remove();
        insertIframe();
      };
      window.originalAddEventListener(iframeEventId, onReceivedIframeEvent, false);
    });
  }
  const paintTimes = [];
  global.paintTimes = paintTimes;

  function requestFirstPaintFromIframe() {
    const readyIds = Object.keys(iframes).filter(id => iframes[id].state === "READY");
    if (readyIds.length === 0) throw new Error("We have to guarantee that there are enough iframes. Try increase the number of iframes");
    const id = readyIds[0];
    iframes[id].state = "BUSY";
    iframes[id].iframe.contentWindow.postMessage("PAINT", "*");
    logMorePaints(4);
    return id;
  }

  let cntPaintsToLog = 0;
  function logMorePaints(num) {
    cntPaintsToLog += num;
  }

  function logPaintTimes() {
    window.requestAnimationFrame(logPaintTimes);
    if (cntPaintsToLog <= 0) {
      for (let i=0; i<paintTimes.length; i++) paintTimes.pop();
      return;
    }
    const now = performance.now();
    paintTimes.push(now);
    console.log("paint: " + performance.now());
    cntPaintsToLog--;
  }

  window.requestAnimationFrame(logPaintTimes);
})();