// Small gameplay polish layer: timed kill combos, bonus points, and wave alerts.
(() => {
    function showTime() {
        const clock = document.getElementById('currentTime');
        if (clock) clock.textContent = new Date().toUTCString();
    }
    showTime();
    window.setInterval(showTime, 1000);

    const byId = id => document.getElementById(id);
    let previousKills = null;
    let lastKillAt = 0;
    let combo = 0;
    let noticeTimer;

    function getNotice() {
        let notice = byId('combatNotice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'combatNotice';
            notice.className = 'combat-notice';
            notice.setAttribute('aria-live', 'polite');
            document.body.appendChild(notice);
        }
        return notice;
    }

    function showNotice(message, kind = 'combo') {
        const notice = getNotice();
        notice.textContent = message;
        notice.dataset.kind = kind;
        notice.classList.remove('combat-notice-show');
        void notice.offsetWidth;
        notice.classList.add('combat-notice-show');
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => notice.classList.remove('combat-notice-show'), 1500);
    }

    function awardComboBonus() {
        const now = Date.now();
        combo = now - lastKillAt <= 4000 ? combo + 1 : 1;
        lastKillAt = now;
        const bonus = Math.min(30, combo * 5);

        // points is maintained by the main game script; mirror the award in its HUD and save.
        if (typeof points === 'number') {
            points += bonus;
            const pointsDisplay = byId('pointsDisplay');
            const storePoints = byId('storePoints');
            if (pointsDisplay) pointsDisplay.textContent = points;
            if (storePoints) storePoints.textContent = points;
            if (typeof saveGameProgress === 'function') {
                try { saveGameProgress(false); } catch (error) { /* Autosave can retry on the next game update. */ }
            }
        }

        showNotice(`${combo > 1 ? `${combo} KILL STREAK` : 'KILL CONFIRMED'}  ·  +${bonus} BONUS`, 'combo');
    }

    function watchKills() {
        const score = byId('scoreDisplay');
        if (!score) return false;
        previousKills = Number.parseInt(score.textContent, 10) || 0;
        new MutationObserver(() => {
            const currentKills = Number.parseInt(score.textContent, 10) || 0;
            if (previousKills !== null && currentKills > previousKills) {
                for (let kill = previousKills; kill < currentKills; kill++) awardComboBonus();
            } else if (currentKills < (previousKills || 0)) {
                combo = 0;
                lastKillAt = 0;
            }
            previousKills = currentKills;
        }).observe(score, { childList: true, characterData: true, subtree: true });
        return true;
    }

    function watchWaves() {
        const waveDisplay = byId('waveDisplay');
        if (!waveDisplay) return;
        let previousWave = Number.parseInt(waveDisplay.textContent, 10) || 1;
        new MutationObserver(() => {
            const currentWave = Number.parseInt(waveDisplay.textContent, 10) || 1;
            if (currentWave > previousWave) showNotice(`WAVE ${currentWave} INCOMING — STAY ALERT`, 'wave');
            previousWave = currentWave;
        }).observe(waveDisplay, { childList: true, characterData: true, subtree: true });
    }

    function start() {
        if (!watchKills()) {
            window.setTimeout(start, 300);
            return;
        }
        watchWaves();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();

// Provide separate, platform-specific PWA installation guidance.
(() => {
    const androidButton = document.getElementById('installAndroidButton');
    const iosButton = document.getElementById('installIOSButton');
    const feedback = document.getElementById('installAppFeedback');
    if (!androidButton || !iosButton || !feedback) return;

    let installPrompt = null;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = navigator.standalone === true
        || window.matchMedia('(display-mode: standalone)').matches;

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
    });

    androidButton.addEventListener('click', async () => {
        if (isStandalone) {
            feedback.textContent = 'XC Shooter is already installed. Launch it from your Home Screen or app list.';
            return;
        }

        if (installPrompt) {
            try {
                installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                feedback.textContent = choice.outcome === 'accepted'
                    ? 'Install started. Find XC Shooter on your Home Screen or in your app list.'
                    : 'Install cancelled. You can try again whenever you like.';
            } catch (error) {
                feedback.textContent = 'Open this game in Chrome or another supported Android browser, then use its menu to install the app.';
            } finally {
                installPrompt = null;
            }
            return;
        }

        feedback.textContent = 'Android: open this page in Chrome, tap ⋮, then choose Install app or Add to Home screen. Secure HTTPS hosting is required.';
    });

    iosButton.addEventListener('click', () => {
        if (isIOS && isStandalone) {
            feedback.textContent = 'XC Shooter is already installed. Launch it from your Home Screen.';
        } else {
            feedback.textContent = 'iPhone/iPad: open this page in Safari, tap Share, then Add to Home Screen. Secure HTTPS hosting is required.';
        }
    });

    window.addEventListener('appinstalled', () => {
        feedback.textContent = 'XC Shooter was installed. Find it on your Home Screen or in your app list.';
        androidButton.textContent = 'ANDROID APP INSTALLED';
        androidButton.disabled = true;
    });

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(() => {
                feedback.textContent = 'Installation needs secure HTTPS hosting. Please check this site connection.';
            });
        }, { once: true });
    }
})();
