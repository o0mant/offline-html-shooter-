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

// Provide separate, platform-specific PWA installation guidance on both account and phone menus.
(() => {
    const androidButtons = ['installAndroidButton', 'platformInstallAndroidButton']
        .map(id => document.getElementById(id)).filter(Boolean);
    const iosButtons = ['installIOSButton', 'platformInstallIOSButton']
        .map(id => document.getElementById(id)).filter(Boolean);
    const feedbackElements = ['installAppFeedback', 'platformInstallAppFeedback']
        .map(id => document.getElementById(id)).filter(Boolean);
    if (!androidButtons.length || !iosButtons.length || !feedbackElements.length) return;

    const showFeedback = message => feedbackElements.forEach(element => { element.textContent = message; });
    let installPrompt = null;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = navigator.standalone === true
        || window.matchMedia('(display-mode: standalone)').matches;

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
    });

    androidButtons.forEach(button => button.addEventListener('click', async () => {
        if (isStandalone) {
            showFeedback('XC Shooter is already installed. Launch it from your Home Screen or app list.');
            return;
        }

        if (installPrompt) {
            try {
                installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                showFeedback(choice.outcome === 'accepted'
                    ? 'Install started. Find XC Shooter on your Home Screen or in your app list.'
                    : 'Install cancelled. You can try again whenever you like.');
            } catch (error) {
                showFeedback('Open this game in Chrome or another supported Android browser, then use its menu to install the app.');
            } finally {
                installPrompt = null;
            }
            return;
        }

        showFeedback('Android: open this page in Chrome, tap ⋮, then choose Install app or Add to Home screen. Secure HTTPS hosting is required.');
    }));

    iosButtons.forEach(button => button.addEventListener('click', () => {
        showFeedback(isIOS && isStandalone
            ? 'XC Shooter is already installed. Launch it from your Home Screen.'
            : 'iPhone/iPad: open this page in Safari, tap Share, then Add to Home Screen. Secure HTTPS hosting is required.');
    }));

    window.addEventListener('appinstalled', () => {
        showFeedback('XC Shooter was installed. Find it on your Home Screen or in your app list.');
        androidButtons.forEach(button => {
            button.textContent = 'ANDROID APP INSTALLED';
            button.disabled = true;
        });
    });

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(() => {
                showFeedback('Installation needs secure HTTPS hosting. Please check this site connection.');
            });
        }, { once: true });
    }
})();

