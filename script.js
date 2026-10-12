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

// Salvage the wreck, repair the car, and travel to a brighter city district.
(() => {
    const PARTS = [
        { name: 'ENGINE', color: 0xf97316, x: -10, z: 8, shape: 'engine' },
        { name: 'BATTERY', color: 0x22d3ee, x: 9, z: 11, shape: 'battery' },
        { name: 'WHEEL', color: 0xfbbf24, x: -7, z: -10, shape: 'wheel' },
        { name: 'FUEL CAN', color: 0xef4444, x: 12, z: -7, shape: 'fuel' }
    ];
    const collected = new Set();
    let worldScene = null;
    let wreckGroup = null;
    let driveCar = null;
    let cityGroup = null;
    let partObjects = [];
    let inCity = false;
    let driving = false;
    let lastPlayerPosition = null;
    let originalSpeed = null;
    let lastBoosted = new WeakSet();
    let savedAtmosphere = null;

    const ui = document.createElement('section');
    ui.hidden = true;
    ui.className = 'salvage-panel';
    ui.setAttribute('aria-live', 'polite');
    ui.innerHTML = '<strong class="salvage-heading">WRECK RECOVERY</strong><p class="salvage-objective"></p><p class="salvage-nearby"></p><button class="salvage-action" type="button">SALVAGE PART</button><button class="city-action" type="button" hidden>DRIVE TO BRIGHT CITY</button>';
    document.body.appendChild(ui);
    const objective = ui.querySelector('.salvage-objective');
    const nearby = ui.querySelector('.salvage-nearby');
    const salvageButton = ui.querySelector('.salvage-action');
    const cityButton = ui.querySelector('.city-action');

    function paintObjective() {
        if (collected.size < PARTS.length) {
            objective.textContent = `Recover car parts · ${collected.size}/${PARTS.length}`;
            salvageButton.hidden = collected.size === PARTS.length;
            cityButton.hidden = true;
        } else {
            objective.textContent = inCity ? 'Bright City · elite infected nearby' : 'Car repaired · city route unlocked';
            salvageButton.hidden = true;
            cityButton.hidden = false;
            cityButton.textContent = inCity ? 'RETURN TO OUTPOST' : (driving ? 'PARK VEHICLE' : 'DRIVE TO BRIGHT CITY');
        }
    }

    function makeCar(color = 0x475569) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.75, 1.9), new THREE.MeshStandardMaterial({ color, roughness: 0.76 }));
        body.position.y = 0.85;
        group.add(body);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.72, 1.55), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.25 }));
        cabin.position.set(-0.25, 1.55, 0);
        group.add(cabin);
        const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
        [-1.15, 1.15].forEach(x => [-1, 1].forEach(z => {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.28, 12), dark);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, 0.48, z);
            group.add(wheel);
        }));
        const glass = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.2 });
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 1.28), glass);
        windshield.position.set(0.68, 1.56, 0);
        group.add(windshield);
        return group;
    }

    function addPartMesh(part) {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({ color: part.color, emissive: part.color, emissiveIntensity: 0.45, roughness: 0.55 });
        let mesh;
        if (part.shape === 'wheel') {
            mesh = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.18, 10, 20), material);
            mesh.rotation.x = Math.PI / 2;
        } else {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(part.shape === 'engine' ? 1.15 : 0.9, 0.65, 0.75), material);
            if (part.shape === 'fuel') mesh.scale.set(0.75, 1.15, 0.7);
        }
        mesh.position.y = 0.72;
        group.add(mesh);
        const beacon = new THREE.PointLight(part.color, 1.2, 4);
        beacon.position.y = 1.1;
        group.add(beacon);
        group.position.set(part.x, 0, part.z);
        group.userData.salvagePart = part.name;
        scene.add(group);
        partObjects.push(group);
    }

    function addBuilding(group, x, z, width, depth, height, color, seed) {
        const building = new THREE.Group();
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshStandardMaterial({ color, roughness: 0.86, emissive: 0x172033, emissiveIntensity: 0.12 })
        );
        block.position.y = height / 2;
        building.add(block);
        const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xfbbf24, emissiveIntensity: 0.45 });
        const rows = Math.min(7, Math.max(2, Math.floor(height / 2.5)));
        for (let row = 0; row < rows; row++) {
            for (let col = -1; col <= 1; col++) {
                if ((row + col + seed) % 5 === 0) continue;
                const pane = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.06), windowMaterial);
                pane.position.set(col * width * 0.27, 1.6 + row * 1.8, depth / 2 + 0.04);
                building.add(pane);
                const sidePane = pane.clone();
                sidePane.rotation.y = Math.PI / 2;
                sidePane.position.set(width / 2 + 0.04, 1.6 + row * 1.8, col * depth * 0.25);
                building.add(sidePane);
            }
        }
        building.position.set(x, 0, z);
        group.add(building);
    }

    function buildCity() {
        cityGroup = new THREE.Group();
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ color: 0x8fcf91, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(240, 0.015, 240);
        cityGroup.add(ground);
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(24, 460), roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(240, 0.04, 240);
        cityGroup.add(road);
        const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(460, 22), roadMaterial);
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.position.set(240, 0.045, 240);
        cityGroup.add(crossRoad);
        const colors = [0xf1c27d, 0x9bc4d8, 0xd9a6a6, 0xd4d9e2, 0x9db79b, 0xe9c46a];
        let seed = 0;
        for (let x = 170; x <= 310; x += 38) {
            for (let z = 170; z <= 310; z += 38) {
                if (Math.abs(x - 240) < 24 || Math.abs(z - 240) < 24) continue;
                const height = 13 + ((seed * 17) % 5) * 4;
                addBuilding(cityGroup, x, z, 18, 18, height, colors[seed % colors.length], seed++);
            }
        }
        // Small trees and street lamps brighten the safe-looking city streets.
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x795548 });
        const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });
        for (let i = 0; i < 14; i++) {
            const z = 40 + i * 30;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.2, 7), trunkMaterial);
            trunk.position.set(222, 1.1, z);
            cityGroup.add(trunk);
            const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 7), leafMaterial);
            leaves.position.set(222, 2.8, z);
            cityGroup.add(leaves);
        }
        scene.add(cityGroup);
        cityGroup.visible = false;
    }

    function installWorld() {
        if (typeof THREE === 'undefined' || typeof scene === 'undefined' || !scene || typeof player === 'undefined') return;
        if (scene === worldScene) return;
        worldScene = scene;
        collected.clear();
        partObjects = [];
        wreckGroup = null;
        driveCar = null;
        cityGroup = null;
        inCity = false;
        driving = false;
        lastBoosted = new WeakSet();
        originalSpeed = null;
        wreckGroup = makeCar(0x334155);
        wreckGroup.position.set(0, 0, 0);
        wreckGroup.rotation.y = 0.35;
        scene.add(wreckGroup);
        // Make the wreck visibly damaged.
        const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
        for (let i = 0; i < 5; i++) {
            const debris = new THREE.Mesh(new THREE.BoxGeometry(0.9 + i * 0.12, 0.12, 0.55), debrisMaterial);
            debris.position.set(-2.5 + i, 0.12, (i % 2 ? 1 : -1) * (1.3 + (i % 3) * 0.35));
            debris.rotation.y = i * 0.7;
            wreckGroup.add(debris);
        }
        PARTS.forEach(addPartMesh);
        buildCity();
        savedAtmosphere = null;
        lastPlayerPosition = null;
        paintObjective();
    }

    function nearestPart() {
        if (typeof player === 'undefined') return null;
        let nearest = null;
        let distance = 2.8;
        partObjects.forEach(object => {
            const name = object.userData.salvagePart;
            if (collected.has(name)) return;
            const current = Math.hypot(player.x - object.position.x, player.z - object.position.z);
            if (current < distance) { distance = current; nearest = object; }
        });
        return nearest;
    }

    function collectNearest() {
        const part = nearestPart();
        if (!part) return;
        collected.add(part.userData.salvagePart);
        scene.remove(part);
        partObjects = partObjects.filter(item => item !== part);
        if (collected.size === PARTS.length) {
            driveCar = makeCar(0x16a34a);
            driveCar.position.set(player.x, 0, player.z);
            scene.add(driveCar);
            nearby.textContent = 'All parts recovered — the car is repaired!';
        } else {
            nearby.textContent = `${part.userData.salvagePart} recovered.`;
        }
        paintObjective();
    }

    function switchMap(toCity) {
        if (!cityGroup || collected.size < PARTS.length) return;
        inCity = toCity;
        driving = false;
        if (!savedAtmosphere) savedAtmosphere = { background: scene.background, fog: scene.fog };
        cityGroup.visible = toCity;
        if (toCity) {
            player.x = 240;
            player.z = 240;
            if (typeof mouseX === 'number') mouseX = 0;
            scene.background = new THREE.Color(0x9bdcff);
            scene.fog = new THREE.Fog(0xc8edff, 100, 390);
            if (typeof ambientLight !== 'undefined' && ambientLight) ambientLight.intensity = 1.6;
            if (typeof sunLight !== 'undefined' && sunLight) sunLight.intensity = 2.2;
            nearby.textContent = 'Explore the bright city — its infected are much tougher.';
        } else {
            player.x = 0;
            player.z = 0;
            scene.background = savedAtmosphere.background;
            scene.fog = savedAtmosphere.fog;
            if (typeof ambientLight !== 'undefined' && ambientLight) ambientLight.intensity = 0.8;
            if (typeof sunLight !== 'undefined' && sunLight) sunLight.intensity = 1.2;
            nearby.textContent = 'Returned to the outpost.';
        }
        paintObjective();
    }

    function toggleDrive() {
        if (collected.size < PARTS.length) return;
        if (!inCity) {
            switchMap(true);
            driving = true;
            originalSpeed = player.speed;
            player.speed = Math.max(player.speed, 0.34);
            cityButton.textContent = 'PARK VEHICLE';
        } else {
            switchMap(false);
            if (originalSpeed !== null) player.speed = originalSpeed;
            originalSpeed = null;
        }
    }

    function powerUpCityZombies() {
        if (!inCity || typeof zombies === 'undefined' || !Array.isArray(zombies)) return;
        zombies.forEach(zombie => {
            if (!zombie || typeof zombie !== 'object' || lastBoosted.has(zombie)) return;
            const healthKey = typeof zombie.health === 'number' ? 'health' : (typeof zombie.hp === 'number' ? 'hp' : null);
            if (healthKey) {
                zombie[healthKey] *= 2;
                if (typeof zombie.maxHealth === 'number') zombie.maxHealth *= 2;
                else if (healthKey === 'health') zombie.maxHealth = zombie.health;
            }
            const speedKey = typeof zombie.speed === 'number' ? 'speed' : (typeof zombie.moveSpeed === 'number' ? 'moveSpeed' : null);
            if (speedKey) zombie[speedKey] *= 1.35;
            const mesh = zombie.mesh || zombie.group || zombie.model;
            if (mesh && mesh.scale && typeof mesh.scale.multiplyScalar === 'function') mesh.scale.multiplyScalar(1.18);
            lastBoosted.add(zombie);
        });
    }

    salvageButton.addEventListener('click', collectNearest);
    cityButton.addEventListener('click', toggleDrive);
    window.addEventListener('keydown', event => {
        if (event.key.toLowerCase() === 'e' && gameState === 'PLAYING' && !ui.contains(event.target)) collectNearest();
    });

    window.setInterval(() => {
        try {
            installWorld();
            ui.hidden = typeof gameState === 'undefined' || gameState !== 'PLAYING';
            if (!worldScene || worldScene !== scene || gameState !== 'PLAYING') return;
            const part = nearestPart();
            salvageButton.disabled = !part;
            nearby.textContent = part
                ? `Nearby: ${part.userData.salvagePart} · tap to salvage or press E`
                : (collected.size < PARTS.length ? 'Find the glowing parts around the wreck.' : (nearby.textContent.includes('recovered') ? nearby.textContent : ''));
            if (driveCar && typeof player !== 'undefined') {
                if (driving) {
                    const yaw = typeof mouseX === 'number' ? mouseX : 0;
                    driveCar.position.set(player.x - Math.sin(yaw) * 2.2, 0, player.z - Math.cos(yaw) * 2.2);
                    driveCar.rotation.y = yaw;
                } else if (!inCity) {
                    driveCar.position.set(0, 0, 0);
                }
            }
            powerUpCityZombies();
            paintObjective();
        } catch (error) {
            // Keep the base game running if a scene refresh happens during a match transition.
        }
    }, 120);
})();
