// 应用状态
const appState = {
    currentLevel: 'china',
    currentProvince: null,
    data: {},
    colors: ['White', 'CornflowerBlue', 'SpringGreen', 'Gold', 'IndianRed'],
    levelNames: ['没去过', '途经/停留', '玩过（1-3天）', '旅居（3-30天）', '居住（30天以上）'],
    currentSelectedRegion: null
};
const HOVER_COLOR = '#ffd6e8';

// 省份中心坐标
const provinceCenters = {
    '北京市': [116.4, 40],
    '天津市': [117.2, 39.1],
    '河北省': [114.5, 38],
    '山西省': [112.5, 37.5],
    '内蒙古自治区': [110, 42],
    '辽宁省': [123.4, 41.8],
    '吉林省': [125.3, 43.9],
    '黑龙江省': [128, 47],
    '上海市': [121.5, 31.2],
    '江苏省': [119.5, 32],
    '浙江省': [120.2, 30.3],
    '安徽省': [117.3, 31.8],
    '福建省': [118.1, 26.1],
    '江西省': [115.9, 28.7],
    '山东省': [118.1, 36.7],
    '河南省': [113.7, 34.8],
    '湖北省': [112.3, 30.6],
    '湖南省': [112.9, 28.2],
    '广东省': [113.3, 23.1],
    '广西壮族自治区': [108.3, 22.8],
    '海南省': [110.3, 20],
    '重庆市': [106.5, 29.6],
    '四川省': [102.7, 30.6],
    '贵州省': [106.7, 26.6],
    '云南省': [102.7, 25.1],
    '西藏自治区': [88.9, 29.6],
    '陕西省': [108.9, 34.3],
    '甘肃省': [103.7, 36.1],
    '青海省': [96, 35.6],
    '宁夏回族自治区': [106.3, 38.5],
    '新疆维吾尔自治区': [87.6, 43.8],
    '香港特别行政区': [114.2, 22.3],
    '澳门特别行政区': [113.5, 22.2],
    '台湾省': [121, 23.5]
};

// 省份代码映射 - 修复台湾省映射
const provinceCodeMap = {
    "北京": "110000",
    "天津": "120000",
    "河北": "130000",
    "山西": "140000",
    "内蒙古": "150000",
    "辽宁": "210000",
    "吉林": "220000",
    "黑龙江": "230000",
    "上海": "310000",
    "江苏": "320000",
    "浙江": "330000",
    "安徽": "340000",
    "福建": "350000",
    "江西": "360000",
    "山东": "370000",
    "河南": "410000",
    "湖北": "420000",
    "湖南": "430000",
    "广东": "440000",
    "广西": "450000",
    "海南": "460000",
    "重庆": "500000",
    "四川": "510000",
    "贵州": "520000",
    "云南": "530000",
    "西藏": "540000",
    "陕西": "610000",
    "甘肃": "620000",
    "青海": "630000",
    "宁夏": "640000",
    "新疆": "650000",
    "香港": "810000",
    "澳门": "820000",
    "台湾": "710000",
    "台湾省": "710000"  // 添加台湾省的映射
};

// 省份全称映射
const provinceFullNames = {
    '北京': '北京市',
    '天津': '天津市',
    '河北': '河北省',
    '山西': '山西省',
    '内蒙古': '内蒙古自治区',
    '辽宁': '辽宁省',
    '吉林': '吉林省',
    '黑龙江': '黑龙江省',
    '上海': '上海市',
    '江苏': '江苏省',
    '浙江': '浙江省',
    '安徽': '安徽省',
    '福建': '福建省',
    '江西': '江西省',
    '山东': '山东省',
    '河南': '河南省',
    '湖北': '湖北省',
    '湖南': '湖南省',
    '广东': '广东省',
    '广西': '广西壮族自治区',
    '海南': '海南省',
    '重庆': '重庆市',
    '四川': '四川省',
    '贵州': '贵州省',
    '云南': '云南省',
    '西藏': '西藏自治区',
    '陕西': '陕西省',
    '甘肃': '甘肃省',
    '青海': '青海省',
    '宁夏': '宁夏回族自治区',
    '新疆': '新疆维吾尔自治区',
    '香港': '香港特别行政区',
    '澳门': '澳门特别行政区',
    '台湾': '台湾省',
    '台湾省': '台湾省'  // 添加台湾省的映射
};

