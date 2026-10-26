/* ================= 星空背景 ================= */
(function () {
    // 用户偏好减少动态效果时不播星空，保留静态渐变背景
    const reducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

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

/* ================= 打字机 ================= */
(function () {
    const el = document.getElementById('typed');
    // 句子由 src/site.config.ts 的 HOME.typedLines 注入（首页内联 JSON），保持单一定制入口
    let lines = null;
    try {
        const src = document.getElementById('typed-lines');
        if (src) {
            const parsed = JSON.parse(src.textContent);
            if (Array.isArray(parsed) && parsed.length && parsed.every(l => typeof l === 'string')) {
                lines = parsed;
            }
        }
    } catch (e) { /* 配置缺失时回退到内置句子 */ }
    if (!lines) {
        lines = [
            '我们的故事，从那年秋天开始',
            '三年同窗，一生朋友',
            '愿此去前程似锦，再相逢依然少年'
        ];
    }
    // 减少动态效果偏好：直接完整展示第一句，不做打字动画
    const reducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
        el.textContent = lines[0];
        return;
    }
    let li = 0, ci = 0, deleting = false;

    function tick() {
        const cur = lines[li];
        if (!deleting) {
            ci++;
            el.textContent = cur.slice(0, ci);
            if (ci === cur.length) {
                deleting = true;
                return setTimeout(tick, 1800);
            }
            return setTimeout(tick, 95);
        } else {
            ci--;
            el.textContent = cur.slice(0, ci);
            if (ci === 0) {
                deleting = false;
                li = (li + 1) % lines.length;
                return setTimeout(tick, 350);
            }
            return setTimeout(tick, 40);
        }
    }
    setTimeout(tick, 900);
})();

/* ================= 滚动出现 ================= */
(function () {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        els.forEach(e => e.classList.add('visible'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const el = entry.target;
                // 延时随文档顺序单调不减（不能取模：那样第 7 个延时回到 0，
                // 会先于它上面的元素出现），到第 6 级后不再累加。
                const idx = Array.from(el.parentElement.children).indexOf(el);
                const delay = Math.min(idx, 6) * 70;
                setTimeout(() => el.classList.add('visible'), delay);
                io.unobserve(el);
            }
        });
    }, { threshold: .12, rootMargin: '0px 0px -60px 0px' });
    els.forEach(e => io.observe(e));
})();

/* ================= 数字滚动 ================= */
(function () {
    const nums = document.querySelectorAll('[data-count]');
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const suffix = target === 999 ? '+' : '';
            let start = null;
            const dur = 1600;
            function step(ts) {
                if (!start) start = ts;
                const p = Math.min((ts - start) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.floor(target * eased) + suffix;
                if (p < 1) requestAnimationFrame(step);
                else el.textContent = target + suffix;
            }
            requestAnimationFrame(step);
            io.unobserve(el);
        });
    }, { threshold: .5 });
    nums.forEach(n => io.observe(n));
})();

/* ================= 进度条 + 回顶部 ================= */
(function () {
    const bar = document.getElementById('progress');
    const top = document.getElementById('top');
    function onScroll() {
        const st = window.scrollY || document.documentElement.scrollTop;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (st / max) * 100 : 0) + '%';
        top.classList.toggle('show', st > 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ================= 留言墙 ================= */
(function () {
    const API = '/api/messages';

    const list  = document.getElementById('msgList');
    const nameI = document.getElementById('msgName');
    const textI = document.getElementById('msgText');
    const btn   = document.getElementById('msgSend');

    let sending = false;

    const BTN_TEXT = '留 言';
    // 跟随页面渲染出的占位符（班级名由 src/site.config.ts 注入），避免在此硬编码
    const PLACEHOLDER = textI.placeholder || '想说点什么……';

    function setTip(tip) {
        list.innerHTML = '';
        const p = document.createElement('p');
        p.style.cssText = 'color:#66708a;font-size:14px;';
        p.textContent = tip;
        list.appendChild(p);
    }

    function render(data) {
        list.innerHTML = '';
        if (!data || !data.length) {
            setTip('还没有留言，来做第一个吧～');
            return;
        }
        data.forEach((m, i) => {
            const d = document.createElement('div');
            d.className = 'msg';
            d.style.animationDelay = Math.min(i * 0.05, 0.4) + 's';

            const who = document.createElement('div');
            who.className = 'who';
            const span = document.createElement('span');
            span.textContent = m.name;
            const time = document.createElement('time');
            time.textContent = m.time;
            who.append(span, time);

            const body = document.createElement('div');
            body.className = 'body';
            body.textContent = m.text;

            d.append(who, body);
            list.appendChild(d);
        });
    }

    async function load() {
        setTip('加载中…');
        try {
            const res = await fetch(API, { headers: { Accept: 'application/json' } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || '加载失败');
            render(data.data);
        } catch (err) {
            setTip('留言加载失败，请刷新重试～');
        }
    }

    async function send() {
        if (sending) return;

        const name = nameI.value.trim();
        const text = textI.value.trim();

        if (!text) {
            textI.focus();
            textI.placeholder = '至少写一句话呀～';
            setTimeout(() => { textI.placeholder = PLACEHOLDER; }, 2000);
            return;
        }

        sending = true;
        btn.disabled = true;
        btn.textContent = '发送中…';

        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, text })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || '发送失败');

            textI.value = '';
            btn.textContent = BTN_TEXT;
            btn.disabled = false;
            sending = false;

            // 直接把新留言插到最前面，不用重新拉全量
            if (data.data) {
                const first = list.querySelector('.msg');
                const d = document.createElement('div');
                d.className = 'msg';
                d.style.animationDelay = '0s';

                const who = document.createElement('div');
                who.className = 'who';
                const span = document.createElement('span');
                span.textContent = data.data.name;
                const time = document.createElement('time');
                time.textContent = data.data.time;
                who.append(span, time);

                const body = document.createElement('div');
                body.className = 'body';
                body.textContent = data.data.text;

                d.append(who, body);

                if (first && first.parentNode === list) list.insertBefore(d, first);
                else {
                    if (list.querySelector('p')) list.innerHTML = '';
                    list.appendChild(d);
                }
            }
            return;
        } catch (err) {
            // 接口返回的中文提示（如「发得太快啦，请等 X 秒」）直接展示，超长才降级
            btn.textContent = err.message && err.message.length <= 30 ? err.message : '发送失败';
            setTimeout(() => {
                btn.textContent = BTN_TEXT;
                btn.disabled = false;
            }, 2400);
            sending = false;
            return;
        }
    }

    btn.addEventListener('click', send);

    textI.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') btn.click();
    });

    load();
})();