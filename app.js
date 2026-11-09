const defaultProducts = [
  { id: '1', name: 'Огурец свежий', cal: 15, pro: 0.8, fat: 0.1, carb: 3.0, barcode: '' },
  { id: '2', name: 'Яйцо куриное (вареное)', cal: 155, pro: 13.0, fat: 11.0, carb: 0.7, barcode: '' },
  { id: '3', name: 'Куриное филе (отварное)', cal: 165, pro: 31.0, fat: 3.6, carb: 0.0, barcode: '' },
  { id: '4', name: 'Гречка отварная', cal: 110, pro: 4.2, fat: 1.1, carb: 21.3, barcode: '' }
];

let appState = {
  goals: JSON.parse(localStorage.getItem('barsik_goals')) || { cal: 1800, pro: 110, fat: 60, carb: 200 },
  products: JSON.parse(localStorage.getItem('barsik_products')) || defaultProducts,
  todayLogs: JSON.parse(localStorage.getItem('barsik_today_logs')) || [],
  weightLogs: JSON.parse(localStorage.getItem('barsik_weight_logs')) || [],
  bodyParams: JSON.parse(localStorage.getItem('barsik_body_params')) || { gender: 'female', age: 22, height: 168, weight: 63, act: 1.55 },
  lastMealTime: parseInt(localStorage.getItem('barsik_last_meal_time')) || 0,
  firebaseConfig: JSON.parse(localStorage.getItem('barsik_firebase_config')) || null
};

let currentRecipeIngredients = [];
let db = null;
let codeReader = null;
let isCameraActive = false;

