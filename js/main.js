/* ============================================================
 * main.js —— UI 层：负责 DOM 渲染与交互
 * 依赖：data.js（角色/剧情）、game.js（GameCore）
 * ============================================================ */

(function () {
  "use strict";

  let state = GameCore.createState();
  let currentCharId = null; // 当前正在对话的角色

  // ---------- DOM 快捷获取 ----------
  const $ = (sel) => document.querySelector(sel);

  const screens = {
    title: $("#screen-title"),
    select: $("#screen-select"),
    dialogue: $("#screen-dialogue"),
    end: $("#screen-end"),
  };
  const overlay = $("#overlay");
  const overlayText = $("#overlay-text");
  const overlayBtn = $("#overlay-btn");
  const favorBar = $("#favor-bar");

  // ---------- 屏幕切换 ----------
  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle("hidden", key !== name);
    }
    // 标题/结算界面不显示好感度栏
    favorBar.classList.toggle("hidden", name === "title" || name === "end");
    window.scrollTo(0, 0);
  }

  // ---------- 好感度栏 ----------
  function renderFavorBar() {
    favorBar.innerHTML = "";
    for (const id of CHARACTER_ORDER) {
      const c = CHARACTERS[id];
      const favor = state.favor[id];
      const status = state.status[id];
      const pct = Math.max(0, favor); // 进度条只显示 0~100 部分
      const panel = document.createElement("div");
      panel.className = "favor-panel status-" + status;
      panel.innerHTML = `
        <img class="favor-avatar" src="${c.img}" alt="${c.name}">
        <div class="favor-info">
          <div class="favor-name">${c.name}${statusIcon(status)}</div>
          <div class="favor-track"><div class="favor-fill" style="width:${pct}%"></div></div>
          <div class="favor-num">❤️ ${favor}/100</div>
        </div>`;
      favorBar.appendChild(panel);
    }
  }

  function statusIcon(status) {
    if (status === "success") return ' <span class="tag tag-success">攻略成功</span>';
    if (status === "failed") return ' <span class="tag tag-failed">攻略失败</span>';
    return "";
  }

  /** 好感度变化的飘字反馈 */
  function floatDelta(charId, delta) {
    const idx = CHARACTER_ORDER.indexOf(charId);
    const panel = favorBar.children[idx];
    if (!panel || delta === 0) return;
    const el = document.createElement("span");
    el.className = "favor-float " + (delta > 0 ? "up" : "down");
    el.textContent = (delta > 0 ? "+" : "") + delta;
    panel.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  // ---------- 角色选择界面 ----------
  function renderSelect() {
    const grid = $("#char-grid");
    grid.innerHTML = "";
    for (const id of CHARACTER_ORDER) {
      const c = CHARACTERS[id];
      const status = state.status[id];
      const card = document.createElement("button");
      card.className = "char-card status-" + status;
      card.disabled = status !== "active";
      card.innerHTML = `
        <img class="char-img" src="${c.img}" alt="${c.name}">
        <div class="char-name">${c.name}</div>
        <div class="char-intro">${c.intro}</div>
        <div class="char-status">${
          status === "success" ? "💘 攻略成功！"
          : status === "failed" ? "💔 攻略失败……"
          : "❤️ 好感度 " + state.favor[id] + "/100"
        }</div>`;
      if (status === "active") {
        card.addEventListener("click", () => openDialogue(id));
      }
      grid.appendChild(card);
    }
  }

  // ---------- 对话界面 ----------
  function openDialogue(charId) {
    currentCharId = charId;
    showScreen("dialogue");
    renderDialogue();
  }

  function renderDialogue() {
    const c = CHARACTERS[currentCharId];
    const node = GameCore.getNode(state, currentCharId);

    $("#dlg-avatar").src = c.img;
    $("#dlg-avatar").alt = c.name;
    $("#dlg-name").textContent = c.name;
    $("#dlg-text").textContent = node ? node.text : "……";

    const box = $("#dlg-options");
    box.innerHTML = "";
    if (!node) return;

    // 打乱选项顺序，避免“第一个永远是正确答案”，增加策略性
    const options = node.options.slice();
    shuffle(options);

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt.text;
      btn.addEventListener("click", () => onChoice(opt));
      box.appendChild(btn);
    });
  }

  function onChoice(option) {
    const result = GameCore.applyChoice(state, currentCharId, option);

    renderFavorBar();
    floatDelta(currentCharId, result.delta);

    if (result.gameEvent !== "none") {
      // 整局结束，优先处理
      setTimeout(() => showEndScreen(result.gameEvent), 700);
      return;
    }
    if (result.charEvent === "success") {
      setTimeout(() => showOverlay(`💘 ${CHARACTERS[currentCharId].name}攻略成功！`), 700);
      return;
    }
    if (result.charEvent === "failed") {
      setTimeout(() => showOverlay(`💔 ${CHARACTERS[currentCharId].name}攻略失败……`), 700);
      return;
    }
    renderDialogue();
  }

  // ---------- 弹窗（单人成功/失败） ----------
  function showOverlay(text) {
    overlayText.textContent = text;
    overlay.classList.remove("hidden");
  }

  overlayBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    renderFavorBar();
    renderSelect();
    showScreen("select");
  });

  // ---------- 结算界面 ----------
  function showEndScreen(gameEvent) {
    const title = $("#end-title");
    const desc = $("#end-desc");
    if (gameEvent === "victory") {
      title.textContent = "🎉 攻略成功！";
      desc.textContent = "你成功攻略了江敬春、水牛和欧阳成鸡！恭喜通关！";
      screens.end.classList.add("victory");
      screens.end.classList.remove("defeat");
    } else {
      title.textContent = "💔 攻略失败";
      desc.textContent = "你已经失去了两位攻略对象。";
      screens.end.classList.add("defeat");
      screens.end.classList.remove("victory");
    }
    showScreen("end");
  }

  // ---------- 重新开始 ----------
  function restart() {
    state = GameCore.createState();
    currentCharId = null;
    renderFavorBar();
    showScreen("title");
  }

  // ---------- 工具 ----------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- 事件绑定 ----------
  $("#btn-start").addEventListener("click", () => {
    renderFavorBar();
    renderSelect();
    showScreen("select");
  });
  $("#btn-back-select").addEventListener("click", () => {
    renderFavorBar();
    renderSelect();
    showScreen("select");
  });
  $("#btn-restart").addEventListener("click", restart);

  // 初始化
  renderFavorBar();
  showScreen("title");
})();
