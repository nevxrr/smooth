
/**
* ADVANCED COSMETIC RECOMMENDER SYSTEM v5.2
* Версия для параметров skin и goals на русском языке.
*/

// === СОПОСТАВЛЕНИЕ ТИПОВ КОЖИ И ЦЕЛЕЙ (РУССКИЙ -> АНГЛИЙСКИЙ) ===
const SKIN_TYPE_MAPPING = {
    'все': 'all',
    'сухая': 'dry',
    'жирная': 'oily',
    'чувствительная': 'sensitive',
    'комбинированная': 'combination',
    'нормальная': 'normal'
};

const GOALS_MAPPING = {
    'увлажнение': 'hydration',
    'успокоение': 'soothing',
    'антивозрастной': 'anti-aging',
    'питание': 'nourishing',
    'осветление': 'brightening',
    'очищение': 'cleansing',
    'сужение пор': 'pore tightening',
    'отшелушивание': 'exfoliating'
    // Добавь нужные цели здесь!
};

// ========== ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ ========== //
const CONFIG = {
    SPREADSHEET_ID: '1OtSbpF_-bRMHrcffVGRNmvqskV6Zgy2v8g0c7pxrTZg',
    SHEET_NAME: 'Products',
    DATA_RANGE: 'A1:M1373',
    API_KEY: 'AIzaSyD117gv97TsNT8oyn6sq11VGuYNrWQlFco',

    ROUTINE_STEPS: {
        3: ['cleansing', 'treatment', 'protection'],
        5: ['cleansing', 'toning', 'treatment', 'moisturizing', 'protection'],
        7: ['cleansing', 'exfoliating', 'toning', 'treatment', 'ampoules', 'moisturizing', 'protection']
    },

    STEP_MAPPING: {
        'cleansing': ['очищение', 'cleansing', 'cleanse'],
        'toning': ['тонизирование', 'toning', 'tone'],
        'treatment': ['уход', 'treatment', 'serum'],
        'moisturizing': ['увлажнение', 'moisturizing', 'moisturize'],
        'protection': ['защита', 'protection', 'spf'],
        'exfoliating': ['эксфолиация', 'exfoliating', 'exfoliate'],
        'ampoules': ['ампулы', 'ampoules', 'ampoule']
    },

    COUNTRY_OPTIONS: {
        'корейская': ['Korea', 'South Korea', 'Korean'],
        'европейская': ['France', 'Germany', 'Italy', 'Spain', 'EU', 'European', 'French', 'German', 'Italian', 'Spanish'],
        'русская': ['Russia', 'Russian'],
        'все': []
    },

    PRICE_TIERS: {
        'до 1000': { min: 0, max: 1000 },
        '1000-3000': { min: 1000, max: 3000 },
        '3000+': { min: 3000, max: Infinity },
        'все': { min: 0, max: Infinity }
    },

    INCOMPATIBLE_PAIRS: [
        {
            group1: ["Retinol", "Retinaldehyde", "Retinyl Palmitate"],
            group2: ["AHA", "BHA", "PHA", "Glycolic Acid", "Lactic Acid", "Salicylic Acid", "Citric Acid"],
            reason: "Causes irritation and dryness"
        },
        {
            group1: ["Vitamin C", "L-Ascorbic Acid", "Sodium Ascorbyl Phosphate"],
            group2: ["Niacinamide", "Vitamin B3"],
            reason: "May cause flushing and reduce efficacy"
        },
        {
            group1: ["Benzoyl Peroxide"],
            group2: ["Vitamin C", "Retinol", "Peptides"],
            reason: "Oxidizes active ingredients"
        },
        {
            group1: ["Copper Peptides"],
            group2: ["Vitamin C", "Direct Acids"],
            reason: "Can destabilize the peptides"
        }
    ],

    SKIN_TYPE_RESTRICTIONS: {
        dry: ["Alcohol", "Alcohol Denat", "Fragrance"],
        oily: ["Mineral Oil", "Petrolatum"],
        sensitive: ["Fragrance", "Essential Oils"],
        normal: [],
        combination: ["SD Alcohol"]
    }
};

// ========== ОБРАБОТКА ПРОДУКТОВ ========== //

