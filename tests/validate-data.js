// ============================================================
// Валидатор контента PetroLearn
//
// Проверяет целостность данных ДО того, как они попадут на сайт:
// корректность вопросов и ключей ответов, наличие обязательных
// полей у формул и терминов, существование целей у всех
// перекрёстных ссылок {{formula:…}} / {{term:…}} и внутри теории.
//
// Не требует браузера — запускается за доли секунды:
//     node tests/validate-data.js
//
// Ошибка (ERROR) роняет сборку; предупреждение (WARN) — нет.
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA_FILES = ['site_data.js', 'theory_data.js', 'formulas_data.js', 'gdis_quiz_data.js'];

const errors = [];
const warnings = [];
const fail = msg => errors.push(msg);
const warn = msg => warnings.push(msg);

// ---------- загрузка данных в изолированный контекст ----------
const source = DATA_FILES
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
    source + ';this.exported = { quizDataBasic, quizDataEngineer, quizDataGdis, ' +
    'glossaryData, formulasData, formulaCategories, theoryData };',
    sandbox
);
const {
    quizDataBasic, quizDataEngineer, quizDataGdis,
    glossaryData, formulasData, formulaCategories, theoryData
} = sandbox.exported;

// ---------- 1. Вопросы тестов ----------
const QUIZZES = [
    ['quizDataBasic', quizDataBasic],
    ['quizDataEngineer', quizDataEngineer],
    ['quizDataGdis', quizDataGdis]
];

QUIZZES.forEach(([name, quiz]) => {
    const seenIds = new Set();

    quiz.forEach((q, i) => {
        const at = `${name}[${i}]${q.id !== undefined ? ' (id: ' + q.id + ')' : ''}`;

        if (typeof q.question !== 'string' || !q.question.trim()) {
            fail(`${at}: пустой текст вопроса`);
        }
        if (q.id !== undefined) {
            if (seenIds.has(q.id)) fail(`${at}: дублирующийся id`);
            seenIds.add(q.id);
        }

        const type = q.type || (Array.isArray(q.answer) ? 'multi' : 'single');
        if (!['single', 'multi', 'matrix'].includes(type)) {
            fail(`${at}: неизвестный тип вопроса «${type}»`);
            return;
        }

        if (type === 'matrix') {
            if (!Array.isArray(q.rows) || !q.rows.length) fail(`${at}: matrix без rows`);
            if (!Array.isArray(q.columns) || !q.columns.length) fail(`${at}: matrix без columns`);
            if (Array.isArray(q.rows) && new Set(q.rows).size !== q.rows.length) {
                fail(`${at}: повторяющиеся названия строк — ответ хранится по имени строки`);
            }
            if (q.answer !== null && q.answer !== undefined) {
                if (typeof q.answer !== 'object' || Array.isArray(q.answer)) {
                    fail(`${at}: ответ matrix должен быть объектом { строка: столбец }`);
                } else {
                    q.rows.forEach(r => {
                        if (!(r in q.answer)) {
                            fail(`${at}: в ключе ответа нет строки «${r}»`);
                        } else if (!q.columns.includes(q.answer[r])) {
                            fail(`${at}: строка «${r}» указывает на несуществующий столбец «${q.answer[r]}»`);
                        }
                    });
                    Object.keys(q.answer).forEach(r => {
                        if (!q.rows.includes(r)) {
                            fail(`${at}: в ключе ответа лишняя строка «${r}»`);
                        }
                    });
                }
            }
            if (q.image) {
                const img = path.join(ROOT, q.image);
                if (!fs.existsSync(img)) fail(`${at}: файл изображения не найден — ${q.image}`);
                if (!q.imageAlt) warn(`${at}: у изображения нет imageAlt (доступность)`);
            }
            return;
        }

        // single / multi
        if (!Array.isArray(q.options) || q.options.length < 2) {
            fail(`${at}: нужно минимум два варианта ответа`);
            return;
        }
        if (new Set(q.options).size !== q.options.length) {
            fail(`${at}: повторяющиеся варианты ответа`);
        }

        if (q.answer === null || q.answer === undefined) {
            warn(`${at}: ключ ответа не задан — вопрос не будет оцениваться`);
            return;
        }

        const indices = Array.isArray(q.answer) ? q.answer : [q.answer];
        if (type === 'multi' && !Array.isArray(q.answer)) {
            fail(`${at}: у multi-вопроса ответ должен быть массивом индексов`);
        }
        if (type === 'single' && Array.isArray(q.answer)) {
            fail(`${at}: у single-вопроса ответ должен быть одним числом`);
        }
        indices.forEach(idx => {
            if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) {
                fail(`${at}: индекс ответа ${idx} вне диапазона 0..${q.options.length - 1}`);
            }
        });
        if (new Set(indices).size !== indices.length) {
            fail(`${at}: повторяющиеся индексы в ключе ответа`);
        }
        if (type === 'multi' && indices.length === q.options.length) {
            warn(`${at}: правильны все варианты — вопрос ничего не проверяет`);
        }

        // Текст вида «(выберите три)» должен совпадать с числом ответов
        const WORD_TO_NUM = { один: 1, два: 2, три: 3, четыре: 4, пять: 5, шесть: 6 };
        const m = q.question.match(/выберите\s+(один|два|три|четыре|пять|шесть)/i);
        if (m && type === 'multi') {
            const expected = WORD_TO_NUM[m[1].toLowerCase()];
            if (expected !== indices.length) {
                fail(`${at}: в тексте «выберите ${m[1]}», а в ключе ответа ${indices.length}`);
            }
        }
    });
});

