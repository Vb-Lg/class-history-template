/* ================= 星空背景 ================= */
(function () {
    const canvas = document.getElementById('stars');
    const ctx = canvas.getContext('2d');
    let w, h, stars = [], dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
        w = canvas.width = window.innerWidth * dpr;
        h = canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        const count = Math.min(160, Math.floor(window.innerWidth / 9));
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: (Math.random() * 1.4 + .3) * dpr,
            a: Math.random() * .6 + .15,
            s: Math.random() * .0009 + .0003,
            dy: Math.random() * .05 + .015
        }));
    }

    let t = 0;
    function draw() {
        ctx.clearRect(0, 0, w, h);
        t += 1;
        for (const s of stars) {
            const alpha = s.a + Math.sin(t * s.s * 12) * .25;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,244,214,' + Math.max(0.03, Math.min(1, alpha)) + ')';
            ctx.fill();
            s.y += s.dy * dpr;
            if (s.y > h + 5) { s.y = -5; s.x = Math.random() * w; }
        }
        requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
})();

/* ================= 滚动出现 ================= */
(function () {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        els.forEach(e => e.classList.add('visible'));
        return;
    }
    const STEP = 70;    // 同一批元素之间每级错峰延时
    const MAX_STEP = 6; // 最多累加到第 6 级，再多就保持同一延时
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                // 延时只在这里算一次，且必须随「当前文档顺序」单调不减：
                // 用 idx % 6 会让第 7 个元素的延时回到 0，比第 6 个更先出现。
                // 歌单会先按当天顺序重排 DOM（music-shuffle.js），所以这里读到的
                // 位置就是访客看到的位置，入场顺序与列表顺序一致。
                const idx = Array.from(el.parentElement.children).indexOf(el);
                const delay = Math.min(idx, MAX_STEP) * STEP;
                setTimeout(() => el.classList.add('visible'), delay);
                io.unobserve(el);
            }
        });
    }, { threshold: .1, rootMargin: '0px 0px -60px 0px' });
    els.forEach(e => io.observe(e));
})();

/* ================= 进度条 + 回顶部 ================= */
(function () {
    const bar = document.getElementById('progress');
    const top = document.getElementById('top');
    if (!bar && !top) return;
    function onScroll() {
        const st = window.scrollY || document.documentElement.scrollTop;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (bar) bar.style.width = (max > 0 ? (st / max) * 100 : 0) + '%';
        if (top) top.classList.toggle('show', st > 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
