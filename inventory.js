// Keep purchased ammunition and owned gear usable and visible in the armory.
(() => {
    const byId = id => document.getElementById(id);
    const inventory = byId('ownedLoadoutInventory');
    const ammoButton = byId('buyAmmoButton');
    if (!inventory || !ammoButton) return;

    const fittedKey = () => `${typeof SAVE_KEY === 'string' ? SAVE_KEY : 'dawnSurvivorSave'}:fittedLoadout`;
    let fittedStorageKey = fittedKey();
    let fittedItems = {};

    function loadFittedItems() {
        fittedStorageKey = fittedKey();
        try { fittedItems = JSON.parse(localStorage.getItem(fittedStorageKey) || '{}') || {}; } catch (error) { fittedItems = {}; }
    }
    loadFittedItems();

    function persistFittedItems() {
        fittedStorageKey = fittedKey();
        try { localStorage.setItem(fittedStorageKey, JSON.stringify(fittedItems)); } catch (error) { /* The selected fit remains active for this session. */ }
    }

    function ownedWeaponKeys() {
        if (typeof ownedWeapons === 'undefined' || !ownedWeapons) return [];
        const keys = ownedWeapons instanceof Set ? Array.from(ownedWeapons) : Object.keys(ownedWeapons).filter(key => ownedWeapons[key]);
        return keys.filter(key => typeof WEAPONS !== 'undefined' && WEAPONS[key]);
    }

    function weaponState(key) {
        if (typeof weaponStates === 'undefined' || !weaponStates) return null;
        return weaponStates[key] || null;
    }

    function ammoFor(key) {
        const state = weaponState(key) || {};
        const active = typeof player !== 'undefined' && player.currentWeaponKey === key;
        const capacity = typeof WEAPONS !== 'undefined' && WEAPONS[key] ? WEAPONS[key].maxAmmo : 0;
        return {
            loaded: active && Number.isFinite(player.ammo) ? player.ammo : (Number.isFinite(state.ammo) ? state.ammo : capacity),
            reserve: active && Number.isFinite(player.reserveAmmo) ? player.reserveAmmo : (Number.isFinite(state.reserveAmmo) ? state.reserveAmmo : 0)
        };
    }

    function allOwnedGear() {
        const gear = [];
        if (typeof ownedOptics !== 'undefined' && ownedOptics) {
            const optics = ownedOptics instanceof Set ? Array.from(ownedOptics) : Object.keys(ownedOptics).filter(key => ownedOptics[key]);
            optics.forEach(key => gear.push({ id: `optic:${key}`, key, name: key === 'CARBINE' ? '2× CARBINE OPTIC' : '4× SNIPER SCOPE', type: 'optic' }));
        }
        const addonKeys = typeof ownedAddons !== 'undefined' && ownedAddons
            ? (ownedAddons instanceof Set ? Array.from(ownedAddons) : Object.keys(ownedAddons).filter(key => ownedAddons[key]))
            : [];
        addonKeys.forEach(key => gear.push({ id: `addon:${key}`, key, name: String(key).replace(/[_-]+/g, ' '), type: 'addon' }));
        byId('addonStoreGrid')?.querySelectorAll('button:disabled').forEach(button => {
            const id = button.dataset.addon || button.id || button.textContent.trim();
            if (!gear.some(item => item.id === `addon:${id}` || item.name === button.textContent.trim())) {
                const name = button.querySelector('strong')?.textContent?.trim()
                    || button.textContent.trim().split(/\s{2,}|\n/)[0].replace(/\s*OWNED.*$/i, '').trim();
                if (name) gear.push({ id: `addon:${id}`, key: id, name, type: 'addon' });
            }
        });
        return gear;
    }

    function gearFits(gear, weaponKey) {
        return gear.type !== 'optic' || gear.key === weaponKey;
    }

    function equipWeapon(key) {
        const existing = byId('inventoryList');
        const target = typeof WEAPONS !== 'undefined' ? WEAPONS[key] : null;
        const originalButton = existing && Array.from(existing.querySelectorAll('button')).find(button => {
            const token = `${button.dataset.weapon || ''} ${button.textContent}`.toUpperCase();
            return token.includes(key) || (target && token.includes(target.name.toUpperCase()));
        });
        if (originalButton) {
            originalButton.click();
            return;
        }
        for (const method of ['equipWeapon', 'switchWeapon', 'selectWeapon']) {
            if (typeof window[method] === 'function') {
                window[method](key);
                return;
            }
        }
        if (typeof player === 'undefined' || !target) return;
        if (typeof weaponStates !== 'undefined' && weaponStates) {
            weaponStates[player.currentWeaponKey] = {
                ...(weaponStates[player.currentWeaponKey] || {}),
                ammo: player.ammo,
                maxAmmo: player.maxAmmo,
                reserveAmmo: player.reserveAmmo
            };
            const next = weaponStates[key] || {};
            player.currentWeaponKey = key;
            player.maxAmmo = target.maxAmmo;
            player.ammo = Number.isFinite(next.ammo) ? next.ammo : target.maxAmmo;
            player.reserveAmmo = Number.isFinite(next.reserveAmmo) ? next.reserveAmmo : 0;
            player.isReloading = false;
            weaponStates[key] = { ...next, ammo: player.ammo, maxAmmo: player.maxAmmo, reserveAmmo: player.reserveAmmo };
        } else {
            player.currentWeaponKey = key;
            player.maxAmmo = target.maxAmmo;
            player.ammo = target.maxAmmo;
        }
        if (typeof buildWeaponMesh === 'function') buildWeaponMesh();
        syncActiveAmmoHud();
        if (typeof saveGameProgress === 'function') saveGameProgress(false);
    }

    function makeWeaponCard(key, gear) {
        const definition = WEAPONS[key];
        const ammo = ammoFor(key);
        const card = document.createElement('article');
        card.className = `owned-weapon-card${player?.currentWeaponKey === key ? ' is-equipped' : ''}`;
        const icon = document.createElement('span');
        icon.className = 'owned-weapon-icon';
        icon.setAttribute('aria-label', `${definition.name} weapon icon`);
        const weaponSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        weaponSvg.setAttribute('viewBox', '0 0 24 24');
        weaponSvg.setAttribute('aria-hidden', 'true');
        weaponSvg.setAttribute('focusable', 'false');
        weaponSvg.innerHTML = '<path fill="currentColor" d="M2 8h13l2-2h5v6h-5l-2-2H2V8Zm4 3h5l2 2-1 2H9l-1 5H5l1-7-2-1 2-1Zm13-3h2v2h-2V8Z"/>';
        icon.appendChild(weaponSvg);

        const copy = document.createElement('span');
        copy.className = 'owned-weapon-copy';
        const name = document.createElement('strong');
        name.textContent = definition.name;
        const ammoLine = document.createElement('small');
        ammoLine.textContent = `AMMO  ${ammo.loaded} / ${ammo.reserve} reserve`;
        copy.append(name, ammoLine);

        const equip = document.createElement('button');
        equip.type = 'button';
        equip.className = 'owned-weapon-equip';
        equip.textContent = player?.currentWeaponKey === key ? 'EQUIPPED' : 'EQUIP';
        equip.disabled = player?.currentWeaponKey === key;
        equip.addEventListener('click', () => equipWeapon(key));
        card.append(icon, copy, equip);

        const slot = document.createElement('div');
        slot.className = 'loadout-slot';
        const label = document.createElement('label');
        label.textContent = 'GEAR SLOT';
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Purchased gear fitted to ${definition.name}`);
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Empty — select owned gear';
        select.appendChild(empty);
        gear.filter(item => gearFits(item, key)).forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} · owned`;
            select.appendChild(option);
        });
        select.value = fittedItems[key] || '';
        select.addEventListener('change', () => {
            fittedItems[key] = select.value;
            persistFittedItems();
        });
        slot.append(label, select);
        card.appendChild(slot);
        return card;
    }

    function refreshInventory() {
        if (typeof WEAPONS === 'undefined') return;
        if (fittedStorageKey !== fittedKey()) loadFittedItems();
        const keys = ownedWeaponKeys();
        const gear = allOwnedGear();
        const fragment = document.createDocumentFragment();
        if (!keys.length) {
            const empty = document.createElement('p');
            empty.className = 'inventory-empty';
            empty.textContent = 'No weapons owned yet. Visit the weapon store to add one.';
            fragment.appendChild(empty);
        } else {
            keys.forEach(key => fragment.appendChild(makeWeaponCard(key, gear)));
        }
        inventory.replaceChildren(fragment);
    }

    function syncActiveAmmoHud() {
        if (typeof player === 'undefined') return;
        const current = Math.max(0, Number(player.ammo) || 0);
        const capacity = Math.max(1, Number(player.maxAmmo) || 1);
        const reserve = Math.max(0, Number(player.reserveAmmo) || 0);
        if (byId('ammoCurrent')) byId('ammoCurrent').textContent = String(current);
        if (byId('ammoReserve')) byId('ammoReserve').textContent = String(reserve);
        if (byId('ammoBarText')) byId('ammoBarText').textContent = `${current} / ${capacity}`;
        if (byId('ammoBarFill')) byId('ammoBarFill').style.width = `${Math.min(100, current / capacity * 100)}%`;
        if (byId('weaponName') && WEAPONS[player.currentWeaponKey]) byId('weaponName').textContent = WEAPONS[player.currentWeaponKey].name;
        if (typeof updateAmmoUI === 'function') updateAmmoUI();
    }

    function addReserveForEveryOwnedWeapon(amount) {
        const keys = ownedWeaponKeys();
        if (typeof player === 'undefined') return;
        const currentKey = player.currentWeaponKey;
        keys.forEach(key => {
            if (key === currentKey) {
                player.reserveAmmo = (Number(player.reserveAmmo) || 0) + amount;
                if (typeof weaponStates !== 'undefined' && weaponStates) {
                    weaponStates[key] = { ...(weaponStates[key] || {}), ammo: player.ammo, maxAmmo: player.maxAmmo, reserveAmmo: player.reserveAmmo };
                }
                return;
            }
            if (typeof weaponStates === 'undefined' || !weaponStates) return;
            const state = weaponStates[key] || { ammo: WEAPONS[key].maxAmmo, maxAmmo: WEAPONS[key].maxAmmo, reserveAmmo: 0 };
            state.reserveAmmo = (Number(state.reserveAmmo) || 0) + amount;
            weaponStates[key] = state;
        });
        if (typeof saveGameProgress === 'function') saveGameProgress(false);
        syncActiveAmmoHud();
        refreshInventory();
    }

    // Replace the original single-weapon purchase with a universal compatible reserve pack.
    ammoButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof points !== 'number' || points < 100) {
            const feedback = byId('opticStoreFeedback');
            if (feedback) feedback.textContent = 'You need 100 points to buy ammunition.';
            return;
        }
        points -= 100;
        const pointDisplay = byId('pointsDisplay');
        const storePoints = byId('storePoints');
        if (pointDisplay) pointDisplay.textContent = points;
        if (storePoints) storePoints.textContent = points;
        addReserveForEveryOwnedWeapon(60);
        const feedback = byId('opticStoreFeedback');
        if (feedback) feedback.textContent = '+60 reserve rounds added for every owned weapon.';
    }, true);

    const inventoryObserver = new MutationObserver(refreshInventory);
    ['inventoryList', 'addonStoreGrid', 'storeList'].forEach(id => {
        const element = byId(id);
        if (element) inventoryObserver.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    });
    window.setInterval(() => {
        if (!byId('equipmentScreen')?.classList.contains('hidden')) refreshInventory();
    }, 600);
    window.addEventListener('storage', event => {
        if (event.key === fittedKey()) {
            try { fittedItems = JSON.parse(event.newValue || '{}') || {}; } catch (error) { fittedItems = {}; }
            refreshInventory();
        }
    });
    refreshInventory();
})();
