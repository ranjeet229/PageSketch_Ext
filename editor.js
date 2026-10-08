(() => {
  if (window.top !== window || document.getElementById("pmc-root")) return;

  const root = document.createElement("div");
  root.id = "pmc-root";
  root.innerHTML = `
    <style>
      #pmc-root { all: initial; font-family: Arial, sans-serif; }
      #pmc-toolbar { position: fixed; z-index: 2147483647; top: 50%; right: 16px; transform: translateY(-50%); display: flex; flex-direction: column; align-items: stretch; gap: 7px; padding: 9px; max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; border: 1px solid #c7d2fe; border-radius: 12px; background: #111827; color: #fff; box-shadow: 0 8px 28px rgba(0,0,0,.28); font: 13px Arial,sans-serif; }
      #pmc-panel-handle { display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:24px; font-weight:700; cursor:move; user-select:none; }
      #pmc-collapse { min-width:0!important; width:24px; padding:3px!important; color:#fff!important; background:transparent!important; font-size:18px!important; line-height:18px; }
      #pmc-toolbar.pmc-collapsed { padding:8px; overflow:hidden; border-radius:50%; }
      #pmc-toolbar.pmc-collapsed > :not(#pmc-panel-handle) { display:none; }
      #pmc-toolbar.pmc-collapsed #pmc-panel-title { display:none; }
      #pmc-toolbar.pmc-collapsed #pmc-panel-handle { width:28px; justify-content:center; cursor:pointer; }
      #pmc-toolbar.pmc-collapsed #pmc-collapse { display:none; }
      #pmc-toolbar.pmc-collapsed #pmc-panel-handle::after { content:"✎"; color:#fff; font-size:20px; }
      #pmc-toolbar button { border: 0; border-radius: 7px; min-width: 92px; padding: 8px 9px; color: #111827; background: #f8fafc; cursor: pointer; font: 600 12px Arial,sans-serif; }
      #pmc-toolbar button[data-active="true"] { background: #fbbf24; }
      #pmc-toolbar button.pmc-save { background: #4f46e5; color: white; }
      #pmc-color { width: 28px; height: 28px; padding: 0; border: 0; background: transparent; cursor: pointer; }
      #pmc-canvas { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
      #pmc-canvas.pmc-editing { pointer-events: auto; cursor: crosshair; }
      .pmc-note { position: fixed; z-index: 2147483646; min-width: 90px; padding: 5px 7px; outline: 2px solid #fbbf24; border: 0; border-radius: 4px; background: #fef3c7; color: #111827; font: 14px Arial,sans-serif; }
      #pmc-toolbar select { height: 30px; border-radius: 6px; border: 0; font: 12px Arial,sans-serif; }
      @media (max-width: 700px) { #pmc-toolbar { top: auto; bottom: 8px; right: 8px; transform: none; } }
    </style>
    <canvas id="pmc-canvas"></canvas>
    <div id="pmc-toolbar" role="toolbar" aria-label="Page annotation tools">
      <div id="pmc-panel-handle" title="Drag to move this panel"><span id="pmc-panel-title">Edit copy</span><button id="pmc-collapse" title="Collapse panel" aria-label="Collapse panel">−</button></div>
      <button data-tool="draw" title="Draw freehand">Draw</button>
      <select id="pmc-shape" title="Choose a shape" aria-label="Shape">
        <option value="circle">Circle</option>
        <option value="rectangle">Rectangle</option>
        <option value="square">Square</option>
        <option value="triangle">Triangle</option>
      </select>
      <button data-tool="shape" title="Draw selected shape">Add shape</button>
      <button data-tool="highlight" title="Highlight an area">Highlight</button>
      <button data-tool="note" title="Add a text note">Text</button>
      <button data-tool="move" title="Move an existing annotation">Move</button>
      <button id="pmc-delete" title="Delete the selected annotation">Delete selected</button>
      <input id="pmc-color" type="color" value="#ef4444" title="Annotation color">
      <button id="pmc-undo" title="Undo last drawing change">Undo</button>
      <button id="pmc-redo" title="Redo last drawing change">Redo</button>
      <button id="pmc-clear" title="Remove all markup">Clear</button>
      <select id="pmc-format" title="Export format" aria-label="Export format">
        <option value="png">PNG image</option>
        <option value="jpeg">JPEG image</option>
        <option value="word">Word document</option>
      </select>
      <button class="pmc-save" id="pmc-save" title="Download annotated page">Save</button>
      <button id="pmc-close" title="Close editor">Done</button>
    </div>`;
  document.documentElement.append(root);

  const canvas = root.querySelector("#pmc-canvas");
  const ctx = canvas.getContext("2d");
  const toolbar = root.querySelector("#pmc-toolbar");
  const color = root.querySelector("#pmc-color");
  let tool = null, drawing = false, start = null, paths = [], preview = null, moving = null, lastPoint = null, selected = null;
  let undoStack = [], redoStack = [], beforeChange = null;
  let draggingPanel = null, panelDragged = false;
  const notes = [];

  function resize() {
    const image = canvas.width && ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = innerWidth; canvas.height = innerHeight;
    if (image) ctx.putImageData(image, 0, 0);
  }
  resize(); addEventListener("resize", resize);
  function point(e) { return { x: e.clientX, y: e.clientY }; }
  function paintPath(path) {
    ctx.save(); ctx.strokeStyle = path.color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); path.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.restore();
  }
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paths.forEach((item) => {
      ctx.save();
      if (item.type === "draw") paintPath(item);
      else if (item.type === "circle") { ctx.strokeStyle = item.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.stroke(); }
      else if (item.type === "rectangle" || item.type === "square") { ctx.strokeStyle = item.color; ctx.lineWidth = 4; ctx.strokeRect(item.x, item.y, item.w, item.h); }
      else if (item.type === "triangle") { ctx.strokeStyle = item.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(item.x + item.w / 2, item.y); ctx.lineTo(item.x + item.w, item.y + item.h); ctx.lineTo(item.x, item.y + item.h); ctx.closePath(); ctx.stroke(); }
      else { ctx.fillStyle = item.color + "55"; ctx.fillRect(item.x, item.y, item.w, item.h); }
      ctx.restore();
    });
    if (selected) {
      const box = bounds(selected);
      ctx.save(); ctx.strokeStyle = "#2563eb"; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.strokeRect(box.x - 5, box.y - 5, box.w + 10, box.h + 10); ctx.restore();
    }
    if (preview) {
      const currentPreview = preview;
      preview = null;
      paths.push(currentPreview);
      redraw();
      paths.pop();
      preview = currentPreview;
    }
  }
  function activate(next) {
    tool = next;
    canvas.classList.toggle("pmc-editing", !!tool && tool !== "note");
    canvas.style.cursor = tool === "move" ? "move" : "";
    toolbar.querySelectorAll("[data-tool]").forEach(b => b.dataset.active = String(b.dataset.tool === tool));
  }
  toolbar.addEventListener("click", (e) => {
    const next = e.target.dataset.tool;
    if (next) { activate(tool === next ? null : next); return; }
    if (e.target.id === "pmc-delete") {
      if (selected) { beginChange(); paths = paths.filter(item => item !== selected); selected = null; finishChange(); redraw(); }
    }
    if (e.target.id === "pmc-undo") undo();
    if (e.target.id === "pmc-redo") redo();
    if (e.target.id === "pmc-clear") {
      if (paths.length || notes.length) {
        beginChange(); paths = []; notes.splice(0).forEach(n => n.remove()); selected = null; finishChange(); redraw();
      }
    }
    if (e.target.id === "pmc-close") root.remove();
    if (e.target.id === "pmc-save") save();
    if (e.target.id === "pmc-collapse") toolbar.classList.add("pmc-collapsed");
    if (e.target.id !== "pmc-collapse" && toolbar.classList.contains("pmc-collapsed") && e.target.closest("#pmc-panel-handle")) {
      if (!panelDragged) toolbar.classList.remove("pmc-collapsed");
    }
  });
  root.querySelector("#pmc-shape").addEventListener("change", () => activate("shape"));
  const panelHandle = root.querySelector("#pmc-panel-handle");
  panelHandle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#pmc-collapse")) return;
    draggingPanel = { x: e.clientX, y: e.clientY, left: toolbar.getBoundingClientRect().left, top: toolbar.getBoundingClientRect().top };
    panelDragged = false; panelHandle.setPointerCapture(e.pointerId); e.preventDefault();
  });
  panelHandle.addEventListener("pointermove", (e) => {
    if (!draggingPanel) return;
    const dx = e.clientX - draggingPanel.x, dy = e.clientY - draggingPanel.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) panelDragged = true;
    toolbar.style.left = `${Math.max(0, Math.min(innerWidth - toolbar.offsetWidth, draggingPanel.left + dx))}px`;
    toolbar.style.top = `${Math.max(0, Math.min(innerHeight - toolbar.offsetHeight, draggingPanel.top + dy))}px`;
    toolbar.style.right = "auto"; toolbar.style.transform = "none";
  });
  panelHandle.addEventListener("pointerup", () => { if (draggingPanel) setTimeout(() => { panelDragged = false; }, 0); draggingPanel = null; });
  canvas.addEventListener("pointerdown", (e) => {
    if (!tool || tool === "note") return;
    drawing = true; start = point(e); lastPoint = start; canvas.setPointerCapture(e.pointerId);
    if (tool === "move") {
      moving = findItem(start); selected = moving; redraw();
      if (!moving) drawing = false;
      else beginChange();
      return;
    }
    beginChange();
    if (tool === "draw") paths.push({ type: "draw", color: color.value, points: [start] });
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return; const p = point(e);
    if (tool === "move" && moving) {
      translate(moving, p.x - lastPoint.x, p.y - lastPoint.y);
      lastPoint = p; redraw(); return;
    }
    if (tool === "draw") { paths.at(-1).points.push(p); redraw(); }
    else if (tool === "shape") preview = makeShape(root.querySelector("#pmc-shape").value, start, p);
    else preview = { type: "highlight", color: color.value, x: Math.min(start.x,p.x), y: Math.min(start.y,p.y), w: Math.abs(p.x-start.x), h: Math.abs(p.y-start.y) };
    if (preview) redraw();
  });
  canvas.addEventListener("pointerup", () => { if (!drawing) return; drawing = false; moving = null; if (preview) paths.push(preview); preview = null; finishChange(); redraw(); });
  document.addEventListener("click", (e) => {
    if (tool !== "note" || e.target.closest("#pmc-toolbar") || e.target.classList.contains("pmc-note")) return;
    beginChange();
    const note = createNote("Type here", `${e.clientX}px`, `${e.clientY}px`);
    finishChange(); note.focus(); document.getSelection().selectAllChildren(note);
  }, true);
  function bounds(item) {
    if (item.type === "circle") return { x: item.x - item.r, y: item.y - item.r, w: item.r * 2, h: item.r * 2 };
    if (item.type === "highlight" || item.type === "rectangle" || item.type === "square" || item.type === "triangle") return { x: item.x, y: item.y, w: item.w, h: item.h };
    const xs = item.points.map(p => p.x), ys = item.points.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  function findItem(p) {
    return [...paths].reverse().find(item => {
      const b = bounds(item), padding = 12;
      return p.x >= b.x - padding && p.x <= b.x + b.w + padding && p.y >= b.y - padding && p.y <= b.y + b.h + padding;
    }) || null;
  }
  function translate(item, dx, dy) {
    if (item.type === "draw") item.points.forEach(p => { p.x += dx; p.y += dy; });
    else { item.x += dx; item.y += dy; }
  }
  function createNote(text, left, top) {
    const note = document.createElement("div"); note.className = "pmc-note"; note.contentEditable = "true"; note.textContent = text;
    note.style.left = left; note.style.top = top; document.body.append(note); notes.push(note); return note;
  }
  function snapshot() {
    return JSON.stringify({ paths, notes: notes.map(note => ({ text: note.textContent, left: note.style.left, top: note.style.top })) });
  }
  function restore(saved) {
    const state = JSON.parse(saved);
    paths = Array.isArray(state) ? state : state.paths;
    notes.splice(0).forEach(note => note.remove());
    (state.notes || []).forEach(note => createNote(note.text, note.left, note.top));
  }
  function beginChange() { beforeChange = snapshot(); }
  function finishChange() {
    if (beforeChange && beforeChange !== snapshot()) { undoStack.push(beforeChange); redoStack = []; }
    beforeChange = null;
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot()); restore(undoStack.pop()); selected = null; redraw();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot()); restore(redoStack.pop()); selected = null; redraw();
  }
  function makeShape(type, a, b) {
    if (type === "circle") return { type, color: color.value, x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) };
    let x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (type === "square") { const side = Math.max(w, h); x = b.x < a.x ? a.x - side : a.x; y = b.y < a.y ? a.y - side : a.y; w = h = side; }
    return { type, color: color.value, x, y, w, h };
  }
  async function save() {
    const saveButton = root.querySelector("#pmc-save");
    const oldText = saveButton.textContent;
    saveButton.textContent = "Saving…";
    toolbar.style.visibility = "hidden";
    // Let the browser paint the hidden toolbar before taking the capture.
    await new Promise(requestAnimationFrame);
    const result = await chrome.runtime.sendMessage({ type: "download-markup", format: root.querySelector("#pmc-format").value });
    toolbar.style.visibility = "";
    saveButton.textContent = result?.ok ? "Saved" : "Try again";
    setTimeout(() => { saveButton.textContent = oldText; }, 1400);
  }
})();
