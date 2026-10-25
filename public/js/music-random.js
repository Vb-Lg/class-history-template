/* ================= 随机抽取歌曲 ================= */
/* 歌单数据由 /music/ 页面以 <script type="application/json" id="songs-data"> 注入 */
(function () {
    const dataEl = document.getElementById('songs-data');
    const btn = document.getElementById('draw-btn');
    const dialog = document.getElementById('draw-dialog');
    if (!dataEl || !btn || !dialog) return;

    let songs = [];
    try {
        songs = JSON.parse(dataEl.textContent || '[]');
    } catch (err) {
        songs = [];
    }
    if (!Array.isArray(songs) || songs.length === 0) {
        btn.hidden = true;
        return;
    }

    const announceEl = document.getElementById('draw-announce');
    const titleEl = document.getElementById('draw-song');
    const artistEl = document.getElementById('draw-artist');
    const noteEl = document.getElementById('draw-note');
    const byEl = document.getElementById('draw-by');
    const playEl = document.getElementById('draw-play');
    const againEl = document.getElementById('draw-again');
    const closeEl = document.getElementById('draw-close');
    const locateEl = document.getElementById('draw-locate');

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = -1;      // 上次抽中的索引，避免连续重复
    let rollTimer = null;  // 滚动定时器
    let popTimer = null;
    let enterTimer = null;
    let flashTimer = null;

    /* 抽取一个和上次不同的索引（只有一首时允许重复） */
    function pickIndex() {
        if (songs.length === 1) return 0;
        let i = Math.floor(Math.random() * songs.length);
        while (i === current) i = Math.floor(Math.random() * songs.length);
        return i;
    }

    function render(index, done) {
        const s = songs[index] || {};
        titleEl.textContent = s.title || '';
        artistEl.textContent = s.artist || '';
        noteEl.textContent = s.note || '';
        noteEl.hidden = !s.note;
        byEl.textContent = s.author || '';
        byEl.hidden = !s.author;
        if (s.link) {
            playEl.setAttribute('href', s.link);
            playEl.hidden = false;
        } else {
            playEl.removeAttribute('href');
            playEl.hidden = true;
        }
        if (done) dialog.dataset.index = String(index);
    }

    function stopRoll() {
        if (rollTimer) {
            clearTimeout(rollTimer);
            rollTimer = null;
        }
        if (popTimer) {
            clearTimeout(popTimer);
            popTimer = null;
        }
    }

    /* 滚动结束，定格在目标歌曲上 */
    function settle(index) {
        stopRoll();
        current = index;
        render(index, true);
        dialog.classList.remove('rolling');
        if (announceEl) {
            const s = songs[index] || {};
            announceEl.textContent = '抽中：' + (s.title || '') + (s.artist ? ' · ' + s.artist : '');
        }
        if (!reduce) {
            dialog.classList.add('pop');
            popTimer = setTimeout(() => {
                dialog.classList.remove('pop');
                popTimer = null;
            }, 480);
        }
    }

    function draw() {
        stopRoll();
        const target = pickIndex();
        dialog.classList.remove('pop');

        if (reduce) {
            settle(target);
            return;
        }

        dialog.classList.add('rolling');
        const duration = 950;
        const start = Date.now();

        (function tick() {
            const elapsed = Date.now() - start;
            render(Math.floor(Math.random() * songs.length), false);
            if (elapsed >= duration) {
                settle(target);
                return;
            }
            // 越接近结束，切换间隔越大，形成"减速"手感
            const delay = 45 + Math.round((elapsed / duration) * 135);
            rollTimer = setTimeout(tick, delay);
        })();
    }

    function openDialog() {
        if (!dialog.open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        }
        // 每次打开播放一次登场动画
        if (!reduce) {
            dialog.classList.remove('open-in');
            void dialog.offsetWidth; // 强制重排，让动画可以重复播放
            dialog.classList.add('open-in');
            if (enterTimer) clearTimeout(enterTimer);
            enterTimer = setTimeout(() => {
                dialog.classList.remove('open-in');
                enterTimer = null;
            }, 360);
        }
        draw();
    }

    function closeDialog() {
        stopRoll();
        if (enterTimer) {
            clearTimeout(enterTimer);
            enterTimer = null;
        }
        dialog.classList.remove('open-in');
        if (typeof dialog.close === 'function') {
            if (dialog.open) dialog.close();
        } else {
            dialog.removeAttribute('open');
        }
    }

    btn.addEventListener('click', openDialog);
    againEl.addEventListener('click', draw);
    closeEl.addEventListener('click', closeDialog);

    // 点击遮罩关闭
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeDialog();
    });
    // 原生 dialog 的 Esc 关闭
    dialog.addEventListener('close', stopRoll);
    dialog.addEventListener('cancel', stopRoll);

    // 在歌单中查看：关闭弹窗并定位高亮
    locateEl.addEventListener('click', () => {
        const index = Number(dialog.dataset.index);
        closeDialog();
        if (!Number.isInteger(index)) return;
        const li = document.querySelector('.song-list .song[data-index="' + index + '"]');
        if (!li) return;
        li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        li.classList.add('flash');
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
            li.classList.remove('flash');
            flashTimer = null;
        }, 1800);
    });

    // 键盘快捷键：R 抽一首 / 再抽一首
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'r' && e.key !== 'R') return;
        if (e.repeat) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        e.preventDefault();
        if (dialog.open) draw();
        else openDialog();
    });
})();
