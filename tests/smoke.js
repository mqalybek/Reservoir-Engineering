// ============================================================
// Smoke-набор PetroLearn
//
// Прогоняет все страницы сайта в headless-Chromium и проверяет,
// что ключевые сценарии живы: тесты проходятся и считаются,
// глоссарий ищет, формулы фильтруются, теория рендерится,
// калькуляторы считают, и нигде нет ошибок в консоли.
//
//     node tests/smoke.js
//
// Требует playwright. Порядок вопросов в тестах перемешивается,
// поэтому вопросы опознаются по содержимому, а не по позиции.
// ============================================================

const path = require('path');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.error('Нужен playwright:  npm i -D playwright');
    process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

let passed = 0;
const failures = [];

function check(name, cond) {
    if (cond) { passed++; console.log('  ok   ' + name); }
    else { failures.push(name); console.log('  FAIL ' + name); }
}

function group(title) { console.log('\n' + title); }

(async () => {
    const browser = await chromium.launch(
        EXECUTABLE ? { executablePath: EXECUTABLE } : {}
    );
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
    page.on('console', m => {
        if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
            consoleErrors.push('console: ' + m.text());
        }
    });

    // ---------------- Главная ----------------
    group('Главная');
    await page.goto(url('index.html'));
    check('есть ровно один <h1>', await page.locator('h1').count() === 1);
    check('навигация из 6 пунктов', await page.locator('.nav__link').count() === 6);
    check('карточки разделов на месте', await page.locator('.feature-card__title').count() >= 5);
    check('бейдж ранга отрисован', (await page.locator('#rank-text').innerText()).length > 0);

    // ---------------- Тесты: базовый ----------------
    group('Тесты — базовый');
    await page.goto(url('tests.html'));
    check('три карточки тестов', await page.locator('.test-module-card').count() === 3);
    check('счётчик базового = 30 вопросов', (await page.locator('#q-count-basic').innerText()) === '30 вопросов');
    check('счётчик инженера = 43 вопроса', (await page.locator('#q-count-engineer').innerText()) === '43 вопроса');
    check('счётчик ГДИС = 25 вопросов', (await page.locator('#q-count-gdis').innerText()) === '25 вопросов');

    await page.click('#btn-start-basic');
    check('квиз открылся', await page.locator('#quiz-box').isVisible());
    check('30 точек навигации', await page.locator('.quiz-dot').count() === 30);
    check('счёт виден (тест оценивается)', await page.locator('#quiz-score-wrap').isVisible());

    // Отвечаем на все вопросы первым вариантом — проверяем, что движок
    // доводит тест до результата без ошибок.
    const dots = page.locator('.quiz-dot');
    for (let i = 0; i < 30; i++) {
        await dots.nth(i).click();
        const btns = page.locator('#quiz-options .quiz__btn');
        const n = await btns.count();
        for (let b = 0; b < n; b++) {
            if (await btns.nth(b).isEnabled()) { await btns.nth(b).click(); break; }
        }
    }
    check('кнопка «Завершить» появилась', await page.locator('#btn-finish-quiz:not(.hidden)').count() === 1);
    await page.click('#btn-finish-quiz');
    check('экран результатов открыт', await page.locator('#quiz-result-screen').isVisible());
    const scoreText = await page.locator('#final-score').innerText();
    check('показан счёт вида «N из 30» (' + scoreText + ')', /^\d+ из 30$/.test(scoreText));
    check('процент показан', /%$/.test(await page.locator('#final-percent').innerText()));
    check('вердикт непустой', (await page.locator('#final-verdict').innerText()).length > 10);
    check('результат сохранён в localStorage',
        await page.evaluate(() => localStorage.getItem('petrolearn.best.basic')) !== null);

    // ---------------- Тесты: ГДИС ----------------
    group('Тесты — ГДИС (матричные вопросы)');
    await page.click('#btn-back-to-tests');
    await page.click('#btn-start-gdis');
    check('25 точек навигации', await page.locator('.quiz-dot').count() === 25);

    const seen = { matrix: 0, flat: 0, darcy: false, skin: false, plot: false };
    const gdots = page.locator('.quiz-dot');
    for (let i = 0; i < 25; i++) {
        await gdots.nth(i).click();
        const isMatrix = await page.locator('.quiz-matrix').count() === 1;
        const qText = await page.locator('#quiz-question').innerText();
        if (isMatrix) {
            seen.matrix++;
            const rows = await page.locator('.quiz-matrix tbody tr').count();
            const cols = await page.locator('.quiz-matrix thead th').count();
            if (qText.includes('Дарси')) { seen.darcy = true; check('матрица Дарси 6×6', rows === 6 && cols === 6); }
            else if (qText.includes('скин-фактора')) { seen.skin = true; check('матрица скин 4×3', rows === 4 && cols === 3); }
            else if (await page.locator('.quiz-question-image').count() === 1) {
                seen.plot = true;
                check('матрица графика 3×4', rows === 3 && cols === 4);
                check('картинка диагностического графика видна',
                    await page.locator('.quiz-question-image').isVisible());
            }
            // одна отметка на строку (радио-поведение)
            const row0 = page.locator('.quiz-matrix tbody tr').first().locator('input[type=radio]');
            await row0.first().click();
            await row0.nth(1).click();
            check('в строке матрицы остаётся одна отметка',
                !(await row0.first().isChecked()) && (await row0.nth(1).isChecked()));
            for (let r = 0; r < rows; r++) {
                await page.locator('.quiz-matrix tbody tr').nth(r).locator('input[type=radio]').first().click();
            }
        } else {
            seen.flat++;
            const btns = page.locator('#quiz-options .quiz__btn');
            const n = await btns.count();
            for (let b = 0; b < n; b++) {
                if (await btns.nth(b).isEnabled()) { await btns.nth(b).click(); break; }
            }
        }
    }
    check('найдены все три матричных вопроса', seen.darcy && seen.skin && seen.plot);
    check('3 матричных и 22 обычных вопроса', seen.matrix === 3 && seen.flat === 22);
    await page.click('#btn-finish-quiz');
    check('ГДИС даёт числовой результат', /^\d+ из 25$/.test(await page.locator('#final-score').innerText()));
    check('нейтральное сообщение скрыто (ключ ответов есть)',
        !(await page.locator('#quiz-result-ungraded-note').isVisible()));

    // ---------------- Глоссарий ----------------
    group('Глоссарий');
    await page.goto(url('glossary.html'));
    const termCount = await page.locator('.glossary-item').count();
    check('термины отрисованы (' + termCount + ')', termCount === 59);
    check('алфавитный указатель есть', await page.locator('.glossary-az__btn').count() > 5);
    await page.fill('#glossary-search-input', 'пористость');
    check('поиск сузил список', await page.locator('.glossary-item').count() < termCount);
    await page.fill('#glossary-search-input', 'щщщщ');
    check('пустое состояние показано', await page.locator('.glossary-empty').count() === 1);
    await page.goto(url('glossary.html') + '?q=Пористость');
    check('deep-link ?q= работает', await page.locator('.glossary-item').count() < termCount);
    check('флэш-карточка отрисована', (await page.locator('#fc-term').innerText()).length > 0);

    // ---------------- Формулы ----------------
    group('Формулы');
    await page.goto(url('formulas.html'));
    const formulaCount = await page.locator('.formula-card').count();
    check('формулы отрисованы (' + formulaCount + ')', formulaCount === 37);
    check('KaTeX отрендерил математику', await page.locator('.katex').count() > 0);
    check('чипы категорий есть', await page.locator('#formula-chips .chip').count() >= 7);
    // Поиск скрывает карточки классом .hidden, не удаляя их из DOM.
    await page.fill('#formula-search-input', 'дюпюи');
    const found = await page.locator('.formula-card:not(.hidden)').count();
    check('поиск «дюпюи» оставил 2 формулы (' + found + ')', found === 2);
    await page.fill('#formula-search-input', 'щщщщ');
    check('пустое состояние по формулам', await page.locator('#formulas-empty:not(.hidden)').count() === 1);
    await page.goto(url('formulas.html') + '#formula-dupuit');
    check('deep-link раскрывает карточку формулы',
        await page.locator('#formula-dupuit[open]').count() === 1);

    // ---------------- Теория ----------------
    group('Теория');
    await page.goto(url('theory.html'));
    check('хаб с 6 разделами', await page.locator('.theory-hub-card').count() === 6);
    await page.goto(url('theory-fluids.html'));
    check('есть <h1>', await page.locator('h1').count() === 1);
    check('темы раздела отрисованы', await page.locator('.theory-topic').count() === 3);
    check('оглавление построено', await page.locator('.theory-toc a').count() === 3);
    check('встроенные формулы с KaTeX', await page.locator('.formula-embed .katex').count() > 0);
    check('ссылка на формулу ведёт в справочник',
        (await page.locator('.formula-link').first().getAttribute('href')).startsWith('formulas.html#formula-'));
    // Маркеров {{term:…}} в разделе «Пластовые флюиды» нет — берём «Скважины».
    await page.goto(url('theory-wells.html'));
    check('ссылка на термин ведёт в глоссарий',
        (await page.locator('.term-link').first().getAttribute('href')).startsWith('glossary.html?q='));
    check('у ссылки на термин есть подсказка из глоссария',
        ((await page.locator('.term-link').first().getAttribute('title')) || '').length > 10);
    // Новые типы блоков
    check('блок «пример расчёта» отрисован', await page.locator('.theory-example').count() === 1);
    check('у примера есть «дано»', await page.locator('.theory-example__given').count() === 1);
    check('шаги решения пронумерованы', await page.locator('.theory-example__steps li').count() === 3);
    check('формулы в шагах отрендерены KaTeX',
        await page.locator('.theory-example__math .katex').count() === 2);
    check('ответ примера выделен', (await page.locator('.theory-example__result').innerText()).includes('158'));
    check('ссылка на формулу из примера',
        (await page.locator('.theory-example__ref').getAttribute('href')) === 'formulas.html#formula-dupuit');
    check('блок литературы отрисован', await page.locator('.theory-refs li').count() === 3);
    await page.goto(url('theory-reservoirs.html'));
    check('таблица данных отрисована', await page.locator('.data-table').count() > 0);
    check('пейджер между разделами есть', await page.locator('.theory-pager a').count() > 0);

    // ---------------- Калькуляторы ----------------
    group('Калькуляторы');
    await page.goto(url('calculators.html'));
    check('экран выбора калькулятора', await page.locator('.calc-tile').count() >= 3);
    await page.goto(url('calculators.html') + '#calc-card-darcy');
    check('deep-link открыл нужный калькулятор',
        await page.locator('#calc-card-darcy').isVisible());
    await page.fill('#calc-k', '100'); await page.fill('#calc-dh', '10');
    await page.fill('#calc-dp', '5');  await page.fill('#calc-mu', '2');
    await page.fill('#calc-rk', '250'); await page.fill('#calc-rc', '0.1');
    await page.click('#btn-calc-darcy');
    const darcyRes = await page.locator('#res-darcy').innerText();
    check('Дюпюи считает и даёт м³/сут (' + darcyRes + ')', /м³\/сут$/.test(darcyRes));
    await page.fill('#calc-rk', '0.05');
    await page.click('#btn-calc-darcy');
    check('некорректный ввод даёт понятную ошибку',
        (await page.locator('#res-darcy').innerText()).includes('Проверьте'));

    // ---------------- Подготовка вопросов ----------------
    // Страж регресса: prepareQuizData раньше пересобирал вопрос по белому
    // списку полей и терял image / explanation / source / id. Проверяем,
    // что произвольные поля доживают до экрана.
    group('Подготовка вопросов');
    await page.goto(url('tests.html'));
    const prep = await page.evaluate(() => {
        const probe = [{
            id: 999, type: 'single',
            question: 'Проверочный вопрос',
            options: ['первый', 'второй', 'третий'],
            answer: 2,
            image: 'assets/probe.png',
            imageAlt: 'подпись',
            explanation: 'пояснение к ответу',
            source: 'Тестовый источник'
        }];
        const out = prepareQuizData(probe)[0];
        return {
            keys: Object.keys(out).sort(),
            answerPointsToSameOption: out.options[out.answer] === 'третий',
            explanation: out.explanation,
            id: out.id
        };
    });
    check('произвольные поля вопроса сохраняются (' + prep.keys.join(',') + ')',
        ['image', 'imageAlt', 'explanation', 'source', 'id'].every(k => prep.keys.includes(k)));
    check('explanation доходит без изменений', prep.explanation === 'пояснение к ответу');
    check('id сохраняется', prep.id === 999);
    check('ключ ответа пересчитан под новый порядок вариантов', prep.answerPointsToSameOption);

    // ---------------- Ранги ----------------
    group('Ранги');
    const rankUsesGdis = await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('petrolearn.best.gdis', JSON.stringify({ score: 25, total: 25 }));
        return getRank();
    });
    check('результат по ГДИС влияет на ранг (' + rankUsesGdis + ')', rankUsesGdis === 'Эксперт 👑');
    await page.evaluate(() => localStorage.clear());

    // ---------------- Общее ----------------
    group('Общее');
    check('нет ошибок в консоли: ' + JSON.stringify(consoleErrors), consoleErrors.length === 0);

    await browser.close();

    console.log('\n' + '─'.repeat(52));
    if (failures.length) {
        console.log(`❌ Провалено ${failures.length} из ${passed + failures.length}:`);
        failures.forEach(f => console.log('   • ' + f));
        process.exit(1);
    }
    console.log(`✅ Все ${passed} проверок пройдены`);
})().catch(err => {
    console.error('\nSmoke-набор упал:', err);
    process.exit(1);
});