// 标签偏移配置
const labelOffsets = {
    '北京市': { dx: -10, dy: -10 },
    '天津市': { dx: 18, dy: -6 },
    '河北省': { dx: 0, dy: 12 },
    '广东省': { dx: -12, dy: 0 },
    '香港特别行政区': { dx: 14, dy: 12 },
    '澳门特别行政区': { dx: 14, dy: -10 }
};

let chart = null;
let clickOutsideHandler = null; // 用于存储点击外部的事件处理器

// 计算省份最高等级
function getProvinceMaxLevel(provinceName) {
    const cities = appState.data[provinceName] || {};
    let maxLevel = 0;
    Object.values(cities).forEach(lvl => {
        if (lvl > maxLevel) maxLevel = lvl;
    });
    return maxLevel;
}

// 计算省份总分
function getProvinceTotal(provinceName) {
    const cities = appState.data[provinceName] || {};
    return Object.values(cities).reduce((sum, lvl) => sum + (lvl || 0), 0);
}

// 获取等级对应颜色
function getColor(level) {
    return appState.colors[level] || appState.colors[0];
}

// 创建视觉映射配置
function createVisualMap() {
    return {
        show: false,
        type: 'piecewise',
        pieces: [
            {min: 4, label: '居住（30天以上）', color: appState.colors[4]},
            {min: 3, max: 3.9, label: '旅居（3-30天）', color: appState.colors[3]},
            {min: 2, max: 2.9, label: '玩过（1-3天）', color: appState.colors[2]},
            {min: 1, max: 1.9, label: '途经/停留', color: appState.colors[1]},
            {min: 0, max: 0.9, label: '没去过', color: appState.colors[0]}
        ],
        left: 'left',
        top: 'bottom',
        textStyle: { color: '#000' }
    };
}

// 加载中国地图 - 修改为从本地map文件夹读取
function loadChinaMap() {
    fetch('./map/china_full.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(geoJSON => {
            echarts.registerMap('china', geoJSON);
            initChinaMap();
        })
        .catch(error => {
            console.error('加载中国地图失败:', error);
            alert('加载中国地图失败，请检查map文件夹中是否有china_full.json文件');
        });
}

// 初始化中国地图
function initChinaMap() {
    if (!chart) chart = echarts.init(document.getElementById('map'));

    const option = {
        title: {
            text: '中国地图 - 点击省份查看市级地图',
            left: 'center',
            textStyle: { fontSize: 18 }
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const level = getProvinceMaxLevel(params.name);
                return `${params.name}<br/>${appState.levelNames[level]}<br/><small>点击查看市级地图或选择等级</small>`;
            }
        },
        visualMap: createVisualMap(),
        series: [{
            name: '中国',
            type: 'map',
            map: 'china',
            roam: true,
            selectedMode: false,
            select: { disabled: true },
            center: null,
            zoom: 1.2,
            label: { show: true },
            labelLayout: function(params) {
                const offset = labelOffsets[params.name] || {};
                return { hideOverlap: true, ...offset };
            },
            emphasis: {
                label: { show: true },
                itemStyle: { areaColor: HOVER_COLOR }
            },
            data: Object.keys(appState.data).map(name => {
                const level = getProvinceMaxLevel(name);
                const color = getColor(level);
                return { name, value: level, itemStyle: { areaColor: color, color } };
            }),
            nameMap: {
                '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
                '河北省': '河北', '山西省': '山西', '内蒙古自治区': '内蒙古', '辽宁省': '辽宁',
                '吉林省': '吉林', '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江',
                '安徽省': '安徽', '福建省': '福建', '江西省': '江西', '山东省': '山东',
                '河南省': '河南', '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东',
                '广西壮族自治区': '广西', '海南省': '海南', '四川省': '四川', '贵州省': '贵州',
                '云南省': '云南', '新疆维吾尔自治区': '新疆', '西藏自治区': '西藏', '陕西省': '陕西',
                '甘肃省': '甘肃', '青海省': '青海', '宁夏回族自治区': '宁夏', '香港特别行政区': '香港',
                '澳门特别行政区': '澳门', '台湾省': '台湾'  // 修正台湾省显示为"台湾"
            }
        }]
    };
    
    chart.setOption(option, true);
    updateLevelDisplay();
    
    chart.off('click');
    chart.on('click', handleMapClick);
}

