const STORAGE_KEY = 'china-level-city-records-v1';
const COLORS = ['#ffffff', '#6495ed', '#00e49a', '#ffd700', '#cd5c5c'];
const LEVEL_NAMES = ['没去过', '途经/停留', '玩过（1–3天）', '旅居（3–30天）', '居住（30天以上）'];
const DIRECT_REGIONS = new Set(['北京', '天津', '上海', '重庆', '香港', '澳门']);

const provinceCodeMap = {
    北京: '110000', 天津: '120000', 河北: '130000', 山西: '140000', 内蒙古: '150000',
    辽宁: '210000', 吉林: '220000', 黑龙江: '230000', 上海: '310000', 江苏: '320000',
    浙江: '330000', 安徽: '340000', 福建: '350000', 江西: '360000', 山东: '370000',
    河南: '410000', 湖北: '420000', 湖南: '430000', 广东: '440000', 广西: '450000',
    海南: '460000', 重庆: '500000', 四川: '510000', 贵州: '520000', 云南: '530000',
    西藏: '540000', 陕西: '610000', 甘肃: '620000', 青海: '630000', 宁夏: '640000',
    新疆: '650000', 台湾: '710000', 香港: '810000', 澳门: '820000'
};

const provinceFullNames = {
    北京: '北京市', 天津: '天津市', 河北: '河北省', 山西: '山西省', 内蒙古: '内蒙古自治区',
    辽宁: '辽宁省', 吉林: '吉林省', 黑龙江: '黑龙江省', 上海: '上海市', 江苏: '江苏省',
    浙江: '浙江省', 安徽: '安徽省', 福建: '福建省', 江西: '江西省', 山东: '山东省',
    河南: '河南省', 湖北: '湖北省', 湖南: '湖南省', 广东: '广东省', 广西: '广西壮族自治区',
    海南: '海南省', 重庆: '重庆市', 四川: '四川省', 贵州: '贵州省', 云南: '云南省',
    西藏: '西藏自治区', 陕西: '陕西省', 甘肃: '甘肃省', 青海: '青海省', 宁夏: '宁夏回族自治区',
    新疆: '新疆维吾尔自治区', 台湾: '台湾省', 香港: '香港特别行政区', 澳门: '澳门特别行政区'
};

const provinceShortNames = Object.fromEntries(
    Object.entries(provinceFullNames).map(([shortName, fullName]) => [fullName, shortName])
);
const mapCache = new Map();
const appState = {
    currentLevel: 'china',
    currentSelectedRegion: null,
    data: loadRecords()
};

let chart = null;
let mapRequest = 0;
let previousFocus = null;
let toastTimer = null;
let resizeFrame = null;
let ignoreMapClickUntil = 0;
let pendingClear = null;

function loadRecords() {
    const records = Object.create(null);
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return records;

        for (const [province, cities] of Object.entries(saved)) {
            if (!Object.prototype.hasOwnProperty.call(provinceCodeMap, province) ||
                !cities || typeof cities !== 'object' || Array.isArray(cities)) continue;

            const validCities = Object.create(null);
            for (const [city, level] of Object.entries(cities)) {
                if (city && Number.isInteger(level) && level >= 1 && level <= 4) {
                    validCities[city] = level;
                }
            }
            if (Object.keys(validCities).length) records[province] = validCities;
        }
    } catch (error) {
        console.warn('读取本地足迹记录失败:', error);
    }
    return records;
}

function saveRecords() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.data));
        return true;
    } catch (error) {
        console.warn('保存本地足迹记录失败:', error);
        showToast('无法保存到浏览器，刷新页面后记录可能丢失。');
        return false;
    }
}

function getProvinceMaxLevel(province) {
    return Math.max(0, ...Object.values(appState.data[province] || {}));
}

function getProvinceTotal(province) {
    return Object.values(appState.data[province] || {}).reduce((sum, level) => sum + level, 0);
}