const app = {
  init() {
    this.initPWA();
    this.initFirebase();
    this.populateInputs();
    this.renderGoals();
    this.renderProductsDropdowns();
    this.renderToday();
    this.renderWeightHistory();
    this.updatePetCycle();
    
    setInterval(() => this.updatePetCycle(), 60000);
    document.getElementById('pet-box').addEventListener('click', () => this.petTapInteraction());
  },

  initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  populateInputs() {
    document.getElementById('g-cal').value = appState.goals.cal;
    document.getElementById('g-pro').value = appState.goals.pro;
    document.getElementById('g-fat').value = appState.goals.fat;
    document.getElementById('g-carb').value = appState.goals.carb;

    if (appState.bodyParams) {
      document.getElementById('calc-gender').value = appState.bodyParams.gender || 'female';
      document.getElementById('calc-age').value = appState.bodyParams.age || 22;
      document.getElementById('calc-height').value = appState.bodyParams.height || 168;
      document.getElementById('calc-weight').value = appState.bodyParams.weight || 63;
      document.getElementById('calc-activity').value = appState.bodyParams.act || 1.55;
    }
  },

  switchTab(tabId, btn) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    if (btn) btn.classList.add('active');

    const titles = {
      today: 'Сегодня',
      recipe: 'Конструктор блюд',
      products: 'Продукты и сканер',
      coach: 'Тренер и нормы'
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'Трекер';

    if (tabId !== 'products' && isCameraActive) {
      this.stopCamera();
    }
  },

  updatePetCycle() {
    const now = Date.now();
    const hoursSinceMeal = appState.lastMealTime ? (now - appState.lastMealTime) / (1000 * 60 * 60) : 999;
    
    const body = document.getElementById('barsik-body');
    const eyes = document.getElementById('barsik-eyes');
    const statusText = document.getElementById('pet-status-text');
    const moodIcon = document.getElementById('pet-mood-icon');

    if (hoursSinceMeal > 3.5) {
      body.setAttribute('rx', '27');
      eyes.innerHTML = `
        <ellipse cx="52" cy="46" rx="3.5" ry="4" fill="#2B2A27"/>
        <ellipse cx="68" cy="46" rx="3.5" ry="4" fill="#2B2A27"/>
        <circle cx="53" cy="44" r="1.5" fill="#FFFFFF"/>
        <circle cx="69" cy="44" r="1.5" fill="#FFFFFF"/>
      `;
      statusText.innerText = 'Животик урчит, пора поесть!';
      moodIcon.innerText = '🥺';
    } else {
      body.setAttribute('rx', '42');
      eyes.innerHTML = `
        <path d="M 48,46 Q 52,41 56,46" stroke="#2B2A27" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 64,46 Q 68,41 72,46" stroke="#2B2A27" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `;
      statusText.innerText = 'Сытый и довольный пухляш';
      moodIcon.innerText = '✨';
    }
  },

  petTapInteraction() {
    const paw = document.getElementById('barsik-paw');
    paw.style.transform = 'rotate(-25deg) scale(1.1)';
    setTimeout(() => { paw.style.transform = 'none'; }, 250);

    const tips = [
      'Мяу! Не забывай добирать норму белка сегодня!',
      'Хрум! Водичку попить тоже важно!',
      'Мурр, отличный прогресс в дневнике!',
      'Держи лапку! Ты отлично справляешься!'
    ];
    document.getElementById('pet-tip-text').innerText = tips[Math.floor(Math.random() * tips.length)];
  },

  calculateCoachGoals() {
    const gender = document.getElementById('calc-gender').value;
    const age = parseFloat(document.getElementById('calc-age').value);
    const h = parseFloat(document.getElementById('calc-height').value);
    const w = parseFloat(document.getElementById('calc-weight').value);
    const act = parseFloat(document.getElementById('calc-activity').value);

    if (!age || !h || !w) {
      alert('Заполните возраст, рост и вес');
      return;
    }

    appState.bodyParams = { gender, age, height: h, weight: w, act };
    localStorage.setItem('barsik_body_params', JSON.stringify(appState.bodyParams));

    // Базовый обмен веществ (BMR)
    let bmr = (10 * w) + (6.25 * h) - (5 * age);
    bmr += (gender === 'male') ? 5 : -161;

    // Суточный расход калорий (TDEE)
    const tdee = Math.round(bmr * act);

    // 1. Похудение (дефицит ~18%, белок 2.0 г/кг для сохранения мышц)
    const lossCal = Math.round(tdee * 0.82);
    const lossPro = Math.round(w * 2.0);
    const lossFat = Math.round(w * 0.9);
    const lossCarb = Math.max(50, Math.round((lossCal - (lossPro * 4) - (lossFat * 9)) / 4));

    // 2. Поддержание
    const mainCal = tdee;
    const mainPro = Math.round(w * 1.6);
    const mainFat = Math.round(w * 1.0);
    const mainCarb = Math.max(50, Math.round((mainCal - (mainPro * 4) - (mainFat * 9)) / 4));

    // 3. Набор массы (профицит ~12%)
    const gainCal = Math.round(tdee * 1.12);
    const gainPro = Math.round(w * 2.0);
    const gainFat = Math.round(w * 1.1);
    const gainCarb = Math.max(50, Math.round((gainCal - (gainPro * 4) - (gainFat * 9)) / 4));

    const resEl = document.getElementById('coach-results');
    resEl.style.display = 'block';
    resEl.innerHTML = `
      <div class="strategy-card" style="border-left: 4px solid var(--accent-protein);">
        <div class="strategy-title">
          <span>Похудение (дефицит)</span>
          <span style="color:var(--accent-protein);">${lossCal} ккал</span>
        </div>
        <div class="strategy-macros">Б: ${lossPro}г | Ж: ${lossFat}г | У: ${lossCarb}г</div>
        <button class="btn-outline" onclick="app.applyCalculatedGoal(${lossCal}, ${lossPro}, ${lossFat}, ${lossCarb})">Выбрать эту цель</button>
      </div>

      <div class="strategy-card" style="border-left: 4px solid var(--primary);">
        <div class="strategy-title">
          <span>Поддержание веса</span>
          <span style="color:var(--primary);">${mainCal} ккал</span>
        </div>
        <div class="strategy-macros">Б: ${mainPro}г | Ж: ${mainFat}г | У: ${mainCarb}г</div>
        <button class="btn-outline" onclick="app.applyCalculatedGoal(${mainCal}, ${mainPro}, ${mainFat}, ${mainCarb})">Выбрать эту цель</button>
      </div>

      <div class="strategy-card" style="border-left: 4px solid var(--accent-carb);">
        <div class="strategy-title">
          <span>Набор массы</span>
          <span style="color:var(--accent-carb);">${gainCal} ккал</span>
        </div>
        <div class="strategy-macros">Б: ${gainPro}г | Ж: ${gainFat}г | У: ${gainCarb}г</div>
        <button class="btn-outline" onclick="app.applyCalculatedGoal(${gainCal}, ${gainPro}, ${gainFat}, ${gainCarb})">Выбрать эту цель</button>
      </div>
    `;
  },

  applyCalculatedGoal(cal, pro, fat, carb) {
    document.getElementById('g-cal').value = cal;
    document.getElementById('g-pro').value = pro;
    document.getElementById('g-fat').value = fat;
    document.getElementById('g-carb').value = carb;
    this.saveGoalsManual();
  },

  saveGoalsManual() {
    appState.goals = {
      cal: parseFloat(document.getElementById('g-cal').value) || 1800,
      pro: parseFloat(document.getElementById('g-pro').value) || 110,
      fat: parseFloat(document.getElementById('g-fat').value) || 60,
      carb: parseFloat(document.getElementById('g-carb').value) || 200
    };
    localStorage.setItem('barsik_goals', JSON.stringify(appState.goals));
    this.renderGoals();
    this.renderToday();
    this.pushToFirebase();
    alert('Ваши новые нормы КБЖУ сохранены!');
    this.switchTab('today');
  },

  renderGoals() {
    document.getElementById('goal-cal').innerText = appState.goals.cal;
    document.getElementById('goal-pro').innerText = appState.goals.pro;
    document.getElementById('goal-fat').innerText = appState.goals.fat;
    document.getElementById('goal-carb').innerText = appState.goals.carb;
  },

  addWeightRecord() {
    const val = parseFloat(document.getElementById('new-weight-val').value);
    if (!val || val <= 0) {
      alert('Введите корректный вес');
      return;
    }

    const record = {
      id: Date.now().toString(),
      weight: val,
      date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      timestamp: Date.now()
    };

    appState.weightLogs.unshift(record);
    localStorage.setItem('barsik_weight_logs', JSON.stringify(appState.weightLogs));
    
    document.getElementById('calc-weight').value = val;
    document.getElementById('new-weight-val').value = '';
    
    this.renderWeightHistory();
    this.pushToFirebase();
    alert(`Вес ${val} кг зафиксирован!`);
  },

  renderWeightHistory() {
    const container = document.getElementById('weight-history-list');
    if (appState.weightLogs.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Замеров пока нет. Запишите свой текущий вес.</p>';
      return;
    }

    container.innerHTML = appState.weightLogs.slice(0, 8).map((item, idx) => {
      let diffText = '';
      if (idx < appState.weightLogs.length - 1) {
        const prev = appState.weightLogs[idx + 1].weight;
        const diff = (item.weight - prev).toFixed(1);
        if (diff < 0) {
          diffText = `<span style="color:#2E7D32; font-weight:700;">${diff} кг</span>`;
        } else if (diff > 0) {
          diffText = `<span style="color:#E07A5F; font-weight:700;">+${diff} кг</span>`;
        } else {
          diffText = `<span style="color:var(--text-muted);">0.0 кг</span>`;
        }
      }

      return `
        <div class="item-row">
          <div>
            <div class="item-name">${item.weight} кг</div>
            <div class="item-sub">${item.date}</div>
          </div>
          <div>${diffText}</div>
        </div>
      `;
    }).join('');
  },

  addIngredientToRecipe() {
    const pId = document.getElementById('recipe-prod-select').value;
    const weight = parseFloat(document.getElementById('recipe-prod-weight').value);

    if (!pId || !weight || weight <= 0) {
      alert('Укажите корректный вес ингредиента');
      return;
    }

    const prod = appState.products.find(p => p.id === pId);
    if (!prod) return;

    currentRecipeIngredients.push({ ...prod, addedWeight: weight });
    document.getElementById('recipe-prod-weight').value = '';
    this.renderRecipeList();
  },

  renderRecipeList() {
    const container = document.getElementById('recipe-ingredients-list');
    let totalW = 0;
    container.innerHTML = currentRecipeIngredients.map((item, index) => {
      totalW += item.addedWeight;
      return `
        <div class="item-row">
          <div>
            <div class="item-name">${item.name}</div>
            <div class="item-sub">${item.addedWeight} г</div>
          </div>
          <button class="btn-outline" style="padding:4px 8px; border-color:#E07A5F; color:#E07A5F;" onclick="app.removeIngredient(${index})">✕</button>
        </div>
      `;
    }).join('');

    document.getElementById('recipe-total-weight').innerText = totalW.toFixed(0);
  },

  removeIngredient(index) {
    currentRecipeIngredients.splice(index, 1);
    this.renderRecipeList();
  },

  logRecipePortion() {
    const name = document.getElementById('recipe-name').value.trim() || 'Салат/Блюдо';
    const eatenWeight = parseFloat(document.getElementById('recipe-portion-eat').value);
    
    let totalWeight = currentRecipeIngredients.reduce((acc, i) => acc + i.addedWeight, 0);

    if (totalWeight <= 0 || !eatenWeight || eatenWeight <= 0) {
      alert('Сначала добавьте ингредиенты в миску и введите вес съеденной порции');
      return;
    }

    let totalCal = 0, totalPro = 0, totalFat = 0, totalCarb = 0;
    currentRecipeIngredients.forEach(i => {
      const k = i.addedWeight / 100;
      totalCal += i.cal * k;
      totalPro += i.pro * k;
      totalFat += i.fat * k;
      totalCarb += i.carb * k;
    });

    const portionFactor = eatenWeight / totalWeight;

    const logEntry = {
      id: Date.now().toString(),
      name: `${name} (${eatenWeight}г из ${totalWeight.toFixed(0)}г)`,
      cal: Math.round(totalCal * portionFactor),
      pro: parseFloat((totalPro * portionFactor).toFixed(1)),
      fat: parseFloat((totalFat * portionFactor).toFixed(1)),
      carb: parseFloat((totalCarb * portionFactor).toFixed(1)),
      timestamp: Date.now()
    };

    this.addLogEntry(logEntry);
    alert(`Порция салата (${eatenWeight}г) записана в дневник!`);
    
    currentRecipeIngredients = [];
    this.renderRecipeList();
    document.getElementById('recipe-portion-eat').value = '';
    document.getElementById('recipe-name').value = '';
    this.switchTab('today');
  },

  addLogEntry(entry) {
    appState.todayLogs.push(entry);
    appState.lastMealTime = Date.now();
    this.saveData();
    this.renderToday();
    this.updatePetCycle();
  },

  clearDay() {
    if (confirm('Сбросить дневник за сегодня?')) {
      appState.todayLogs = [];
      this.saveData();
      this.renderToday();
    }
  },

  renderToday() {
    let tCal = 0, tPro = 0, tFat = 0, tCarb = 0;
    const listEl = document.getElementById('today-list');

    if (appState.todayLogs.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Пока ничего не съедено.</p>';
    } else {
      listEl.innerHTML = appState.todayLogs.map(item => {
        tCal += item.cal;
        tPro += item.pro;
        tFat += item.fat;
        tCarb += item.carb;
        return `
          <div class="item-row">
            <div>
              <div class="item-name">${item.name}</div>
              <div class="item-sub">${item.cal} ккал | Б: ${item.pro}г | Ж: ${item.fat}г | У: ${item.carb}г</div>
            </div>
          </div>
        `;
      }).join('');
    }

    document.getElementById('cur-cal').innerText = tCal;
    document.getElementById('cur-pro').innerText = tPro.toFixed(1);
    document.getElementById('cur-fat').innerText = tFat.toFixed(1);
    document.getElementById('cur-carb').innerText = tCarb.toFixed(1);

    const pCal = Math.min(100, (tCal / appState.goals.cal) * 100);
    const pPro = Math.min(100, (tPro / appState.goals.pro) * 100);
    const pFat = Math.min(100, (tFat / appState.goals.fat) * 100);
    const pCarb = Math.min(100, (tCarb / appState.goals.carb) * 100);

    document.getElementById('bar-cal').style.width = `${pCal}%`;
    document.getElementById('bar-pro').style.width = `${pPro}%`;
    document.getElementById('bar-fat').style.width = `${pFat}%`;
    document.getElementById('bar-carb').style.width = `${pCarb}%`;
  },

  renderProductsDropdowns() {
    const opts = appState.products.map(p => `<option value="${p.id}">${p.name} (${p.cal} ккал)</option>`).join('');
    document.getElementById('recipe-prod-select').innerHTML = opts;
    document.getElementById('quick-prod-select').innerHTML = opts;
  },

  saveManualProduct() {
    const name = document.getElementById('p-name').value.trim();
    const cal = parseFloat(document.getElementById('p-cal').value);
    const pro = parseFloat(document.getElementById('p-pro').value) || 0;
    const fat = parseFloat(document.getElementById('p-fat').value) || 0;
    const carb = parseFloat(document.getElementById('p-carb').value) || 0;
    const barcode = document.getElementById('p-barcode').value.trim();

    if (!name || isNaN(cal)) {
      alert('Укажите название и калорийность');
      return;
    }

    const newProd = { id: Date.now().toString(), name, cal, pro, fat, carb, barcode };
    appState.products.push(newProd);
    this.saveData();
    this.renderProductsDropdowns();
    alert(`Продукт «${name}» сохранён!`);

    document.getElementById('p-name').value = '';
    document.getElementById('p-cal').value = '';
    document.getElementById('p-pro').value = '';
    document.getElementById('p-fat').value = '';
    document.getElementById('p-carb').value = '';
    document.getElementById('p-barcode').value = '';
  },

  logSingleProduct() {
    const pId = document.getElementById('quick-prod-select').value;
    const weight = parseFloat(document.getElementById('quick-prod-weight').value);

    if (!pId || !weight || weight <= 0) {
      alert('Укажите вес порции');
      return;
    }

    const prod = appState.products.find(p => p.id === pId);
    if (!prod) return;

    const k = weight / 100;
    this.addLogEntry({
      id: Date.now().toString(),
      name: `${prod.name} (${weight}г)`,
      cal: Math.round(prod.cal * k),
      pro: parseFloat((prod.pro * k).toFixed(1)),
      fat: parseFloat((prod.fat * k).toFixed(1)),
      carb: parseFloat((prod.carb * k).toFixed(1)),
      timestamp: Date.now()
    });

    document.getElementById('quick-prod-weight').value = '';
    alert('Записано!');
    this.switchTab('today');
  },

  toggleCamera() {
    if (isCameraActive) {
      this.stopCamera();
    } else {
      this.startCamera();
    }
  },

  startCamera() {
    const videoWrapper = document.getElementById('scanner-wrapper');
    const video = document.getElementById('scanner-video');
    const btn = document.getElementById('btn-toggle-camera');

    if (!codeReader) {
      codeReader = new ZXing.BrowserMultiFormatReader();
    }

    videoWrapper.style.display = 'block';
    btn.innerText = 'Остановить камеру';
    isCameraActive = true;

    codeReader.decodeFromVideoDevice(null, video, (result) => {
      if (result) {
        const barcode = result.getText();
        this.stopCamera();
        this.handleBarcodeScanned(barcode);
      }
    });
  },

  stopCamera() {
    if (codeReader) codeReader.reset();
    document.getElementById('scanner-wrapper').style.display = 'none';
    document.getElementById('btn-toggle-camera').innerText = 'Включить камеру';
    isCameraActive = false;
  },

  async handleBarcodeScanned(barcode) {
    const local = appState.products.find(p => p.barcode === barcode);
    if (local) {
      document.getElementById('quick-prod-select').value = local.id;
      alert(`Найден в вашей базе: ${local.name}`);
      return;
    }

    try {
      const res = await fetch(`https://ru.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();

      if (data.status === 1 && data.product) {
        const p = data.product;
        const name = p.product_name_ru || p.product_name || 'Неизвестный продукт';
        const nutr = p.nutriments || {};
        
        document.getElementById('p-name').value = name;
        document.getElementById('p-barcode').value = barcode;
        document.getElementById('p-cal').value = Math.round(nutr['energy-kcal_100g'] || 0);
        document.getElementById('p-pro').value = nutr.proteins_100g || 0;
        document.getElementById('p-fat').value = nutr.fat_100g || 0;
        document.getElementById('p-carb').value = nutr.carbohydrates_100g || 0;

        alert(`Штрихкод найден: ${name}. Проверьте КБЖУ и сохраните.`);
      } else {
        document.getElementById('p-barcode').value = barcode;
        alert(`Штрихкод ${barcode} не найден. Введите данные с пачки вручную.`);
      }
    } catch (e) {
      document.getElementById('p-barcode').value = barcode;
      alert(`Ошибка сети. Введите данные для штрихкода ${barcode} вручную.`);
    }
  },

  initFirebase() {
    if (!appState.firebaseConfig) return;

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(appState.firebaseConfig);
      }
      db = firebase.firestore();
      document.getElementById('sync-badge').innerText = 'Firebase Онлайн';
      document.getElementById('sync-badge').classList.remove('offline');
      this.pullFromFirebase();
    } catch (e) {
      console.error(e);
      document.getElementById('sync-badge').innerText = 'Ошибка Firebase';
      document.getElementById('sync-badge').classList.add('offline');
    }
  },

  saveFirebaseConfig() {
    const raw = document.getElementById('firebase-config-input').value.trim();
    try {
      const cfg = JSON.parse(raw);
      localStorage.setItem('barsik_firebase_config', JSON.stringify(cfg));
      appState.firebaseConfig = cfg;
      alert('Конфигурация сохранена! Запускаем Firebase...');
      this.initFirebase();
    } catch (e) {
      alert('Неверный формат JSON');
    }
  },

  async pushToFirebase() {
    if (!db) return;
    try {
      await db.collection('userdata').doc('main').set({
        products: appState.products,
        todayLogs: appState.todayLogs,
        goals: appState.goals,
        weightLogs: appState.weightLogs,
        bodyParams: appState.bodyParams,
        lastMealTime: appState.lastMealTime,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error('Ошибка Firestore:', e);
    }
  },

  async pullFromFirebase() {
    if (!db) return;
    try {
      const doc = await db.collection('userdata').doc('main').get();
      if (doc.exists) {
        const data = doc.data();
        if (data.products) appState.products = data.products;
        if (data.todayLogs) appState.todayLogs = data.todayLogs;
        if (data.goals) appState.goals = data.goals;
        if (data.weightLogs) appState.weightLogs = data.weightLogs;
        if (data.bodyParams) appState.bodyParams = data.bodyParams;
        if (data.lastMealTime) appState.lastMealTime = data.lastMealTime;

        this.populateInputs();
        this.renderGoals();
        this.renderProductsDropdowns();
        this.renderToday();
        this.renderWeightHistory();
        this.updatePetCycle();
      }
    } catch (e) {
      console.error('Ошибка загрузки Firestore:', e);
    }
  },

  saveData() {
    localStorage.setItem('barsik_products', JSON.stringify(appState.products));
    localStorage.setItem('barsik_today_logs', JSON.stringify(appState.todayLogs));
    localStorage.setItem('barsik_last_meal_time', appState.lastMealTime.toString());
    this.pushToFirebase();
  }
};

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});