// 处理地图点击事件
function handleMapClick(params) {
    if (params.componentType !== 'series' || params.seriesType !== 'map') return;
    
    const regionName = params.name;
    
    if (appState.currentLevel === 'china') {
        const municipalCities = ['北京', '天津', '上海', '重庆'];
        const specialRegions = ['香港', '澳门'];
        const nodrillRegions = [...municipalCities, ...specialRegions];
        
        if (nodrillRegions.includes(regionName)) {
            showLevelMenu(regionName, regionName);
        } else {
            // 处理台湾省点击 - 统一使用"台湾"作为参数
            const provinceName = regionName === '台湾' ? '台湾省' : regionName;
            loadProvinceMap(provinceName);
        }
    } else {
        showLevelMenu(regionName, appState.currentLevel);
    }
}

// 显示等级选择菜单
function showLevelMenu(regionName, regionType) {
    appState.currentSelectedRegion = { name: regionName, type: regionType };
    
    const menu = document.getElementById('level-menu');
    const selectedRegion = document.getElementById('selected-region');
    
    selectedRegion.textContent = `当前选择: ${regionName}`;
    menu.style.display = 'block';
    
    // 添加点击外部关闭菜单的事件监听
    setupClickOutsideHandler(menu);
    
    document.querySelectorAll('.level-option').forEach(option => {
        option.onclick = function() {
            const level = parseInt(this.getAttribute('data-level'));
            updateRegionLevel(level);
            // 选择等级后移除点击外部的事件监听
            removeClickOutsideHandler();
        };
    });
}

// 设置点击外部关闭菜单的事件监听
function setupClickOutsideHandler(menuElement) {
    // 移除之前的事件监听（如果有）
    removeClickOutsideHandler();
    
    // 创建新的事件处理器
    clickOutsideHandler = function(event) {
        // 如果点击的不是菜单本身或其子元素
        if (!menuElement.contains(event.target)) {
            hideLevelMenu();
        }
    };
    
    // 添加事件监听（使用捕获阶段确保在其他点击事件之前处理）
    document.addEventListener('click', clickOutsideHandler, true);
}

// 移除点击外部的事件监听
function removeClickOutsideHandler() {
    if (clickOutsideHandler) {
        document.removeEventListener('click', clickOutsideHandler, true);
        clickOutsideHandler = null;
    }
}

// 隐藏等级选择菜单
function hideLevelMenu() {
    const menu = document.getElementById('level-menu');
    menu.style.display = 'none';
    
    // 移除点击外部的事件监听
    removeClickOutsideHandler();
}

// 更新区域等级
function updateRegionLevel(level) {
    if (!appState.currentSelectedRegion) return;
    
    const { name, type } = appState.currentSelectedRegion;
    
    if (!appState.data[type]) appState.data[type] = {};
    appState.data[type][name] = level;
    
    updateMapColor();
    hideLevelMenu();
    updateLevelDisplay();
}

// 更新地图颜色
function updateMapColor() {
    if (!chart) return;
    
    const currentLevel = appState.currentLevel;
    
    if (currentLevel === 'china') {
        const provinceData = Object.keys(appState.data).map(name => {
            const level = getProvinceMaxLevel(name);
            const color = getColor(level);
            return { name, value: level, itemStyle: { areaColor: color, color } };
        });
        
        chart.setOption({ series: [{ data: provinceData }] });
        updateLevelDisplay();
        return;
    }
    
    const regionData = appState.data[currentLevel] || {};
    const cityData = Object.keys(regionData).map(name => {
        const level = regionData[name] ?? 0;
        const color = getColor(level);
        return { name, value: level, itemStyle: { areaColor: color, color } };
    });
    
    chart.setOption({ series: [{ data: cityData }] });
    updateLevelDisplay();
}