function updateLevelDisplay() {
    const isChina = appState.currentLevel === 'china';
    const total = isChina
        ? Object.keys(appState.data).reduce((sum, province) => sum + getProvinceTotal(province), 0)
        : getProvinceTotal(appState.currentLevel);
    document.getElementById('score-label').textContent = isChina ? '全国总分' : `${appState.currentLevel}总分`;
    document.getElementById('level-display').textContent = total;
    updateClearButton();
}

function updateClearButton() {
    const button = document.getElementById('clear-btn');
    const isChina = appState.currentLevel === 'china';
    button.textContent = isChina ? '清空全部' : `清空${appState.currentLevel}`;
    button.setAttribute('aria-label', isChina ? '清空全部足迹记录' : `清空${appState.currentLevel}的足迹记录`);
    const hasRecords = isChina ? Object.keys(appState.data).length > 0 : getProvinceTotal(appState.currentLevel) > 0;
    button.disabled = !hasRecords || !document.getElementById('map-status').hidden;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function showMapStatus(message, isError = false) {
    const status = document.getElementById('map-status');
    document.getElementById('map-status-text').textContent = message;
    status.querySelector('.loading-indicator').hidden = isError;
    document.getElementById('retry-btn').hidden = !isError;
    status.hidden = false;
    updateClearButton();
}

function hideMapStatus() {
    document.getElementById('map-status').hidden = true;
    updateClearButton();
}

async function fetchMap(url) {
    if (mapCache.has(url)) return mapCache.get(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const geoJSON = await response.json();
    if (!Array.isArray(geoJSON.features)) throw new Error('无效的地图数据');
    mapCache.set(url, geoJSON);
    return geoJSON;
}

function populateRegionSelect(geoJSON, isChina) {
    const select = document.getElementById('region-select');
    const placeholder = isChina ? '按名称选择省份或地区' : '按名称选择城市';
    select.replaceChildren(new Option(placeholder, ''));

    const names = new Set();
    for (const feature of geoJSON.features) {
        const fullName = feature.properties && feature.properties.name;
        const name = isChina ? provinceShortNames[fullName] : fullName;
        if (!name || names.has(name)) continue;
        names.add(name);
        select.add(new Option(name, name));
    }
    select.disabled = false;
    document.getElementById('region-select-label').textContent = placeholder;
}

function mapData() {
    if (appState.currentLevel === 'china') {
        return Object.keys(appState.data).map(name => ({ name, value: getProvinceMaxLevel(name) }));
    }
    return Object.entries(appState.data[appState.currentLevel] || {}).map(([name, value]) => ({ name, value }));
}

function isCompact() {
    return window.matchMedia('(max-width: 600px)').matches;
}

function createMapOption(mapName, title, isChina) {
    return {
        animation: false,
        title: {
            text: title,
            left: 'center',
            top: 13,
            textStyle: { color: '#526f7e', fontSize: isCompact() ? 13 : 15, fontWeight: 500 }
        },
        tooltip: {
            trigger: 'item',
            formatter(params) {
                const level = isChina
                    ? getProvinceMaxLevel(params.name)
                    : (appState.data[appState.currentLevel]?.[params.name] || 0);
                return `${params.name}<br/>${LEVEL_NAMES[level]}`;
            }
        },
        visualMap: {
            show: false,
            type: 'piecewise',
            pieces: COLORS.map((color, value) => ({ value, color }))
        },
        series: [{
            name: mapName,
            type: 'map',
            map: mapName,
            nameMap: isChina ? provinceShortNames : undefined,
            roam: window.matchMedia('(pointer: coarse)').matches ? 'scale' : true,
            scaleLimit: { min: 1, max: 8 },
            selectedMode: false,
            layoutCenter: ['50%', '52%'],
            layoutSize: '95%',
            zoom: 1,
            itemStyle: { areaColor: COLORS[0], borderColor: '#a9bdc4', borderWidth: 0.8 },
            label: { show: true, color: '#435d6a', fontSize: isCompact() ? 9 : 11 },
            labelLayout: { hideOverlap: true },
            emphasis: { label: { show: true }, itemStyle: { areaColor: '#ffd6e8' } },
            data: mapData()
        }]
    };
}

async function loadChinaMap() {
    const request = ++mapRequest;
    showMapStatus('正在加载全国地图…');
    document.getElementById('region-select').disabled = true;
    try {
        const geoJSON = await fetchMap('./map/china_full.json');
        if (request !== mapRequest) return;
        echarts.registerMap('china', geoJSON);
        showChinaMap(geoJSON);
        hideMapStatus();
    } catch (error) {
        if (request !== mapRequest) return;
        console.error('加载全国地图失败:', error);
        const message = location.protocol === 'file:'
            ? '直接打开本地文件会阻止地图加载，请通过本地网页服务器打开本页面。'
            : '地图加载失败，请检查网络或地图文件后重试。';
        showMapStatus(message, true);
    }
}

function showChinaMap(geoJSON) {
    appState.currentLevel = 'china';
    hideLevelMenu();
    chart.setOption(createMapOption('china', '全国足迹地图', true), true);
    document.getElementById('map-heading').textContent = '全国地图';
    document.getElementById('map-instructions').textContent = '点击省份，或按名称选择地区';
    document.getElementById('back-btn').hidden = true;
    populateRegionSelect(geoJSON, true);
    updateLevelDisplay();
}

async function loadProvinceMap(shortName) {
    const code = provinceCodeMap[shortName];
    if (!code) return;
    const request = ++mapRequest;
    const select = document.getElementById('region-select');
    select.disabled = true;
    showMapStatus(`正在加载${shortName}地图…`);

    try {
        const geoJSON = await fetchMap(`./map/${code}_full.json`);
        if (request !== mapRequest) return;
        const fullName = provinceFullNames[shortName];
        echarts.registerMap(fullName, geoJSON);
        appState.currentLevel = shortName;
        chart.setOption(createMapOption(fullName, `${fullName}足迹地图`, false), true);
        document.getElementById('map-heading').textContent = fullName;
        document.getElementById('map-instructions').textContent = '点击城市，或按名称选择城市';
        document.getElementById('back-btn').hidden = false;
        populateRegionSelect(geoJSON, false);
        updateLevelDisplay();
        hideMapStatus();
    } catch (error) {
        if (request !== mapRequest) return;
        console.error('加载省级地图失败:', error);
        select.disabled = false;
        hideMapStatus();
        showToast(`${shortName}地图加载失败，请稍后重试。`);
    }
}

function selectRegion(name) {
    if (!name) return;
    if (appState.currentLevel === 'china') {
        if (DIRECT_REGIONS.has(name)) showLevelMenu(name, name);
        else loadProvinceMap(name);
    } else {
        showLevelMenu(name, appState.currentLevel);
    }
}

function showLevelMenu(regionName, province) {
    appState.currentSelectedRegion = { name: regionName, province };
    previousFocus = document.activeElement;
    document.getElementById('selected-region').textContent = `当前地区：${regionName}`;
    const currentLevel = appState.data[province]?.[regionName] || 0;
    document.querySelectorAll('.level-option').forEach(option => {
        option.setAttribute('aria-pressed', String(Number(option.dataset.level) === currentLevel));
    });
    document.getElementById('level-overlay').hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById('level-menu').focus();
}

function hideLevelMenu() {
    const overlay = document.getElementById('level-overlay');
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    appState.currentSelectedRegion = null;
    if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
}

function updateRegionLevel(level) {
    if (!appState.currentSelectedRegion || !Number.isInteger(level) || level < 0 || level > 4) return;
    const { name, province } = appState.currentSelectedRegion;
    if (pendingClear) pendingClear.edited.add(`${province}\u0000${name}`);
    if (level === 0) {
        if (appState.data[province]) {
            delete appState.data[province][name];
            if (!Object.keys(appState.data[province]).length) delete appState.data[province];
        }
    } else {
        if (!appState.data[province]) appState.data[province] = Object.create(null);
        appState.data[province][name] = level;
    }
    chart.setOption({ series: [{ data: mapData() }] });
    updateLevelDisplay();
    hideLevelMenu();
    saveRecords();
}

function clearCurrentRecords() {
    const province = appState.currentLevel;
    const isChina = province === 'china';
    if (isChina ? !Object.keys(appState.data).length : !appState.data[province]) return;

    const records = isChina ? appState.data : { [province]: appState.data[province] };
    pendingClear = { records, edited: new Set() };
    if (isChina) appState.data = Object.create(null);
    else delete appState.data[province];

    chart.setOption({ series: [{ data: mapData() }] });
    updateLevelDisplay();
    saveRecords();
    document.getElementById('clear-message').textContent = isChina ? '已清空全国足迹' : `已清空${province}足迹`;
    const feedback = document.getElementById('clear-feedback');
    feedback.hidden = false;
    feedback.scrollIntoView({ block: 'nearest' });
}

function undoClear() {
    if (!pendingClear) return;
    for (const [province, cities] of Object.entries(pendingClear.records)) {
        for (const [city, level] of Object.entries(cities)) {
            if (pendingClear.edited.has(`${province}\u0000${city}`)) continue;
            if (!appState.data[province]) appState.data[province] = Object.create(null);
            appState.data[province][city] = level;
        }
    }
    pendingClear = null;
    document.getElementById('clear-feedback').hidden = true;
    chart.setOption({ series: [{ data: mapData() }] });
    updateLevelDisplay();
    if (saveRecords()) showToast('已撤销清空');
}

function imageDataURL() {
    if (!chart || !document.getElementById('map-status').hidden) {
        showToast('地图尚未加载完成，请稍后再试。');
        return null;
    }
    return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
}

function changeMapZoom(factor) {
    if (!chart || !document.getElementById('map-status').hidden) return;
    chart.dispatchAction({
        type: 'geoRoam',
        seriesIndex: 0,
        zoom: factor,
        originX: chart.getWidth() / 2,
        originY: chart.getHeight() / 2
    });
}

function resetMapView() {
    if (!chart || !document.getElementById('map-status').hidden) return;
    const isChina = appState.currentLevel === 'china';
    const mapName = isChina ? 'china' : provinceFullNames[appState.currentLevel];
    const title = isChina ? '全国足迹地图' : `${mapName}足迹地图`;
    chart.setOption(createMapOption(mapName, title, isChina), true);
}

function setupTouchGestures(mapElement) {
    let gesture = null;

    function measure(touches) {
        const first = touches[0];
        const second = touches[1];
        return {
            x: (first.clientX + second.clientX) / 2,
            y: (first.clientY + second.clientY) / 2,
            distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
        };
    }

    mapElement.addEventListener('touchstart', event => {
        if (event.touches.length === 1 && !gesture) {
            ignoreMapClickUntil = 0;
            return;
        }
        if (event.touches.length < 2) return;
        gesture = measure(event.touches);
        event.preventDefault();
        event.stopPropagation();
    }, { capture: true, passive: false });

    mapElement.addEventListener('touchmove', event => {
        if (!gesture || event.touches.length < 2) return;
        event.preventDefault();
        event.stopPropagation();
        const next = measure(event.touches);
        const rect = mapElement.getBoundingClientRect();
        chart.dispatchAction({
            type: 'geoRoam',
            seriesIndex: 0,
            dx: next.x - gesture.x,
            dy: next.y - gesture.y,
            zoom: gesture.distance > 0 ? next.distance / gesture.distance : 1,
            originX: next.x - rect.left,
            originY: next.y - rect.top
        });
        gesture = next;
    }, { capture: true, passive: false });

    function endGesture(event) {
        if (!gesture) return;
        event.preventDefault();
        if (event.touches.length) event.stopPropagation();
        if (event.touches.length < 2) {
            gesture = null;
            ignoreMapClickUntil = Date.now() + 400;
        }
    }
    mapElement.addEventListener('touchend', endGesture, { capture: true, passive: false });
    mapElement.addEventListener('touchcancel', endGesture, { capture: true, passive: false });

    // Some browsers emit a mouse click after ECharts has already opened the menu on touchend.
    // Cancel that compatibility click so it cannot hit the new overlay or one of its buttons.
    mapElement.addEventListener('touchend', event => {
        if (!document.getElementById('level-overlay').hidden) event.preventDefault();
    }, { passive: false });
}

function saveImage() {
    const dataURL = imageDataURL();
    if (!dataURL) return;
    const link = document.createElement('a');
    link.download = '中国足迹地图.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function shareImage() {
    const dataURL = imageDataURL();
    if (!dataURL) return;
    try {
        const bytes = atob(dataURL.split(',')[1]);
        const array = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
        const file = new File([array], '中国足迹地图.png', { type: 'image/png' });
        const shareData = { title: '我的中国足迹地图', files: [file] };
        if (!navigator.share || !navigator.canShare || !navigator.canShare(shareData)) {
            showToast('当前浏览器不支持直接分享图片，请先保存图片再分享。');
            return;
        }
        navigator.share(shareData).catch(error => {
            if (error.name !== 'AbortError') showToast('分享未完成，请先保存图片再分享。');
        });
    } catch (error) {
        console.warn('分享图片失败:', error);
        showToast('当前浏览器不支持直接分享图片，请先保存图片再分享。');
    }
}

function handleModalKeydown(event) {
    if (document.getElementById('level-overlay').hidden) return;
    if (event.key === 'Escape') {
        hideLevelMenu();
        return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...document.querySelectorAll('#level-menu button')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement.id === 'level-menu')) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-menu-btn').addEventListener('click', hideLevelMenu);
    document.getElementById('level-overlay').addEventListener('click', event => {
        if (event.target.id === 'level-overlay') hideLevelMenu();
    });
    document.addEventListener('keydown', handleModalKeydown);
    document.querySelectorAll('.level-option').forEach(option => {
        option.addEventListener('click', () => updateRegionLevel(Number(option.dataset.level)));
    });
    document.getElementById('region-select').addEventListener('change', event => {
        const name = event.target.value;
        event.target.value = '';
        selectRegion(name);
    });
    document.getElementById('back-btn').addEventListener('click', () => {
        ++mapRequest;
        hideMapStatus();
        showChinaMap(mapCache.get('./map/china_full.json'));
    });
    document.getElementById('save-btn').addEventListener('click', saveImage);
    document.getElementById('share-btn').addEventListener('click', shareImage);
    document.getElementById('clear-btn').addEventListener('click', clearCurrentRecords);
    document.getElementById('undo-clear-btn').addEventListener('click', undoClear);
    document.getElementById('zoom-in-btn').addEventListener('click', () => changeMapZoom(1.4));
    document.getElementById('zoom-out-btn').addEventListener('click', () => changeMapZoom(1 / 1.4));
    document.getElementById('reset-map-btn').addEventListener('click', resetMapView);
    document.getElementById('retry-btn').addEventListener('click', () => {
        if (!window.echarts) location.reload();
        else loadChinaMap();
    });

    updateLevelDisplay();
    if (!window.echarts) {
        showMapStatus('地图组件加载失败，请检查网络后重新加载页面。', true);
        return;
    }
    const mapElement = document.getElementById('map');
    chart = echarts.init(mapElement);
    setupTouchGestures(mapElement);
    chart.on('click', params => {
        if (Date.now() >= ignoreMapClickUntil && params.componentType === 'series' && params.seriesType === 'map') selectRegion(params.name);
    });
    loadChinaMap();

    window.addEventListener('resize', () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            chart.resize();
            chart.setOption({
                title: { textStyle: { fontSize: isCompact() ? 13 : 15 } },
                series: [{ label: { fontSize: isCompact() ? 9 : 11 } }]
            });
        });
    });
});