function loadProductDatabase() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${CONFIG.SHEET_NAME}!${CONFIG.DATA_RANGE}?key=${CONFIG.API_KEY}`;
        const response = UrlFetchApp.fetch(url);
        if (response.getResponseCode() !== 200) {
            throw new Error(`API Error: ${response.getContentText()}`);
        }
        const data = JSON.parse(response.getContentText()).values;
        if (!data || data.length < 2) throw new Error('No product data found');
        const headers = data[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
        return data.slice(1).map(row => {
            const product = {};
            headers.forEach((header, i) => {
                product[header] = row[i] || '';
            });
            return product;
        });
    } catch (error) {
        throw new Error('Could not load product database');
    }
}

function filterProducts(products, params) {
    const filtered = products.filter(product => {
        const stepMatch = product.step && params.steps.some(stepName => {
            const stepVariants = CONFIG.STEP_MAPPING[stepName] || [stepName];
            return stepVariants.some(variant =>
                product.step.toLowerCase().includes(variant.toLowerCase())
            );
        });

        const countryMatch = params.country === 'все' ||
            (product.country && (
                !params.country ||
                CONFIG.COUNTRY_OPTIONS[params.country]?.some(country =>
                    product.country.toLowerCase().includes(country.toLowerCase())
                )
            ));

        const priceValue = parseFloat(product.price) || 0;
        const priceMatch = priceValue >= params.price.min && priceValue <= params.price.max;

        // Поиск по skin теперь только на английском!
        const skinMatch = !product.skin_type ||
            product.skin_type.toLowerCase() === 'all' ||
            product.skin_type.toLowerCase().split(',').includes(params.skin) ||
            params.skin === 'all';

        // Поиск по goals теперь только на английском!
        const goalsMatch = params.goals.length === 0 ||
            !product.benefits ||
            (product.benefits && params.goals.some(g =>
                product.benefits.toLowerCase().includes(g.toLowerCase())
            ));

        return stepMatch && countryMatch && priceMatch && skinMatch && goalsMatch;
    });

    return filtered;
}

// ========== РЕКОМЕНДАЦИИ ========== //

function generateRoutine(userRequest) {
    try {
        // === ПЕРЕВОД С РУССКОГО НА АНГЛИЙСКИЙ ===
        const skin = SKIN_TYPE_MAPPING[(userRequest.skin || 'все').toLowerCase()] || 'all';
        const goals = (userRequest.goals || []).map(g => GOALS_MAPPING[g.trim().toLowerCase()] || g.trim().toLowerCase());

        const params = {
            skin: skin,
            goals: goals,
            country: userRequest.country && CONFIG.COUNTRY_OPTIONS[userRequest.country.toLowerCase()]
                ? userRequest.country.toLowerCase()
                : 'все',
            price: userRequest.price && CONFIG.PRICE_TIERS[userRequest.price.toLowerCase()]
                ? CONFIG.PRICE_TIERS[userRequest.price.toLowerCase()]
                : CONFIG.PRICE_TIERS['все'],
            stepCount: [3, 5, 7].includes(parseInt(userRequest.step)) ? parseInt(userRequest.step) : 5,
            steps: CONFIG.ROUTINE_STEPS[[3, 5, 7].includes(parseInt(userRequest.step)) ? parseInt(userRequest.step) : 5]
        };

        const allProducts = loadProductDatabase();
        const filteredProducts = filterProducts(allProducts, params);

        if (filteredProducts.length === 0) {
            return {
                success: false,
                error: 'No products matching your criteria',
                parameters: params
            };
        }

        const routine = {};
        const warnings = checkIngredientCompatibility(filteredProducts);

        for (const step of params.steps) {
            const stepVariants = CONFIG.STEP_MAPPING[step] || [step];
            const stepProducts = filteredProducts.filter(p =>
                p.step && stepVariants.some(variant =>
                    p.step.toLowerCase().includes(variant.toLowerCase())
                )
            );

            if (stepProducts.length > 0) {
                stepProducts.sort((a, b) => {
                    const ratingA = parseFloat(a.rating) || 0;
                    const ratingB = parseFloat(b.rating) || 0;
                    return ratingB - ratingA || (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
                });

                const formattedProduct = formatProduct(stepProducts[0]);
                if (formattedProduct) {
                    routine[step] = formattedProduct;
                }
            }
        }

        return {
            success: true,
            routine,
            parameters: params,
            warnings,
            skinCareTips: getSkinCareTips(params.skin)
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ========== //

function checkIngredientCompatibility(products) {
    const warnings = [];
    if (!Array.isArray(products)) {
        return warnings;
    }
    products.forEach(product => {
        if (!product || !product.ingredients || !product.name) return;
        const ingredients = product.ingredients.split(',').map(i => i.trim()).filter(Boolean);
        CONFIG.INCOMPATIBLE_PAIRS.forEach(pair => {
            const hasGroup1 = pair.group1.some(ing => ingredients.includes(ing));
            const hasGroup2 = pair.group2.some(ing => ingredients.includes(ing));
            if (hasGroup1 && hasGroup2) {
                warnings.push({
                    product: product.name,
                    conflict: `${pair.group1.join('/')} + ${pair.group2.join('/')}`,
                    reason: pair.reason
                });
            }
        });
    });
    return warnings;
}

function formatProduct(product) {
    if (!product) {
        return null;
    }
    return {
        name: product.name || 'Unnamed Product',
        brand: product.brand || 'Unknown Brand',
        price: product.price ? parseFloat(product.price) : 0,
        country: product.country || 'Unknown',
        ingredients: product.ingredients || '',
        benefits: product.benefits || '',
        rating: product.rating ? parseFloat(product.rating) : null,
        step: product.step || 'Unknown',
        texture: product.texture || '',
        is_spf: product.is_spf === 'TRUE'
    };
}

function getSkinCareTips(skinType) {
    const tips = {
        dry: ["Используйте кремовые очищающие средства", "Наносите сыворотки на влажную кожу", "Применяйте ночные кремы с церамидами"],
        oily: ["Используйте гелевые текстуры", "Пробуйте продукты с ниацинамидом", "Не пропускайте увлажнение"],
        sensitive: ["Избегайте спирта", "Тестируйте новые продукты на участке кожи", "Ищите успокаивающие компоненты"],
        combination: ["Используйте разные средства для разных зон", "Балансируйте увлажнение"],
        all: ["Очищайте кожу дважды в день", "Всегда используйте SPF", "Меняйте уход по состоянию кожи"],
        normal: ["Поддерживайте постоянный уход", "Используйте SPF ежедневно", "Прислушивайтесь к коже"]
    };
    return tips[skinType] || ["Очищайте кожу дважды в день", "Всегда используйте SPF"];
}

// ========== ТОЧКА ВХОДА ========== //

function doGet(e) {
    try {
        const params = e?.parameter || {};
        const response = generateRoutine({
            skin: params.skin || 'все',
            goals: params.goals ? params.goals.split(',') : [],
            country: params.country || 'все',
            price: params.price || 'все',
            step: params.step || 5
        });
        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
