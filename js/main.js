/* ============================================================
 * main.js —— UI 层：负责 DOM 渲染与交互
 * 依赖：data.js（角色/剧情）、game.js（GameCore）
 * ============================================================ */

(function () {
  "use strict";

  let state = GameCore.createState();
  let currentCharId = null; // 当前正在对话的角色
  let lastSceneKey = null;  // 当前展示的场景（用于判断是否需要切换）

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
    lastSceneKey = null;
    showScreen("dialogue");
    renderDialogue();
  }

  function renderDialogue() {
    const c = CHARACTERS[currentCharId];
    const node = GameCore.getNode(state, currentCharId);

    renderScene(node);

    $("#dlg-avatar").src = c.img;
    $("#dlg-avatar").alt = c.name;
    const speaker = node && node.speaker ? node.speaker : c.name;
    const nameEl = $("#dlg-name");
    nameEl.textContent = speaker;
    nameEl.classList.toggle("narrator", speaker === "旁白");
    $("#dlg-text").textContent = node ? node.text : "……";

    const box = $("#dlg-options");
    box.innerHTML = "";
    if (!node) return;

    if (node.options && node.options.length > 0) {
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
    } else {
      // 纯剧情节点：点击继续，推进故事与场景
      const btn = document.createElement("button");
      btn.className = "option-btn continue-btn";
      btn.textContent = "▼ 点击继续";
      btn.addEventListener("click", () => {
        GameCore.advanceStory(state, currentCharId);
        renderDialogue();
      });
      box.appendChild(btn);
    }
  }

  /** 按节点的 scene 序号切换场景图片；有场景时对话框融入图片中 */
  function renderScene(node) {
    const wrap = $("#dlg-scene-wrap");
    const img = $("#dlg-scene");
    const tag = $("#scene-tag");
    const stage = $(".dialogue-stage");
    const backBtn = $("#btn-back-select");
    const table = SCENES[currentCharId] || {};
    if (node && node.scene && table[node.scene]) {
      const sc = table[node.scene];
      const key = currentCharId + ":" + node.scene;
      if (lastSceneKey !== key) {
        lastSceneKey = key;
        img.src = sc.img;
        img.alt = sc.name;
        // 重新触发淡入动画
        img.classList.remove("scene-fade");
        void img.offsetWidth;
        img.classList.add("scene-fade");
      }
      tag.textContent = "场景" + node.scene + " · " + sc.name;
      wrap.classList.remove("hidden");
      // 对话框移入场景图容器，叠加在图片下方
      if (stage.parentElement !== wrap) wrap.appendChild(stage);
      wrap.classList.add("overlay-mode");
      fitSceneWrap();
    } else {
      lastSceneKey = null;
      wrap.classList.add("hidden");
      wrap.classList.remove("overlay-mode");
      wrap.style.width = "";
      // 无场景（番外闲聊）时恢复普通布局
      if (stage.parentElement !== screens.dialogue) {
        screens.dialogue.insertBefore(stage, backBtn);
      }
    }
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

  /** 让场景容器宽度贴合图片实际显示宽度（竖图时对话框不超框） */
  function fitSceneWrap() {
    const wrap = $("#dlg-scene-wrap");
    const img = $("#dlg-scene");
    const apply = () => {
      if (!img.naturalWidth) return;
      const avail = wrap.parentElement.clientWidth - 4; // 减去边框
      const css = getComputedStyle(img);
      const maxH = parseFloat(css.maxHeight) || window.innerHeight * 0.72;
      const scale = Math.min(avail / img.naturalWidth, maxH / img.naturalHeight, 1);
      wrap.style.width = Math.round(img.naturalWidth * scale) + 4 + "px";
      // 对话框高度用像素精确限制在图片范围内，防止内容溢出画面
      const stage = wrap.querySelector(".dialogue-stage");
      const box = wrap.querySelector(".dialogue-box");
      if (stage && box) {
        const h = Math.max(140, wrap.clientHeight - 24);
        stage.style.maxHeight = h + "px";
        box.style.maxHeight = h + "px";
      }
    };
    if (img.complete && img.naturalWidth > 0) apply();
    else img.onload = apply;
  }

  window.addEventListener("resize", () => {
    const wrap = $("#dlg-scene-wrap");
    if (!wrap.classList.contains("hidden")) fitSceneWrap();
  });

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
      const won = CHARACTER_ORDER.filter((id) => state.status[id] === "success").map((id) => CHARACTERS[id].name);
      const lost = CHARACTER_ORDER.filter((id) => state.status[id] === "failed").map((id) => CHARACTERS[id].name);
      title.textContent = "🎉 攻略成功！";
      desc.textContent = "你成功攻略了" + won.join("、") + "！"
        + (lost.length > 0 ? "虽然遗憾错过了" + lost.join("、") + "，但旅程依然圆满。" : "三段旅程全部圆满！")
        + "恭喜通关！";
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
    lastSceneKey = null;
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