// ---------- 2. Формулы ----------
const formulaIds = new Set();
formulasData.forEach((f, i) => {
    const at = `formulasData[${i}] (${f.id || 'без id'})`;
    if (!f.id) fail(`${at}: нет id`);
    else if (formulaIds.has(f.id)) fail(`${at}: дублирующийся id`);
    else formulaIds.add(f.id);

    if (!f.title) fail(`${at}: нет заголовка`);
    if (!f.latex) fail(`${at}: нет latex`);
    if (!f.source) warn(`${at}: нет источника — атрибуция важна для доверия`);
    if (!f.category) fail(`${at}: нет категории`);
    else if (!formulaCategories.some(c => c.id === f.category)) {
        fail(`${at}: неизвестная категория «${f.category}»`);
    }
    if (Array.isArray(f.variables)) {
        f.variables.forEach((v, j) => {
            if (!v.symbol) fail(`${at}: у переменной [${j}] нет symbol`);
            if (!v.name) fail(`${at}: у переменной [${j}] нет name`);
        });
    }
});

// ---------- 3. Глоссарий ----------
const seenTerms = new Set();
glossaryData.forEach((g, i) => {
    const at = `glossaryData[${i}] (${g.term || 'без термина'})`;
    if (!g.term || !g.term.trim()) fail(`${at}: пустой термин`);
    if (!g.definition || !g.definition.trim()) fail(`${at}: пустое определение`);
    const key = (g.term || '').toLowerCase().trim();
    if (seenTerms.has(key)) fail(`${at}: дублирующийся термин`);
    seenTerms.add(key);
});

// ---------- 4. Теория: структура и блоки ----------
const KNOWN_BLOCK_TYPES = ['text', 'formula', 'table', 'note', 'example', 'list', 'image', 'reference'];
const topicIds = new Set();