// 更新等级显示
function updateLevelDisplay() {
    const display = document.getElementById('level-display');
    
    if (appState.currentLevel === 'china') {
        const nationalTotal = Object.keys(appState.data).reduce(
            (sum, name) => sum + getProvinceTotal(name), 0
        );
        display.textContent = `全国总分：${nationalTotal}`;
        return;
    }
    
    const provinceTotal = getProvinceTotal(appState.currentLevel);
    display.textContent = `${appState.currentLevel}总分：${provinceTotal}`;
}

// 加载省份地图 - 修改为从本地map文件夹读取
function loadProvinceMap(provinceName) {
    // 统一处理省份名称
    let shortName = provinceName;
    
    // 如果传入的是"台湾省"，转换为"台湾"
    if (provinceName === '台湾省') {
        shortName = '台湾';
    }
    
    const code = provinceCodeMap[shortName];
    if (!code) {
        alert(`未找到 ${provinceName} 的行政区划代码`);
        return;
    }

    // 从本地map文件夹读取省份JSON文件
    const url = `./map/${code}_full.json`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(geoJSON => {
            // 使用映射表获取省份全称
            const fullName = provinceFullNames[shortName] || provinceName;

            try { 
                echarts.registerMap(fullName, geoJSON); 
            } catch (e) { 
                console.warn('注册地图失败', e); 
            }

            appState.currentProvinceShort = shortName;
            appState.currentProvinceFull = fullName;

            if (!appState.data[shortName]) appState.data[shortName] = {};
            showProvinceMap(shortName, fullName);
        })
        .catch(err => {
            console.error('加载省级地图失败：', err);
            alert(`加载 ${provinceName} 地图失败，请检查map文件夹中是否有${code}_full.json文件`);
        });
}

// 显示省份地图
function showProvinceMap(shortName, fullName) {
    fullName = fullName || appState.currentProvinceFull || shortName;
    shortName = shortName || appState.currentProvinceShort || 
                fullName.replace(/(省|市|自治区|特别行政区|壮族自治区|回族自治区|维吾尔自治区)$/, '');

    if (!appState.data[shortName]) appState.data[shortName] = {};

    appState.currentLevel = shortName;
    appState.currentProvince = shortName;

    const center = provinceCenters[shortName] || [105, 38];

    // 使用省份全称作为标题
    const provinceDisplayName = provinceFullNames[shortName] || shortName + '省';

    const option = {
        title: {
            text: `${provinceDisplayName} - 点击城市选择等级`,
            left: 'center',
            textStyle: { fontSize: 18 }
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const level = (appState.data[shortName] && appState.data[shortName][params.name]) || 0;
                return `${params.name}<br/>${appState.levelNames[level]}`;
            }
        },
        visualMap: createVisualMap(),
        series: [{
            name: fullName,
            type: 'map',
            map: fullName,
            roam: true,
            selectedMode: false,
            select: { disabled: true },
            center: null,
            zoom: 1,
            label: { show: true },
            emphasis: {
                label: { show: true },
                itemStyle: { areaColor: HOVER_COLOR }
            },
            data: (Object.keys(appState.data[shortName] || {})).map(name => {
                const level = appState.data[shortName][name] || 0;
                const color = getColor(level);
                return { name, value: level, itemStyle: { areaColor: color, color } };
            })
        }]
    };

    chart.setOption(option, true);
    document.getElementById('back-btn').style.display = 'block';
    
    chart.off('click');
    chart.on('click', handleMapClick);
    updateLevelDisplay();
}

// 返回全国地图
function backToChina() {
    appState.currentLevel = 'china';
    appState.currentProvince = null;
    initChinaMap();
    document.getElementById('back-btn').style.display = 'none';
}

// 保存图片
function saveImage() {
    if (!chart) {
        alert('地图未加载，无法保存');
        return;
    }
    
    const imageData = chart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
    });
    
    const link = document.createElement('a');
    link.download = '制县等级地图.png';
    link.href = imageData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    chart = echarts.init(document.getElementById('map'));
    
    loadChinaMap();
    
    document.getElementById('back-btn').addEventListener('click', backToChina);
    document.getElementById('save-btn').addEventListener('click', saveImage);
    document.getElementById('share-btn').addEventListener('click', function() {
        alert('分享功能开发中');
    });
    
    window.addEventListener('resize', function() {
        if (chart) chart.resize();
    });
});