// Salvage the wreck, repair the car, and travel to a brighter city district.
(() => {
    const PARTS = [
        { name: 'ENGINE', color: 0xf97316, x: -10, z: 8, shape: 'engine' },
        { name: 'BATTERY', color: 0x22d3ee, x: 9, z: 11, shape: 'battery' },
        { name: 'FUEL CAN', color: 0xef4444, x: 12, z: -7, shape: 'fuel' },
        { name: 'TIRE 1', color: 0xfbbf24, x: -7, z: -10, shape: 'wheel' },
        { name: 'TIRE 2', color: 0xfbbf24, x: 8, z: -12, shape: 'wheel' },
        { name: 'TIRE 3', color: 0xfbbf24, x: -13, z: 1, shape: 'wheel' },
        { name: 'TIRE 4', color: 0xfbbf24, x: 14, z: 4, shape: 'wheel' }
    ];
    const TIRE_NAMES = PARTS.filter(part => part.shape === 'wheel').map(part => part.name);
    const collected = new Set();
    const installedTires = new Set();
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
    const BIOMES = [
        { name: 'PINE FOREST', x: -112, z: -112, color: '#315844', edge: '#8bd69c', kind: 'forest' },
        { name: 'RED DUNES', x: 112, z: -112, color: '#a86e3d', edge: '#ffd08a', kind: 'desert' },
        { name: 'MIST MARSH', x: -112, z: 112, color: '#315c55', edge: '#8ce0c2', kind: 'marsh' },
        { name: 'FROST RIDGE', x: 112, z: 112, color: '#70899a', edge: '#d9f4ff', kind: 'frost' }
    ];

    const ui = document.createElement('section');
    ui.hidden = true;
    ui.className = 'salvage-panel';
    ui.setAttribute('aria-live', 'polite');
    ui.innerHTML = '<strong class="salvage-heading">WRECK RECOVERY</strong><p class="salvage-objective"></p><p class="salvage-nearby"></p><button class="salvage-action" type="button">SALVAGE PART</button><button class="ride-action" type="button" hidden>ENTER CAR</button><button class="city-action" type="button" hidden>DRIVE TO BRIGHT CITY</button>';
    document.body.appendChild(ui);
    const objective = ui.querySelector('.salvage-objective');
    const nearby = ui.querySelector('.salvage-nearby');
    const salvageButton = ui.querySelector('.salvage-action');
    const rideButton = ui.querySelector('.ride-action');
    const cityButton = ui.querySelector('.city-action');

    function isRepaired() {
        return PARTS.filter(part => part.shape !== 'wheel').every(part => collected.has(part.name))
            && installedTires.size === TIRE_NAMES.length;
    }

    function carriedTire() {
        return TIRE_NAMES.find(name => collected.has(name) && !installedTires.has(name));
    }

    function paintObjective() {
        const recoveredParts = PARTS.filter(part => part.shape !== 'wheel' && collected.has(part.name)).length;
        if (!isRepaired()) {
            objective.textContent = `Parts ${recoveredParts}/3 · tires installed ${installedTires.size}/4`;
            salvageButton.hidden = false;
            rideButton.hidden = true;
            cityButton.hidden = true;
            salvageButton.textContent = carriedTire() && !inCity
                ? (isNearWreck() ? 'INSTALL NEXT TIRE' : 'RETURN TO WRECK')
                : 'SALVAGE PART';
        } else {
            objective.textContent = inCity ? 'Bright City · elite infected nearby' : 'Car repaired · city route unlocked';
            salvageButton.hidden = true;
            rideButton.hidden = false;
            rideButton.textContent = driving ? 'EXIT CAR' : 'ENTER CAR';
            cityButton.hidden = false;
            cityButton.textContent = inCity ? 'RETURN TO OUTPOST' : 'DRIVE TO BRIGHT CITY';
        }
    }

    function addCarWheel(group, x, z) {
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.43, 0.43, 0.28, 12),
            new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.48, z);
        group.add(wheel);
        return wheel;
    }

    function makeCar(color = 0x475569, tireCount = 4) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.75, 1.9), new THREE.MeshStandardMaterial({ color, roughness: 0.76 }));
        body.position.y = 0.85;
        group.add(body);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.72, 1.55), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.25 }));
        cabin.position.set(-0.25, 1.55, 0);
        group.add(cabin);
        const wheelPositions = [[-1.15, -1], [-1.15, 1], [1.15, -1], [1.15, 1]];
        wheelPositions.slice(0, tireCount).forEach(([x, z]) => addCarWheel(group, x, z));
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

    function buildBiomes() {
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x55402c, roughness: 1 });
        const pineMaterial = new THREE.MeshStandardMaterial({ color: 0x174b37, roughness: 0.95 });
        const pineTipMaterial = new THREE.MeshStandardMaterial({ color: 0x2d7650, roughness: 0.9 });
        const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x75634f, roughness: 1 });
        const cactusMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7c4b, roughness: 0.95 });
        const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x1e6470, roughness: 0.3, metalness: 0.15 });
        const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x80934b, roughness: 1 });
        const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xe0f4fa, roughness: 0.95 });

        BIOMES.forEach((biome, biomeIndex) => {
            const patch = new THREE.Mesh(
                new THREE.PlaneGeometry(92, 92),
                new THREE.MeshStandardMaterial({ color: biome.color, roughness: 1, transparent: true, opacity: 0.83 })
            );
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(biome.x, 0.035, biome.z);
            scene.add(patch);

            for (let i = 0; i < 13; i++) {
                const localX = ((i * 29 + biomeIndex * 13) % 76) - 38;
                const localZ = ((i * 41 + biomeIndex * 19) % 76) - 38;
                const x = biome.x + localX;
                const z = biome.z + localZ;
                const prop = new THREE.Group();
                prop.position.set(x, 0, z);

                if (biome.kind === 'forest') {
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 2.2, 7), trunkMaterial);
                    trunk.position.y = 1.1;
                    prop.add(trunk);
                    for (let tier = 0; tier < 3; tier++) {
                        const crown = new THREE.Mesh(new THREE.ConeGeometry(1.8 - tier * 0.3, 2.5, 7), tier === 2 ? pineTipMaterial : pineMaterial);
                        crown.position.y = 2.2 + tier * 1.15;
                        prop.add(crown);
                    }
                } else if (biome.kind === 'desert') {
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 2.3, 7), cactusMaterial);
                    stem.position.y = 1.15;
                    prop.add(stem);
                    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.0, 6), cactusMaterial);
                    arm.position.set(0.42, 1.4, 0);
                    arm.rotation.z = Math.PI / 2;
                    prop.add(arm);
                    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), rockMaterial);
                    rock.position.set(-1.2, 0.45, 0.8);
                    rock.scale.set(1.4, 0.6, 0.85);
                    prop.add(rock);
                } else if (biome.kind === 'marsh') {
                    if (i % 3 === 0) {
                        const pool = new THREE.Mesh(new THREE.CircleGeometry(3 + (i % 2), 12), waterMaterial);
                        pool.rotation.x = -Math.PI / 2;
                        pool.position.y = 0.06;
                        prop.add(pool);
                    }
                    for (let reedIndex = 0; reedIndex < 3; reedIndex++) {
                        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 1.35, 5), reedMaterial);
                        reed.position.set((reedIndex - 1) * 0.35, 0.67, (reedIndex % 2) * 0.3);
                        reed.rotation.z = (reedIndex - 1) * 0.12;
                        prop.add(reed);
                    }
                } else {
                    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 0), i % 2 ? snowMaterial : rockMaterial);
                    boulder.position.y = 0.8;
                    boulder.scale.set(1.2, 0.9 + (i % 3) * 0.25, 1.1);
                    prop.add(boulder);
                    if (i % 2 === 0) {
                        const peak = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.2, 6), snowMaterial);
                        peak.position.set(1.8, 2.0, -1.2);
                        prop.add(peak);
                    }
                }
                scene.add(prop);
            }
        });
    }

    function installWorld() {
        if (typeof THREE === 'undefined' || typeof scene === 'undefined' || !scene || typeof player === 'undefined') return;
        if (scene === worldScene) return;
        worldScene = scene;
        collected.clear();
        installedTires.clear();
        partObjects = [];
        wreckGroup = null;
        driveCar = null;
        cityGroup = null;
        inCity = false;
        driving = false;
        lastBoosted = new WeakSet();
        originalSpeed = null;
        wreckGroup = makeCar(0x334155, 0);
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
        buildBiomes();
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

    function isNearWreck() {
        return typeof player !== 'undefined' && Math.hypot(player.x - wreckGroup.position.x, player.z - wreckGroup.position.z) < 4.2;
    }

    function interactWithCarAndParts() {
        if (!isRepaired() && !inCity && isNearWreck() && carriedTire()) {
            const tireName = carriedTire();
            const tireIndex = TIRE_NAMES.indexOf(tireName);
            installedTires.add(tireName);
            const wheelPositions = [[-1.15, -1], [-1.15, 1], [1.15, -1], [1.15, 1]];
            addCarWheel(wreckGroup, ...wheelPositions[tireIndex]);
            nearby.textContent = `${tireName} installed · ${installedTires.size}/4 tires fitted.`;
            if (isRepaired()) {
                driveCar = makeCar(0x16a34a);
                driveCar.position.set(player.x, 0, player.z);
                scene.add(driveCar);
                nearby.textContent = 'All parts fitted — the car is ready to drive!';
            }
            paintObjective();
            return;
        }

        const part = nearestPart();
        if (!part) return;
        const name = part.userData.salvagePart;
        collected.add(name);
        scene.remove(part);
        partObjects = partObjects.filter(item => item !== part);
        nearby.textContent = `${name} recovered. Return to the wreck to install tires.`;
        paintObjective();
    }

    function switchMap(toCity) {
        if (!cityGroup || !isRepaired()) return;
        inCity = toCity;
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

    function setDriving(active) {
        if (!isRepaired() || driving === active) return;
        driving = active;
        if (active) {
            originalSpeed = player.speed;
            player.speed = Math.max(player.speed, 0.34);
            nearby.textContent = 'You are in the car. Use the movement controls to drive.';
        } else {
            if (originalSpeed !== null) player.speed = originalSpeed;
            originalSpeed = null;
            nearby.textContent = 'You stepped out of the car.';
        }
        paintObjective();
    }

    function toggleRide() {
        setDriving(!driving);
    }

    function toggleCity() {
        if (!isRepaired()) return;
        if (!inCity) {
            setDriving(true);
            switchMap(true);
        } else {
            switchMap(false);
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

    const fullMapScreen = document.getElementById('fullMapScreen');
    const fullMapCanvas = document.getElementById('fullMapCanvas');
    const fullMapButton = document.getElementById('fullMapButton');
    let fullMapOpen = false;
    let mapReturnState = 'PLAYING';

    function closeFullMap() {
        if (!fullMapOpen) return;
        fullMapOpen = false;
        fullMapScreen.hidden = true;
        if (typeof gameState !== 'undefined' && gameState === 'MAP') gameState = mapReturnState;
        fullMapButton.focus();
    }

    function toggleFullMap(forceOpen) {
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !fullMapOpen;
        if (shouldOpen === fullMapOpen) return;
        if (shouldOpen && gameState !== 'PLAYING') return;
        fullMapOpen = shouldOpen;
        if (fullMapOpen) {
            mapReturnState = gameState;
            gameState = 'MAP';
            fullMapScreen.hidden = false;
            document.getElementById('closeFullMapButton').focus();
        } else {
            closeFullMap();
        }
    }

    function drawDetailedMinimap(targetCanvas = document.getElementById('minimapCanvas'), fullMap = false) {
        const canvas = targetCanvas;
        if (!canvas || typeof player === 'undefined') return;
        const size = fullMap ? 800 : 220;
        if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        const mapCenterX = fullMap ? 150 : player.x;
        const mapCenterZ = fullMap ? 150 : player.z;
        const viewRadius = fullMap ? 350 : (inCity ? 68 : 38);
        const scale = size / (viewRadius * 2);
        const mapX = x => center + (x - mapCenterX) * scale;
        const mapZ = z => center + (z - mapCenterZ) * scale;

        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        if (fullMap) ctx.rect(0, 0, size, size);
        else ctx.arc(center, center, center - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = inCity ? '#b7dda0' : '#263b38';
        ctx.fillRect(0, 0, size, size);

        BIOMES.forEach(biome => {
            const left = mapX(biome.x - 46), top = mapZ(biome.z - 46);
            const zoneSize = 92 * scale;
            if (left <= size && top <= size && left + zoneSize >= 0 && top + zoneSize >= 0) {
                ctx.fillStyle = biome.color;
                ctx.globalAlpha = fullMap ? 0.88 : 0.76;
                ctx.fillRect(left, top, zoneSize, zoneSize);
                ctx.globalAlpha = 1;
                if (fullMap) {
                    ctx.strokeStyle = biome.edge;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(left, top, zoneSize, zoneSize);
                    ctx.fillStyle = '#f8fafc';
                    ctx.font = 'bold 13px system-ui';
                    ctx.textAlign = 'center';
                    ctx.fillText(biome.name, mapX(biome.x), mapZ(biome.z));
                }
            }
        });

        const grid = fullMap ? 50 : (inCity ? 19 : 10);
        ctx.strokeStyle = fullMap ? 'rgba(226, 232, 240, .16)' : (inCity ? 'rgba(61, 104, 75, .24)' : 'rgba(148, 163, 184, .18)');
        ctx.lineWidth = 1;
        const firstX = Math.floor((mapCenterX - viewRadius) / grid) * grid;
        const firstZ = Math.floor((mapCenterZ - viewRadius) / grid) * grid;
        for (let x = firstX; x <= mapCenterX + viewRadius; x += grid) {
            ctx.beginPath(); ctx.moveTo(mapX(x), 0); ctx.lineTo(mapX(x), size); ctx.stroke();
        }
        for (let z = firstZ; z <= mapCenterZ + viewRadius; z += grid) {
            ctx.beginPath(); ctx.moveTo(0, mapZ(z)); ctx.lineTo(size, mapZ(z)); ctx.stroke();
        }

        if (inCity || fullMap) {
            ctx.fillStyle = '#485569';
            if (fullMap) {
                ctx.fillRect(mapX(228), mapZ(470), 24 * scale, 460 * scale);
                ctx.fillRect(mapX(10), mapZ(228), 460 * scale, 24 * scale);
            } else {
                ctx.fillRect(mapX(228), 0, 24 * scale, size);
                ctx.fillRect(0, mapZ(228), size, 24 * scale);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, .65)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(mapX(240), fullMap ? mapZ(470) : 0); ctx.lineTo(mapX(240), fullMap ? mapZ(10) : size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fullMap ? mapX(10) : 0, mapZ(240)); ctx.lineTo(fullMap ? mapX(470) : size, mapZ(240)); ctx.stroke();
            ctx.setLineDash([]);
            const colors = ['#e9bb80', '#91bfd1', '#d99d9d', '#d0d5df', '#93ad92', '#dfbd58'];
            let building = 0;
            for (let x = 170; x <= 310; x += 38) {
                for (let z = 170; z <= 310; z += 38) {
                    if (Math.abs(x - 240) < 24 || Math.abs(z - 240) < 24) continue;
                    const left = mapX(x - 9), top = mapZ(z - 9);
                    const width = 18 * scale, height = 18 * scale;
                    if (left > size || top > size || left + width < 0 || top + height < 0) continue;
                    ctx.fillStyle = colors[building++ % colors.length];
                    ctx.fillRect(left, top, width, height);
                    ctx.strokeStyle = 'rgba(40, 55, 65, .7)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(left, top, width, height);
                    ctx.fillStyle = 'rgba(255, 245, 180, .9)';
                    ctx.fillRect(left + width * .25, top + height * .2, Math.max(2, width * .12), Math.max(2, height * .12));
                    ctx.fillRect(left + width * .62, top + height * .62, Math.max(2, width * .12), Math.max(2, height * .12));
                }
            }
            if (fullMap) {
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 13px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('BRIGHT CITY', mapX(240), mapZ(330));
            }
        }
        if (!inCity || fullMap) {
            const nearbyObstacles = typeof obstacles !== 'undefined' && Array.isArray(obstacles) ? obstacles : [];
            nearbyObstacles.forEach(item => {
                if (!item || typeof item !== 'object') return;
                const object = item.mesh || item;
                const pos = object.position || item.position;
                if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;
                const x = mapX(pos.x), z = mapZ(pos.z);
                if (x < 0 || x > size || z < 0 || z > size) return;
                const width = fullMap && object.geometry?.parameters?.width ? Math.max(3, object.geometry.parameters.width * scale) : (fullMap ? 3 : 6);
                const depth = fullMap && object.geometry?.parameters?.depth ? Math.max(3, object.geometry.parameters.depth * scale) : (fullMap ? 3 : 6);
                ctx.fillStyle = '#687783';
                ctx.fillRect(x - width / 2, z - depth / 2, width, depth);
                if (!fullMap) {
                    ctx.strokeStyle = 'rgba(226, 232, 240, .65)';
                    ctx.strokeRect(x - width / 2, z - depth / 2, width, depth);
                }
            });
        }

        const drawDot = (x, z, color, radius, label = '') => {
            const px = mapX(x), pz = mapZ(z);
            if (px < -8 || px > size + 8 || pz < -8 || pz > size + 8) return;
            ctx.beginPath();
            ctx.arc(px, pz, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 7;
            ctx.fill();
            ctx.shadowBlur = 0;
            if (label) {
                ctx.fillStyle = '#07111b';
                ctx.font = fullMap ? 'bold 12px system-ui' : 'bold 7px system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, px, pz + 0.5);
            }
        };

        if (wreckGroup && (!inCity || fullMap)) {
            const x = mapX(wreckGroup.position.x), z = mapZ(wreckGroup.position.z);
            ctx.fillStyle = '#f97316';
            ctx.fillRect(x - 5, z - 5, 10, 10);
            ctx.strokeStyle = '#fff7ed';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 5, z - 5, 10, 10);
        }
        partObjects.forEach(part => {
            const name = part.userData.salvagePart || '';
            const label = name.startsWith('TIRE') ? 'T' : name === 'ENGINE' ? 'E' : name === 'BATTERY' ? 'B' : 'F';
            const color = name.startsWith('TIRE') ? '#fbbf24' : name === 'ENGINE' ? '#f97316' : name === 'BATTERY' ? '#22d3ee' : '#ef4444';
            drawDot(part.position.x, part.position.z, color, fullMap ? 7 : 4.2, label);
        });
        if (typeof zombies !== 'undefined' && Array.isArray(zombies)) {
            zombies.forEach(zombie => {
                if (!zombie || typeof zombie !== 'object') return;
                const object = zombie.mesh || zombie.group || zombie.model || zombie;
                const x = Number.isFinite(zombie.x) ? zombie.x : object.position && object.position.x;
                const z = Number.isFinite(zombie.z) ? zombie.z : object.position && object.position.z;
                if (Number.isFinite(x) && Number.isFinite(z)) drawDot(x, z, '#fb3d4b', fullMap ? 5 : 2.8);
            });
        }
        if (driveCar && (driving || fullMap)) drawDot(driveCar.position.x, driveCar.position.z, '#34d399', fullMap ? 5 : 4.2, 'C');

        ctx.save();
        ctx.translate(mapX(player.x), mapZ(player.z));
        ctx.rotate(typeof mouseX === 'number' ? -mouseX : 0);
        ctx.fillStyle = '#67e8f9';
        ctx.strokeStyle = '#082f49';
        ctx.lineWidth = fullMap ? 2.5 : 1.5;
        const playerArrowSize = fullMap ? 14 : 8;
        ctx.beginPath();
        ctx.moveTo(0, -playerArrowSize); ctx.lineTo(playerArrowSize * 0.75, playerArrowSize * 0.75); ctx.lineTo(0, playerArrowSize * 0.38); ctx.lineTo(-playerArrowSize * 0.75, playerArrowSize * 0.75); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.restore();

        ctx.beginPath();
        if (fullMap) ctx.rect(1, 1, size - 2, size - 2);
        else ctx.arc(center, center, center - 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(125, 211, 252, .9)';
        ctx.lineWidth = fullMap ? 3 : 2;
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = fullMap ? 'bold 18px system-ui' : 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(fullMap ? 'OUTPOST  ·  FOUR BIOMES  ·  BRIGHT CITY' : (inCity ? 'BRIGHT CITY' : 'OUTPOST'), center, fullMap ? 25 : 14);
    }

    function minimapFrame() {
        try {
            if (worldScene && typeof gameState !== 'undefined') {
                if (gameState === 'PLAYING' || fullMapOpen) drawDetailedMinimap();
                if (fullMapOpen) drawDetailedMinimap(fullMapCanvas, true);
            }
        } catch (error) { /* The normal game HUD remains available if a scene refresh resets the map canvas. */ }
        window.requestAnimationFrame(minimapFrame);
    }
    window.requestAnimationFrame(minimapFrame);

    fullMapButton.addEventListener('click', () => toggleFullMap(true));
    document.getElementById('closeFullMapButton').addEventListener('click', closeFullMap);
    fullMapScreen.addEventListener('click', event => {
        if (event.target === fullMapScreen) closeFullMap();
    });
    window.addEventListener('keydown', event => {
        if (event.key.toLowerCase() === 'm' && gameState === 'PLAYING') {
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleFullMap();
        } else if (event.key === 'Escape' && fullMapOpen) {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeFullMap();
        }
    }, true);

    salvageButton.addEventListener('click', interactWithCarAndParts);
    rideButton.addEventListener('click', toggleRide);
    cityButton.addEventListener('click', toggleCity);
    window.addEventListener('keydown', event => {
        if (event.key.toLowerCase() === 'e' && gameState === 'PLAYING' && !ui.contains(event.target)) interactWithCarAndParts();
        if (event.key.toLowerCase() === 'f' && gameState === 'PLAYING' && isRepaired() && !ui.contains(event.target)) toggleRide();
    });

    window.setInterval(() => {
        try {
            installWorld();
            ui.hidden = typeof gameState === 'undefined' || gameState !== 'PLAYING';
            if (!worldScene || worldScene !== scene || gameState !== 'PLAYING') return;
            const part = nearestPart();
            const tireReadyToInstall = !inCity && isNearWreck() && Boolean(carriedTire());
            salvageButton.disabled = !part && !tireReadyToInstall;
            nearby.textContent = tireReadyToInstall
                ? `At the wreck · install ${carriedTire()} here.`
                : (part
                    ? `Nearby: ${part.userData.salvagePart} · tap to collect or press E`
                    : (isRepaired()
                        ? (driving ? 'In car · move to drive. Press F or EXIT CAR to get out.' : 'Car ready · press ENTER CAR or F to drive.')
                        : 'Find the glowing parts; tires must be fitted at the wreck.'));
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
