/* ================= 歌单每日随机排序 ================= */
/* 顺序只由「日期」决定：同一天所有访客看到的顺序完全一致，
   北京时间每天 0 点自动换一套（无需重新构建，静态页面也能生效）。 */
(function () {
    const list = document.querySelector('.song-list');
    if (!list) return;

    const items = Array.from(list.children).filter((el) =>
        el.classList && el.classList.contains('song')
    );
    if (items.length < 2) return;

    // 北京时间（UTC+8）当天，如 2026-10-06
    const day = new Date(Date.now() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

    // FNV-1a：把日期压成 32 位种子
    let seed = 0x811c9dc5;
    for (let i = 0; i < day.length; i++) {
        seed ^= day.charCodeAt(i);
        seed = Math.imul(seed, 0x01000193) >>> 0;
    }

    // mulberry32：同一种子 → 同一串伪随机数（跨浏览器一致）
    function rand() {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Fisher–Yates 洗牌（固定种子，结果可复现）
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
    }

    // 按新顺序放回，并重排序号。
    // 注意：这里不要写 transition-delay。入场错峰统一由 pages.js 在元素
    // 进入视口时按「当前文档顺序」计算；两处各写一套延时就会互相错开。
    const frag = document.createDocumentFragment();
    items.forEach((el, i) => {
        const no = el.querySelector('.no');
        if (no) no.textContent = String(i + 1).padStart(2, '0');
        frag.appendChild(el);
    });
    list.appendChild(frag);

    // 提示条上标注当前生效的日期
    const tip = document.getElementById('shuffle-tip');
    const dayEl = document.getElementById('shuffle-day');
    if (tip && dayEl) {
        dayEl.textContent = day;
        tip.hidden = false;
    }
})();
