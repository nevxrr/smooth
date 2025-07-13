// main.js

document.addEventListener('DOMContentLoaded', function () {
    // 1. Получаем ответы пользователя из localStorage
    const userAnswers = JSON.parse(localStorage.getItem('quizAnswers')) || {};

    // 2. Преобразуем ответы в параметры для подбора
    const requestParams = mapAnswersToParams(userAnswers);

    // 3. Загружаем данные и показываем рекомендации
    loadAndRecommend(requestParams);

    console.log('Параметры запроса:', requestParams);
});



// Функция преобразования ответов в параметры
function mapAnswersToParams(answers) {
    const skinTypeMap = {
        'Сухая': 'dry',
        'Жирная': 'oily',
        'Комбинированная': 'combination',
        'Нормальная': 'normal',
        'Чувствительная': 'sensitive'
    };

    const goalsMap = {
        'Увлажнение': 'hydration',
        'Борьба с акне': 'cleansing',
        'Избавление от морщин': 'anti-aging',
        'Осветление пигментации': 'brightening',
        'Успокоение кожи': 'soothing',
        'Матирование': 'pore tightening',
        'Общее улучшение кожи': 'nourishing'
    };

    const stepMap = {
        'Минимальный уход (3 шага: очищение, уход, защита)': 3,
        'Стандартный (5 шагов)': 5,
        'Расширенный (7+ шагов)': 7
    };

    const countryMap = {
        'Нет предпочтений': 'all',
        'Корейская': 'Korea',
        'Европейская': 'Europe',
        'Российская': 'Russia'
    };

    const priceMap = {
        'До 1000₽': { min: 0, max: 1000 },
        '1000-3000₽': { min: 1000, max: 3000 },
        'Выше 3000₽': { min: 3000, max: Infinity }
    };

    return {
        skin: skinTypeMap[answers[2]?.[0]] || 'all',
        goals: answers[4]?.map(g => goalsMap[g]) || [],
        steps: stepMap[answers[5]?.[0]] || 5,
        country: countryMap[answers[6]?.[0]] || 'all',
        price: priceMap[answers[7]?.[0]] || { min: 0, max: Infinity }
    };
}

// Основная функция загрузки и рекомендаций
async function loadAndRecommend(params) {
    try {
        // Загружаем данные из XLSX
        const products = await loadXLSXData();

        // Фильтруем продукты по параметрам
        const filteredProducts = filterProducts(products, params);

        // Группируем по шагам ухода
        const routine = groupBySteps(filteredProducts, params.steps);

        // Отображаем результаты
        displayResults(routine);
    } catch (error) {
        console.error('Ошибка:', error);
        document.body.innerHTML = `<div class="error">Произошла ошибка: ${error.message}</div>`;
    }
}

// Загрузка данных из XLSX
async function loadXLSXData() {
    try {
        const response = await fetch('data.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Получаем первый лист
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Преобразуем в JSON
        return XLSX.utils.sheet_to_json(firstSheet);
    } catch (error) {
        throw new Error('Не удалось загрузить данные о продуктах');
    }
}

// Фильтрация продуктов
function filterProducts(products, params) {
    return products.filter(product => {
        // Проверка типа кожи
        const skinMatch = !product.skin_type ||
            product.skin_type.toLowerCase() === 'all' ||
            product.skin_type.toLowerCase().includes(params.skin);

        // Проверка целей
        const goalsMatch = params.goals.length === 0 ||
            (product.benefits && params.goals.some(goal =>
                product.benefits.toLowerCase().includes(goal.toLowerCase())
            ));

        // Проверка страны
        const countryMatch = params.country === 'all' ||
            (product.country && product.country.includes(params.country));

        // Проверка цены
        const price = parseFloat(product.price) || 0;
        const priceMatch = price >= params.price.min && price <= params.price.max;

        return skinMatch && goalsMatch && countryMatch && priceMatch;
    });
}

// Группировка продуктов по шагам ухода
function groupBySteps(products, stepCount) {
    const stepMapping = {
        3: ['cleansing', 'treatment', 'protection'],
        5: ['cleansing', 'toning', 'treatment', 'moisturizing', 'protection'],
        7: ['cleansing', 'exfoliating', 'toning', 'treatment', 'ampoules', 'moisturizing', 'protection']
    };

    const steps = stepMapping[stepCount] || stepMapping[5];
    const routine = {};

    steps.forEach(step => {
        // Находим продукты для текущего шага
        const stepProducts = products.filter(p =>
            p.step && p.step.toLowerCase().includes(step.toLowerCase())
                .sort((a, b) => {
                    const ratingA = parseFloat(a.rating) || 0;
                    const ratingB = parseFloat(b.rating) || 0;
                    return ratingB - ratingA || (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
                }));

        routine[step] = stepProducts.length > 0 ? stepProducts[0] : null;
    });

    return routine;
}

// Отображение результатов
function displayResults(routine) {
    const stepNames = {
        'cleansing': 'Очищение',
        'toning': 'Тонизирование',
        'treatment': 'Лечение/Сыворотка',
        'moisturizing': 'Увлажнение',
        'protection': 'Защита (SPF)',
        'exfoliating': 'Эксфолиация',
        'ampoules': 'Ампулы'
    };

    let html = `
        <div class="recommendations">
            <h1>Рекомендуемые средства</h1>
            <div class="routine-steps">
    `;

    for (const [step, product] of Object.entries(routine)) {
        html += `
            <div class="step">
                <h2>${stepNames[step] || step}</h2>
                ${product ?
                `<div class="product">
                        <p><strong>${product.brand || 'Бренд не указан'} ${product.name || 'Название не указано'}</strong></p>
                    </div>` :
                '<p>Не найдено подходящих средств</p>'
            }
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    document.body.innerHTML = html;
}