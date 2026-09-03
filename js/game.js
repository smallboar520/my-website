/* ============================================================
 * game.js —— 纯游戏逻辑（不依赖 DOM，可独立测试）
 *
 * 对外暴露一个 GameCore 对象：
 *   GameCore.createState()          创建初始状态
 *   GameCore.getNode(state, id)     获取角色当前剧情节点
 *   GameCore.applyChoice(...)       应用玩家选择，返回结果事件
 *   GameCore.checkGameEnd(state)    检查整局胜负
 * ============================================================ */

const GameCore = (function () {
  const FAVOR_MIN = -30;   // 失败线
  const FAVOR_MAX = 100;   // 攻略成功线
  const FAIL_LIMIT = 2;    // 失败人数达到该值则游戏失败

  /** 创建一局新游戏的状态 */
  function createState() {
    const favor = {};
    const status = {};    // 'active' | 'success' | 'failed'
    const progress = {};  // 主线剧情进度（节点下标）
    const extraIndex = {};// 番外闲聊轮换下标
    for (const id of CHARACTER_ORDER) {
      favor[id] = 0;
      status[id] = "active";
      progress[id] = 0;
      extraIndex[id] = 0;
    }
    return { favor, status, progress, extraIndex };
  }

  /**
   * 获取角色当前要展示的剧情节点。
   * 主线走完后，循环使用番外闲聊节点。
   */
  function getNode(state, charId) {
    const script = SCRIPTS[charId] || [];
    if (state.progress[charId] < script.length) {
      return script[state.progress[charId]];
    }
    const extras = EXTRA_NODES[charId] || [];
    if (extras.length === 0) return null;
    const node = extras[state.extraIndex[charId] % extras.length];
    return node;
  }

  /** 推进剧情进度（玩家做出选择后调用） */
  function advance(state, charId) {
    const script = SCRIPTS[charId] || [];
    if (state.progress[charId] < script.length) {
      state.progress[charId]++;
    } else {
      const extras = EXTRA_NODES[charId] || [];
      if (extras.length > 0) {
        state.extraIndex[charId] =
          (state.extraIndex[charId] + 1) % extras.length;
      }
    }
  }

  /**
   * 应用一个选项，返回：
   * {
   *   delta, favor,             // 变化值与变化后的好感度
   *   charEvent,                // 'none' | 'success' | 'failed'
   *   gameEvent                 // 'none' | 'victory' | 'gameover'
   * }
   */
  function applyChoice(state, charId, option) {
    if (state.status[charId] !== "active") {
      return { delta: 0, favor: state.favor[charId], charEvent: "none", gameEvent: "none" };
    }

    let favor = state.favor[charId] + option.favor;
    favor = Math.max(FAVOR_MIN, Math.min(FAVOR_MAX, favor)); // 钳制范围
    state.favor[charId] = favor;

    let charEvent = "none";
    if (favor >= FAVOR_MAX) {
      state.status[charId] = "success";
      charEvent = "success";
    } else if (favor <= FAVOR_MIN) {
      state.status[charId] = "failed";
      charEvent = "failed";
    }

    if (charEvent === "none") {
      advance(state, charId); // 只有未结束时才推进剧情
    }

    return { delta: option.favor, favor, charEvent, gameEvent: checkGameEnd(state) };
  }

  /** 检查整局游戏是否结束：'victory' | 'gameover' | 'none' */
  function checkGameEnd(state) {
    const statuses = CHARACTER_ORDER.map((id) => state.status[id]);
    if (statuses.every((s) => s === "success")) return "victory";
    if (statuses.filter((s) => s === "failed").length >= FAIL_LIMIT) return "gameover";
    return "none";
  }

  return { FAVOR_MIN, FAVOR_MAX, FAIL_LIMIT, createState, getNode, applyChoice, checkGameEnd };
})();

// 兼容 Node 环境（用于自动化测试），浏览器中直接忽略
if (typeof module !== "undefined" && module.exports) {
  module.exports = { GameCore };
}