theoryData.forEach((section, si) => {
    const sAt = `theoryData[${si}] (${section.id || 'без id'})`;
    if (!section.id) fail(`${sAt}: нет id`);
    if (!section.title) fail(`${sAt}: нет заголовка`);
    if (!section.page) fail(`${sAt}: нет page`);
    else if (!fs.existsSync(path.join(ROOT, section.page))) {
        fail(`${sAt}: страница не найдена — ${section.page}`);
    }
    if (!Array.isArray(section.topics) || !section.topics.length) {
        fail(`${sAt}: нет тем`);
        return;
    }

    section.topics.forEach((topic, ti) => {
        const tAt = `${sAt} → topics[${ti}] (${topic.id || 'без id'})`;
        if (!topic.id) fail(`${tAt}: нет id`);
        else if (topicIds.has(topic.id)) fail(`${tAt}: дублирующийся id темы (ломает якорные ссылки)`);
        else topicIds.add(topic.id);
        if (!topic.title) fail(`${tAt}: нет заголовка`);
        if (!Array.isArray(topic.blocks) || !topic.blocks.length) {
            fail(`${tAt}: нет блоков`);
            return;
        }

        topic.blocks.forEach((block, bi) => {
            const bAt = `${tAt} → blocks[${bi}] (${block.type})`;
            if (!KNOWN_BLOCK_TYPES.includes(block.type)) {
                fail(`${bAt}: неизвестный тип блока — он не отрендерится`);
                return;
            }
            if (block.type === 'text' || block.type === 'note') {
                if (!block.text || !block.text.trim()) fail(`${bAt}: пустой текст`);
            }
            if (block.type === 'formula') {
                if (!block.ref) fail(`${bAt}: нет ref`);
                else if (!formulaIds.has(block.ref)) {
                    fail(`${bAt}: ссылка на несуществующую формулу «${block.ref}»`);
                }
            }
            if (block.type === 'table') {
                if (!Array.isArray(block.head) || !block.head.length) fail(`${bAt}: нет head`);
                if (!Array.isArray(block.rows) || !block.rows.length) fail(`${bAt}: нет rows`);
                if (Array.isArray(block.head) && Array.isArray(block.rows)) {
                    block.rows.forEach((row, ri) => {
                        if (!Array.isArray(row)) {
                            fail(`${bAt}: строка [${ri}] не массив`);
                        } else if (row.length !== block.head.length) {
                            fail(`${bAt}: в строке [${ri}] ${row.length} ячеек, а в шапке ${block.head.length}`);
                        }
                    });
                }
            }
            if (block.type === 'list') {
                if (!Array.isArray(block.items) || !block.items.length) fail(`${bAt}: нет items`);
            }
            if (block.type === 'image') {
                if (!block.src) fail(`${bAt}: нет src`);
                else if (!fs.existsSync(path.join(ROOT, block.src))) {
                    fail(`${bAt}: файл не найден — ${block.src}`);
                }
                if (!block.alt) warn(`${bAt}: нет alt (доступность)`);
            }
            if (block.type === 'reference') {
                if (!Array.isArray(block.items) || !block.items.length) fail(`${bAt}: нет items`);
            }
            if (block.type === 'example') {
                if (!block.given || !block.given.trim()) fail(`${bAt}: нет блока «дано»`);
                if (!Array.isArray(block.steps) || !block.steps.length) fail(`${bAt}: нет шагов решения`);
                if (!block.result || !block.result.trim()) fail(`${bAt}: нет ответа`);
                if (block.ref && !formulaIds.has(block.ref)) {
                    fail(`${bAt}: ссылка на несуществующую формулу «${block.ref}»`);
                }
            }
        });
    });
});

// ---------- 5. Перекрёстные ссылки {{formula:…}} / {{term:…}} ----------
const MARKER_RE = /\{\{(term|formula):([^}|]+)(?:\|([^}]+))?\}\}/g;
const glossaryLower = glossaryData.map(g => g.term.toLowerCase());

function checkMarkers(str, where) {
    let m;
    MARKER_RE.lastIndex = 0;
    while ((m = MARKER_RE.exec(str)) !== null) {
        const [, kind, target] = m;
        if (kind === 'formula') {
            if (!formulaIds.has(target)) {
                fail(`${where}: {{formula:${target}}} — такой формулы нет`);
            }
        } else {
            const q = target.toLowerCase();
            if (!glossaryLower.some(t => t.includes(q))) {
                fail(`${where}: {{term:${target}}} — термин не найден в глоссарии`);
            }
        }
    }
}

theoryData.forEach(section => {
    section.topics.forEach(topic => {
        topic.blocks.forEach((block, bi) => {
            const where = `${section.id} → ${topic.id} → blocks[${bi}]`;
            if (typeof block.text === 'string') checkMarkers(block.text, where);
            if (Array.isArray(block.items)) {
                block.items.forEach(it => {
                    if (typeof it === 'string') checkMarkers(it, where);
                });
            }
            if (Array.isArray(block.steps)) {
                block.steps.forEach(st => {
                    if (typeof st === 'string') checkMarkers(st, where);
                    else if (st && typeof st.text === 'string') checkMarkers(st.text, where);
                });
            }
            if (typeof block.given === 'string') checkMarkers(block.given, where);
            if (typeof block.result === 'string') checkMarkers(block.result, where);
        });
    });
});

// ---------- отчёт ----------
console.log('Проверено:');
console.log(`  вопросов ...... ${quizDataBasic.length + quizDataEngineer.length + quizDataGdis.length}`);
console.log(`  формул ........ ${formulasData.length}`);
console.log(`  терминов ...... ${glossaryData.length}`);
console.log(`  разделов ...... ${theoryData.length}`);
console.log(`  тем ........... ${topicIds.size}`);
console.log('');

warnings.forEach(w => console.log('WARN  ' + w));
if (warnings.length) console.log('');

if (errors.length) {
    errors.forEach(e => console.log('ERROR ' + e));
    console.log(`\n❌ Ошибок: ${errors.length}, предупреждений: ${warnings.length}`);
    process.exit(1);
}

console.log(`✅ Данные корректны (предупреждений: ${warnings.length})`);
