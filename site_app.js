// ================= АНИМАЦИИ ПРИ СКРОЛЛЕ =================
// Выполняется первым: контент виден по умолчанию, JS лишь добавляет
// анимацию появления. Любой сбой ниже по файлу не скроет страницу.
(function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    // threshold: 0 — секция может быть выше экрана (например, справочник
    // формул), и порог в долях её высоты никогда бы не сработал.
    }, { threshold: 0, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-up').forEach(el => {
        el.classList.add('fade-init');
        observer.observe(el);
    });
})();

// ================= УТИЛИТЫ =================
function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ================= ХРАНИЛИЩЕ РЕЗУЛЬТАТОВ =================
const TEST_TYPES = ['basic', 'engineer'];

function bestResultKey(type) {
    return 'petrolearn.best.' + type;
}

function getBestResult(type) {
    try {
        const raw = localStorage.getItem(bestResultKey(type));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed.score !== 'number' || typeof parsed.total !== 'number' || parsed.total <= 0) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function saveBestResult(type, score, total) {
    const current = getBestResult(type);
    const percent = Math.round((score / total) * 100);
    if (!current || percent > Math.round((current.score / current.total) * 100)) {
        try {
            localStorage.setItem(bestResultKey(type), JSON.stringify({ score, total }));
        } catch (e) { /* localStorage недоступен (приватный режим) */ }
        return true;
    }
    return false;
}

// Миграция со старого формата (единый maxQuizScore без привязки к тесту)
(function migrateLegacyScore() {
    try {
        const legacy = localStorage.getItem('maxQuizScore');
        if (legacy !== null && !getBestResult('basic')) {
            const score = Math.min(parseInt(legacy, 10) || 0, 30);
            if (score > 0) saveBestResult('basic', score, 30);
        }
        if (legacy !== null) localStorage.removeItem('maxQuizScore');
    } catch (e) { /* ignore */ }
})();

// ================= СИСТЕМА РАНГОВ =================
function getBestPercent() {
    let best = null;
    TEST_TYPES.forEach(type => {
        const res = getBestResult(type);
        if (res) {
            const percent = Math.round((res.score / res.total) * 100);
            if (best === null || percent > best) best = percent;
        }
    });
    return best; // null, если тесты ещё не пройдены
}

function getRank() {
    const percent = getBestPercent();
    if (percent === null) return 'Новичок';
    if (percent < 40) return 'Студент';
    if (percent < 65) return 'Инженер';
    if (percent < 85) return 'Главный геолог';
    return 'Эксперт 👑';
}

function updateRankUI() {
    const rankText = document.getElementById('rank-text');
    if (rankText) rankText.textContent = getRank();
}
updateRankUI();

// ================= МОБИЛЬНОЕ МЕНЮ (БУРГЕР) =================
const navBurger = document.getElementById('nav-burger');
const navMenu = document.querySelector('.nav');

if (navBurger && navMenu) {
    navBurger.addEventListener('click', () => {
        navBurger.classList.toggle('is-open');
        navMenu.classList.toggle('is-open');
    });

    // Закрыть меню при клике на ссылку
    navMenu.querySelectorAll('.nav__link').forEach(link => {
        link.addEventListener('click', () => {
            navBurger.classList.remove('is-open');
            navMenu.classList.remove('is-open');
        });
    });

    // Закрыть меню при клике вне его
    document.addEventListener('click', (e) => {
        if (!navBurger.contains(e.target) && !navMenu.contains(e.target)) {
            navBurger.classList.remove('is-open');
            navMenu.classList.remove('is-open');
        }
    });
}

// ================= КВИЗ И ТЕСТЫ =================
const btnStartBasic = document.getElementById('btn-start-basic');
const btnStartEngineer = document.getElementById('btn-start-engineer');
const quizStartScreen = document.getElementById('quiz-start-screen');
const quizBox = document.getElementById('quiz-box');
const quizResultScreen = document.getElementById('quiz-result-screen');
const questionEl = document.getElementById('quiz-question');
const optionsEl = document.getElementById('quiz-options');
const counterEl = document.getElementById('quiz-counter');
const scoreEl = document.getElementById('quiz-score');
const btnNext = document.getElementById('btn-next-question');
const finalScoreEl = document.getElementById('final-score');
const finalPercentEl = document.getElementById('final-percent');
const finalVerdictEl = document.getElementById('final-verdict');
const reviewEl = document.getElementById('quiz-review');
const btnRestart = document.getElementById('btn-restart-quiz');
const btnBackToTests = document.getElementById('btn-back-to-tests');
const progressFillEl = document.getElementById('quiz-progress-fill');

const navDotsContainer = document.getElementById('quiz-nav-dots');
const btnPrev = document.getElementById('btn-prev-question');
const btnFinish = document.getElementById('btn-finish-quiz');

let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let currentQuizData = [];
let currentTestType = 'basic';

// Готовит копию теста: перемешивает вопросы и варианты ответов,
// пересчитывая индексы правильных ответов под новый порядок.
function prepareQuizData(sourceData) {
    return shuffleArray(sourceData).map(q => {
        const order = shuffleArray(q.options.map((_, i) => i));
        return {
            question: q.question,
            options: order.map(i => q.options[i]),
            answer: Array.isArray(q.answer)
                ? q.answer.map(a => order.indexOf(a))
                : order.indexOf(q.answer)
        };
    });
}

function isMultiQuestion(q) {
    return Array.isArray(q.answer);
}

// Состояние ответа: для одиночных вопросов — number | null,
// для вопросов с несколькими ответами — { selected: number[], locked: boolean } | null.
function isAnswerLocked(answerState, question) {
    if (answerState === null || answerState === undefined) return false;
    return isMultiQuestion(question) ? answerState.locked : true;
}

function isAnswerCorrect(answerState, question) {
    if (!isAnswerLocked(answerState, question)) return false;
    if (isMultiQuestion(question)) {
        return question.answer.every(a => answerState.selected.includes(a)) &&
               answerState.selected.every(a => question.answer.includes(a));
    }
    return answerState === question.answer;
}

function startQuiz(type) {
    if (type) currentTestType = type;

    const source = currentTestType === 'engineer'
        ? (typeof quizDataEngineer !== 'undefined' ? quizDataEngineer : [])
        : (typeof quizDataBasic !== 'undefined' ? quizDataBasic : []);
    if (!source.length) return;

    currentQuestionIndex = 0;
    score = 0;
    currentQuizData = prepareQuizData(source);
    userAnswers = new Array(currentQuizData.length).fill(null);

    quizStartScreen.classList.add('hidden');
    quizResultScreen.classList.add('hidden');
    quizBox.classList.remove('hidden');
    scoreEl.textContent = score;
    renderNavDots();
    updateProgressBar();
    loadQuestion();
}

function renderNavDots() {
    if (!navDotsContainer) return;
    navDotsContainer.innerHTML = '';
    currentQuizData.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.classList.add('quiz-dot');
        dot.textContent = index + 1;
        dot.addEventListener('click', () => {
            currentQuestionIndex = index;
            loadQuestion();
        });
        navDotsContainer.appendChild(dot);
    });
}

function updateNavDots() {
    if (!navDotsContainer) return;
    Array.from(navDotsContainer.children).forEach((dot, index) => {
        dot.className = 'quiz-dot'; // сброс
        if (index === currentQuestionIndex) {
            dot.classList.add('active');
        } else if (isAnswerLocked(userAnswers[index], currentQuizData[index])) {
            const correct = isAnswerCorrect(userAnswers[index], currentQuizData[index]);
            dot.classList.add(correct ? 'answered_correct' : 'answered_wrong');
        }
    });
}

function updateProgressBar() {
    if (!progressFillEl) return;
    const answered = userAnswers.filter((ans, idx) => isAnswerLocked(ans, currentQuizData[idx])).length;
    const fraction = currentQuizData.length ? answered / currentQuizData.length : 0;
    progressFillEl.style.transform = 'scaleX(' + fraction + ')';
}

function loadQuestion() {
    resetState();
    updateNavDots();
    const currentQuestion = currentQuizData[currentQuestionIndex];
    counterEl.textContent = `Вопрос ${currentQuestionIndex + 1} из ${currentQuizData.length}`;
    questionEl.textContent = currentQuestion.question;

    const answerState = userAnswers[currentQuestionIndex];
    const isMulti = isMultiQuestion(currentQuestion);

    if (isMulti) {
        const hint = document.createElement('p');
        hint.classList.add('quiz__hint');
        hint.textContent = `(Выберите правильные ответы: ${currentQuestion.answer.length})`;
        optionsEl.appendChild(hint);
    }

    const letters = ['а', 'б', 'в', 'г', 'д', 'е', 'ж'];

    currentQuestion.options.forEach((option, index) => {
        const button = document.createElement('button');
        const letter = letters[index] ? letters[index] + ') ' : '';
        button.textContent = letter + option;
        button.classList.add('quiz__btn');

        button.addEventListener('click', () => selectAnswer(index, button));
        optionsEl.appendChild(button);

        // Восстановление состояния при возврате к вопросу
        if (answerState !== null && answerState !== undefined) {
            if (!isMulti) {
                button.disabled = true;
                if (index === currentQuestion.answer) {
                    button.classList.add('correct');
                } else if (index === answerState) {
                    button.classList.add('wrong');
                }
            } else if (answerState.locked) {
                button.disabled = true;
                if (currentQuestion.answer.includes(index)) {
                    button.classList.add('correct');
                } else if (answerState.selected.includes(index)) {
                    button.classList.add('wrong');
                }
            } else if (answerState.selected.includes(index)) {
                button.disabled = true;
                button.classList.add(currentQuestion.answer.includes(index) ? 'correct' : 'wrong');
            }
        }
    });

    updateButtonsVisibility();
}

function updateButtonsVisibility() {
    if (btnPrev) {
        btnPrev.classList.toggle('hidden', currentQuestionIndex === 0);
    }

    const isLastQuestion = currentQuestionIndex === currentQuizData.length - 1;
    if (btnNext) {
        btnNext.classList.toggle('hidden', isLastQuestion);
    }

    if (btnFinish) {
        const allAnswered = userAnswers.length > 0 &&
            userAnswers.every((ans, idx) => isAnswerLocked(ans, currentQuizData[idx]));
        btnFinish.classList.toggle('hidden', !(isLastQuestion || allAnswered));
    }
}

function resetState() {
    if (btnNext) btnNext.classList.add('hidden');
    if (btnPrev) btnPrev.classList.add('hidden');
    if (btnFinish) btnFinish.classList.add('hidden');
    while (optionsEl.firstChild) {
        optionsEl.removeChild(optionsEl.firstChild);
    }
}

function selectAnswer(selectedIndex, selectedBtn) {
    const currentQuestion = currentQuizData[currentQuestionIndex];

    if (isMultiQuestion(currentQuestion)) {
        if (!userAnswers[currentQuestionIndex]) {
            userAnswers[currentQuestionIndex] = { selected: [], locked: false };
        }
        const state = userAnswers[currentQuestionIndex];

        if (state.locked || state.selected.includes(selectedIndex)) return;
        state.selected.push(selectedIndex);

        const isCorrect = currentQuestion.answer.includes(selectedIndex);
        if (isCorrect) {
            selectedBtn.classList.add('correct');
            selectedBtn.disabled = true;
        } else {
            selectedBtn.classList.add('wrong');
            selectedBtn.disabled = true;
            state.locked = true;
        }

        const allCorrectSelected = currentQuestion.answer.every(a => state.selected.includes(a));
        if (allCorrectSelected || state.locked) {
            state.locked = true;
            optionsEl.querySelectorAll('.quiz__btn').forEach((button, i) => {
                if (currentQuestion.answer.includes(i)) button.classList.add('correct');
                button.disabled = true;
            });
            afterAnswerLocked();
        }
        return;
    }

    if (userAnswers[currentQuestionIndex] !== null && userAnswers[currentQuestionIndex] !== undefined) return;

    userAnswers[currentQuestionIndex] = selectedIndex;
    selectedBtn.classList.add(selectedIndex === currentQuestion.answer ? 'correct' : 'wrong');

    optionsEl.querySelectorAll('.quiz__btn').forEach((button, i) => {
        if (i === currentQuestion.answer) button.classList.add('correct');
        button.disabled = true;
    });

    afterAnswerLocked();
}

function afterAnswerLocked() {
    recalculateScore();
    updateNavDots();
    updateProgressBar();
    updateButtonsVisibility();
}

function recalculateScore() {
    score = userAnswers.reduce((acc, ans, idx) =>
        acc + (isAnswerCorrect(ans, currentQuizData[idx]) ? 1 : 0), 0);
    scoreEl.textContent = score;
}

function handleNextButton() {
    if (currentQuestionIndex < currentQuizData.length - 1) {
        currentQuestionIndex++;
        loadQuestion();
    }
}

function handlePrevButton() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
    }
}

function getVerdict(percent) {
    if (percent >= 90) return 'Блестящий результат! Вы отлично владеете материалом.';
    if (percent >= 70) return 'Хороший результат. Просмотрите разбор ошибок ниже, чтобы закрыть пробелы.';
    if (percent >= 40) return 'Неплохое начало. Рекомендуем повторить теорию и пройти тест ещё раз.';
    return 'Стоит начать с раздела «Теория» — там собран весь необходимый материал.';
}

function formatAnswer(question, indices) {
    return indices.map(i => question.options[i]).join('; ');
}

function renderReview() {
    if (!reviewEl) return;
    reviewEl.innerHTML = '';

    const mistakes = currentQuizData
        .map((q, idx) => ({ q, state: userAnswers[idx] }))
        .filter(({ q, state }) => !isAnswerCorrect(state, q));

    if (mistakes.length === 0) return;

    const title = document.createElement('h3');
    title.classList.add('quiz-review__title');
    title.textContent = `Разбор ошибок (${mistakes.length})`;
    reviewEl.appendChild(title);

    mistakes.forEach(({ q, state }) => {
        const item = document.createElement('div');
        item.classList.add('quiz-review__item');

        const questionP = document.createElement('p');
        questionP.classList.add('quiz-review__question');
        questionP.textContent = q.question;
        item.appendChild(questionP);

        const userP = document.createElement('p');
        userP.classList.add('quiz-review__answer', 'quiz-review__answer--user');
        if (state === null || state === undefined) {
            userP.textContent = 'Ваш ответ: — (нет ответа)';
        } else if (isMultiQuestion(q)) {
            userP.textContent = 'Ваш ответ: ' + (state.selected.length ? formatAnswer(q, state.selected) : '— (нет ответа)');
        } else {
            userP.textContent = 'Ваш ответ: ' + q.options[state];
        }
        item.appendChild(userP);

        const correctP = document.createElement('p');
        correctP.classList.add('quiz-review__answer', 'quiz-review__answer--correct');
        const correctIndices = isMultiQuestion(q) ? q.answer : [q.answer];
        correctP.textContent = 'Правильный ответ: ' + formatAnswer(q, correctIndices);
        item.appendChild(correctP);

        reviewEl.appendChild(item);
    });
}

function showResults() {
    quizBox.classList.add('hidden');
    quizResultScreen.classList.remove('hidden');

    recalculateScore();
    const total = currentQuizData.length;
    const percent = total ? Math.round((score / total) * 100) : 0;

    finalScoreEl.textContent = `${score} из ${total}`;
    if (finalPercentEl) finalPercentEl.textContent = percent + '%';
    if (finalVerdictEl) finalVerdictEl.textContent = getVerdict(percent);

    renderReview();
    saveBestResult(currentTestType, score, total);
    updateRankUI();
    renderBestScores();
    quizResultScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function backToTestSelection() {
    quizBox.classList.add('hidden');
    quizResultScreen.classList.add('hidden');
    quizStartScreen.classList.remove('hidden');
}

function pluralizeQuestions(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' вопрос';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' вопроса';
    return n + ' вопросов';
}

// Лучшие результаты и реальное число вопросов на карточках выбора теста
function renderBestScores() {
    const config = [
        { type: 'basic', data: typeof quizDataBasic !== 'undefined' ? quizDataBasic : null },
        { type: 'engineer', data: typeof quizDataEngineer !== 'undefined' ? quizDataEngineer : null }
    ];
    config.forEach(({ type, data }) => {
        const countEl = document.getElementById('q-count-' + type);
        if (countEl && data) countEl.textContent = pluralizeQuestions(data.length);

        const bestEl = document.getElementById('best-score-' + type);
        if (bestEl) {
            const best = getBestResult(type);
            bestEl.textContent = best ? `Лучший: ${best.score}/${best.total}` : '';
        }
    });
}
renderBestScores();

if (btnStartBasic) btnStartBasic.addEventListener('click', () => startQuiz('basic'));
if (btnStartEngineer) btnStartEngineer.addEventListener('click', () => startQuiz('engineer'));
if (btnNext) btnNext.addEventListener('click', handleNextButton);
if (btnPrev) btnPrev.addEventListener('click', handlePrevButton);
if (btnFinish) btnFinish.addEventListener('click', showResults);
if (btnRestart) btnRestart.addEventListener('click', () => startQuiz());
if (btnBackToTests) btnBackToTests.addEventListener('click', backToTestSelection);

// ================= ГЛОССАРИЙ =================
const glossaryListEl = document.getElementById('glossary-list');
const searchInput = document.getElementById('glossary-search-input');

function renderGlossary(data) {
    if (!glossaryListEl) return;
    glossaryListEl.innerHTML = '';

    if (data.length === 0) {
        const empty = document.createElement('p');
        empty.classList.add('text-white');
        empty.textContent = 'Термин не найден.';
        glossaryListEl.appendChild(empty);
        return;
    }

    data.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('glossary-item');

        const termSpan = document.createElement('span');
        termSpan.classList.add('glossary-item__term');
        termSpan.textContent = item.term;

        const defSpan = document.createElement('span');
        defSpan.classList.add('glossary-item__def');
        defSpan.textContent = item.definition;

        div.append(termSpan, defSpan);
        glossaryListEl.appendChild(div);
    });
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = glossaryData.filter(item =>
            item.term.toLowerCase().includes(query) ||
            item.definition.toLowerCase().includes(query)
        );
        renderGlossary(filtered);
    });
}

// Инициализация глоссария (с поддержкой ссылок вида glossary.html?q=термин)
if (glossaryListEl && typeof glossaryData !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get('q') || '').trim();
    if (query && searchInput) {
        searchInput.value = query;
        searchInput.dispatchEvent(new Event('input'));
    } else {
        renderGlossary(glossaryData);
    }
}

// ================= ФЛЭШ-КАРТОЧКИ =================
let currentFlashcardIndex = 0;
const fcTerm = document.getElementById('fc-term');
const fcDef = document.getElementById('fc-def');
const flashcard = document.getElementById('flashcard');
const btnPrevCard = document.getElementById('btn-prev-card');
const btnNextCard = document.getElementById('btn-next-card');

function renderFlashcard(index) {
    if (!fcTerm || typeof glossaryData === 'undefined') return;
    flashcard.classList.remove('is-flipped');
    // Свап текста в момент, когда карточка повёрнута ребром (≈середина
    // переворота 0.45s) — смена контента остаётся невидимой.
    setTimeout(() => {
        fcTerm.textContent = glossaryData[index].term;
        fcDef.textContent = glossaryData[index].definition;
    }, 220);
}

if (flashcard && typeof glossaryData !== 'undefined') {
    renderFlashcard(0);

    flashcard.addEventListener('click', () => {
        flashcard.classList.toggle('is-flipped');
    });

    if (btnPrevCard) btnPrevCard.addEventListener('click', () => {
        currentFlashcardIndex = (currentFlashcardIndex - 1 + glossaryData.length) % glossaryData.length;
        renderFlashcard(currentFlashcardIndex);
    });

    if (btnNextCard) btnNextCard.addEventListener('click', () => {
        currentFlashcardIndex = (currentFlashcardIndex + 1) % glossaryData.length;
        renderFlashcard(currentFlashcardIndex);
    });
}

// ================= КАЛЬКУЛЯТОРЫ =================
function readNumber(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    return parseFloat(el.value);
}

function setResult(id, text, isError) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#EF9A9A' : '';
}

const btnCalcVol = document.getElementById('btn-calc-vol');
if (btnCalcVol) {
    btnCalcVol.addEventListener('click', () => {
        const F = readNumber('calc-f');
        const h = readNumber('calc-h');
        const m = readNumber('calc-m');
        const beta = readNumber('calc-beta');
        const gamma = readNumber('calc-gamma');
        const theta = readNumber('calc-theta');

        const values = [F, h, m, beta, gamma, theta];
        if (values.some(v => isNaN(v) || v < 0)) {
            setResult('res-vol', 'Проверьте вводимые значения', true);
            return;
        }
        // F в тыс. м², γ в г/см³ (≡ т/м³) → результат в тыс. т
        const qn = F * h * m * beta * gamma * theta;
        setResult('res-vol', Math.round(qn).toLocaleString('ru-RU') + ' тыс. т');
    });
}

const btnCalcApi = document.getElementById('btn-calc-api');
if (btnCalcApi) {
    btnCalcApi.addEventListener('click', () => {
        const api = readNumber('calc-api');
        if (isNaN(api) || api <= -131.5) {
            setResult('res-api', 'Проверьте значение API', true);
            return;
        }
        const sg = 141.5 / (api + 131.5);
        const density = sg * 1000;
        setResult('res-api', density.toFixed(1) + ' кг/м³');
    });
}

// Дебит по формуле Дюпюи (плоскорадиальный приток)
const btnCalcDarcy = document.getElementById('btn-calc-darcy');
if (btnCalcDarcy) {
    btnCalcDarcy.addEventListener('click', () => {
        const k = readNumber('calc-k');        // мД
        const h = readNumber('calc-dh');       // м
        const dp = readNumber('calc-dp');      // МПа
        const mu = readNumber('calc-mu');      // мПа·с
        const rk = readNumber('calc-rk');      // м
        const rc = readNumber('calc-rc');      // м

        if ([k, h, dp, mu, rk, rc].some(v => isNaN(v) || v <= 0) || rk <= rc) {
            setResult('res-darcy', 'Проверьте значения (Rк > rс, все > 0)', true);
            return;
        }
        // Перевод единиц: мД → м² (9.869e-16), МПа → Па (1e6), мПа·с → Па·с (1e-3), сек → сут (86400)
        const q = (2 * Math.PI * k * 9.869e-16 * h * dp * 1e6) / (mu * 1e-3 * Math.log(rk / rc)) * 86400;
        setResult('res-darcy', q.toFixed(1) + ' м³/сут');
    });
}

// Конвертер единиц
const UNIT_CONVERSIONS = {
    'psi-mpa':  { factor: 0.00689476, label: 'МПа' },
    'mpa-psi':  { factor: 145.038,    label: 'psi' },
    'atm-mpa':  { factor: 0.101325,   label: 'МПа' },
    'bbl-m3':   { factor: 0.158987,   label: 'м³' },
    'm3-bbl':   { factor: 6.28981,    label: 'барр.' },
    'ft-m':     { factor: 0.3048,     label: 'м' }
};

const btnCalcConvert = document.getElementById('btn-calc-convert');
if (btnCalcConvert) {
    btnCalcConvert.addEventListener('click', () => {
        const value = readNumber('calc-conv-value');
        const typeEl = document.getElementById('calc-conv-type');
        const conv = typeEl ? UNIT_CONVERSIONS[typeEl.value] : null;

        if (isNaN(value) || !conv) {
            setResult('res-convert', 'Проверьте вводимое значение', true);
            return;
        }
        const result = value * conv.factor;
        setResult('res-convert', result.toLocaleString('ru-RU', { maximumFractionDigits: 4 }) + ' ' + conv.label);
    });
}

// ================= РЕНДЕР МАТЕМАТИКИ (KaTeX) =================
// katex.min.js подключён обычным <script> перед этим файлом и уже
// выполнен к моменту вызова renderMath. Текстовый фолбэк остаётся
// на случай, если файл библиотеки недоступен (страница не должна
// оставаться пустой) — но без дозагрузки и повторного рендера,
// чтобы не сдвигать layout после первой отрисовки (CLS).
function renderMath(el, latex, displayMode) {
    if (typeof katex === 'undefined') {
        el.textContent = latex.replace(/\\text\{([^}]*)\}/g, '$1').replace(/[\\{}]/g, '');
        return;
    }
    try {
        katex.render(latex, el, { throwOnError: false, displayMode });
    } catch (e) {
        el.textContent = latex;
    }
}

// ================= СПРАВОЧНИК ФОРМУЛ =================
const formulasListEl = document.getElementById('formulas-list');

if (formulasListEl && typeof formulasData !== 'undefined') { try {
    const chipsEl = document.getElementById('formula-chips');
    const formulaSearchEl = document.getElementById('formula-search-input');
    const emptyEl = document.getElementById('formulas-empty');

    let activeCategory = 'all';
    let searchQuery = '';

    function buildFormulaCard(formula) {
        const card = document.createElement('article');
        card.classList.add('formula-card');
        card.id = 'formula-' + formula.id;
        card.dataset.category = formula.category;
        card.dataset.search = [
            formula.title,
            formula.note || '',
            (formula.variables || []).map(v => v.name).join(' ')
        ].join(' ').toLowerCase();

        const head = document.createElement('div');
        head.classList.add('formula-card__head');

        const title = document.createElement('h3');
        title.classList.add('formula-card__title');
        title.textContent = formula.title;
        head.appendChild(title);

        if (formula.calcLink) {
            const link = document.createElement('a');
            link.classList.add('formula-card__calc-link');
            link.href = formula.calcLink.href;
            link.textContent = formula.calcLink.label + ' →';
            head.appendChild(link);
        }
        card.appendChild(head);

        const math = document.createElement('div');
        math.classList.add('formula-math');
        renderMath(math, formula.latex, true);
        card.appendChild(math);

        if (formula.variables && formula.variables.length) {
            const table = document.createElement('table');
            table.classList.add('formula-vars');
            formula.variables.forEach(v => {
                const row = table.insertRow();
                const symbolCell = row.insertCell();
                symbolCell.classList.add('formula-vars__symbol');
                renderMath(symbolCell, v.symbol, false);
                row.insertCell().textContent = v.name;
                const unitsCell = row.insertCell();
                unitsCell.classList.add('formula-vars__units');
                unitsCell.textContent = v.units;
            });
            card.appendChild(table);
        }

        if (formula.note) {
            const note = document.createElement('p');
            note.classList.add('formula-note');
            note.textContent = formula.note;
            card.appendChild(note);
        }

        if (formula.source) {
            const source = document.createElement('p');
            source.classList.add('formula-source');
            source.textContent = 'Источник: ' + formula.source;
            card.appendChild(source);
        }

        return card;
    }

    // Первичный рендер: карточки строятся один раз, фильтрация — скрытием
    const categorySections = [];
    formulaCategories.forEach(cat => {
        const section = document.createElement('div');
        section.classList.add('formula-category');
        section.dataset.category = cat.id;

        const heading = document.createElement('h3');
        heading.classList.add('formula-category__title');
        heading.textContent = cat.name;
        section.appendChild(heading);

        formulasData
            .filter(f => f.category === cat.id)
            .forEach(f => section.appendChild(buildFormulaCard(f)));

        formulasListEl.appendChild(section);
        categorySections.push(section);
    });

    function applyFormulaFilter() {
        let visibleTotal = 0;
        categorySections.forEach(section => {
            let visibleInSection = 0;
            section.querySelectorAll('.formula-card').forEach(card => {
                const matchesCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
                const matchesSearch = !searchQuery || card.dataset.search.includes(searchQuery);
                const visible = matchesCategory && matchesSearch;
                card.classList.toggle('hidden', !visible);
                if (visible) visibleInSection++;
            });
            section.classList.toggle('hidden', visibleInSection === 0);
            visibleTotal += visibleInSection;
        });
        if (emptyEl) emptyEl.classList.toggle('hidden', visibleTotal > 0);
    }

    if (chipsEl) {
        const allCats = [{ id: 'all', name: 'Все' }].concat(formulaCategories);
        allCats.forEach(cat => {
            const chip = document.createElement('button');
            chip.classList.add('chip');
            if (cat.id === 'all') chip.classList.add('active');
            chip.textContent = cat.name;
            chip.addEventListener('click', () => {
                activeCategory = cat.id;
                chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                applyFormulaFilter();
            });
            chipsEl.appendChild(chip);
        });
    }

    if (formulaSearchEl) {
        formulaSearchEl.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            applyFormulaFilter();
        });
    }

    applyFormulaFilter();
} catch (e) {
    // Справочник должен остаться читаемым даже при сбое рендеринга
    console.error('Ошибка инициализации справочника формул:', e);
} }

// ================= ТЕОРИЯ: ХАБ РАЗДЕЛОВ =================
const theoryHubEl = document.getElementById('theory-hub');

if (theoryHubEl && typeof theoryData !== 'undefined') {
    theoryData.forEach((section, index) => {
        const card = document.createElement('a');
        card.classList.add('theory-hub-card');
        card.href = section.page;

        const num = document.createElement('span');
        num.classList.add('theory-hub-card__num');
        num.textContent = String(index + 1).padStart(2, '0');
        card.appendChild(num);

        const title = document.createElement('h3');
        title.classList.add('theory-hub-card__title');
        title.textContent = section.title;
        card.appendChild(title);

        const desc = document.createElement('p');
        desc.classList.add('theory-hub-card__desc');
        desc.textContent = section.description;
        card.appendChild(desc);

        const meta = document.createElement('span');
        meta.classList.add('theory-hub-card__meta');
        meta.textContent = section.topics.length + ' ' +
            (section.topics.length === 1 ? 'тема' : section.topics.length < 5 ? 'темы' : 'тем') + ' →';
        card.appendChild(meta);

        theoryHubEl.appendChild(card);
    });
}

// ================= ТЕОРИЯ: СТРАНИЦА РАЗДЕЛА =================
const theoryPageEl = document.querySelector('.theory-page');
const theoryContentEl = document.getElementById('theory-content');

if (theoryPageEl && theoryContentEl && typeof theoryData !== 'undefined') { try {
    const section = theoryData.find(s => s.id === theoryPageEl.dataset.section);
    if (!section) throw new Error('Раздел теории не найден: ' + theoryPageEl.dataset.section);

    function findGlossaryEntry(name) {
        if (typeof glossaryData === 'undefined') return null;
        const query = name.toLowerCase();
        return glossaryData.find(g => g.term.toLowerCase().includes(query)) || null;
    }

    // Разбор маркеров {{term:…}} и {{formula:…}} внутри текста —
    // строится DOM, никакой интерполяции HTML.
    function appendRichText(parent, str) {
        const markerRe = /\{\{(term|formula):([^}|]+)(?:\|([^}]+))?\}\}/g;
        let lastIndex = 0;
        let match;
        while ((match = markerRe.exec(str)) !== null) {
            if (match.index > lastIndex) {
                parent.appendChild(document.createTextNode(str.slice(lastIndex, match.index)));
            }
            const link = document.createElement('a');
            link.textContent = match[3] || match[2];
            if (match[1] === 'term') {
                link.classList.add('term-link');
                link.href = 'glossary.html?q=' + encodeURIComponent(match[2]);
                const entry = findGlossaryEntry(match[2]);
                if (entry) link.title = entry.definition;
            } else {
                link.classList.add('formula-link');
                link.href = 'formulas.html#formula-' + match[2];
            }
            parent.appendChild(link);
            lastIndex = markerRe.lastIndex;
        }
        if (lastIndex < str.length) {
            parent.appendChild(document.createTextNode(str.slice(lastIndex)));
        }
    }

    function buildBlock(block) {
        if (block.type === 'text') {
            const fragment = document.createDocumentFragment();
            block.text.split('\n\n').forEach(par => {
                const p = document.createElement('p');
                p.classList.add('theory-paragraph');
                appendRichText(p, par);
                fragment.appendChild(p);
            });
            return fragment;
        }

        if (block.type === 'formula') {
            const formula = (typeof formulasData !== 'undefined')
                ? formulasData.find(f => f.id === block.ref)
                : null;
            const embed = document.createElement('div');
            embed.classList.add('formula-embed');
            if (!formula) return embed;

            const math = document.createElement('div');
            math.classList.add('formula-embed__math');
            renderMath(math, formula.latex, true);
            embed.appendChild(math);

            const foot = document.createElement('div');
            foot.classList.add('formula-embed__foot');
            const refLink = document.createElement('a');
            refLink.href = 'formulas.html#formula-' + formula.id;
            refLink.textContent = formula.title + ' — подробнее в справочнике →';
            foot.appendChild(refLink);
            if (formula.calcLink) {
                const calcLink = document.createElement('a');
                calcLink.href = formula.calcLink.href;
                calcLink.textContent = formula.calcLink.label + ' →';
                foot.appendChild(calcLink);
            }
            embed.appendChild(foot);
            return embed;
        }

        if (block.type === 'table') {
            const wrapper = document.createElement('div');
            wrapper.classList.add('data-table-wrap');
            const table = document.createElement('table');
            table.classList.add('data-table');
            if (block.caption) {
                const caption = document.createElement('caption');
                caption.textContent = block.caption;
                table.appendChild(caption);
            }
            const thead = table.createTHead();
            const headRow = thead.insertRow();
            block.head.forEach(cell => {
                const th = document.createElement('th');
                th.textContent = cell;
                headRow.appendChild(th);
            });
            const tbody = table.createTBody();
            block.rows.forEach(row => {
                const tr = tbody.insertRow();
                row.forEach(cell => { tr.insertCell().textContent = cell; });
            });
            wrapper.appendChild(table);
            return wrapper;
        }

        if (block.type === 'note') {
            const note = document.createElement('p');
            note.classList.add('theory-note');
            appendRichText(note, block.text);
            return note;
        }

        return document.createDocumentFragment();
    }

    // Контент раздела
    section.topics.forEach(topic => {
        const topicEl = document.createElement('article');
        topicEl.classList.add('theory-topic');

        const heading = document.createElement('h2');
        heading.classList.add('theory-topic__title');
        heading.id = topic.id;
        heading.textContent = topic.title;
        topicEl.appendChild(heading);

        topic.blocks.forEach(block => topicEl.appendChild(buildBlock(block)));
        theoryContentEl.appendChild(topicEl);
    });

    // Оглавление с подсветкой текущей темы при прокрутке
    const tocEl = document.getElementById('theory-toc');
    if (tocEl) {
        const tocTitle = document.createElement('p');
        tocTitle.classList.add('theory-toc__title');
        tocTitle.textContent = 'Содержание';
        tocEl.appendChild(tocTitle);

        const list = document.createElement('ul');
        list.classList.add('theory-toc__list');
        const tocLinks = new Map();
        section.topics.forEach(topic => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + topic.id;
            a.textContent = topic.title;
            li.appendChild(a);
            list.appendChild(li);
            tocLinks.set(topic.id, a);
        });
        tocEl.appendChild(list);

        if ('IntersectionObserver' in window) {
            const spy = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        tocLinks.forEach(link => link.classList.remove('active'));
                        const link = tocLinks.get(entry.target.id);
                        if (link) link.classList.add('active');
                    }
                });
            }, { rootMargin: '-20% 0px -70% 0px' });
            section.topics.forEach(topic => {
                const h = document.getElementById(topic.id);
                if (h) spy.observe(h);
            });
        }
    }

    // Навигация между разделами
    const pagerEl = document.getElementById('theory-pager');
    if (pagerEl) {
        const index = theoryData.indexOf(section);
        const prev = theoryData[index - 1];
        const next = theoryData[index + 1];
        if (prev) {
            const a = document.createElement('a');
            a.classList.add('theory-pager__link', 'theory-pager__link--prev');
            a.href = prev.page;
            a.textContent = '← ' + prev.title;
            pagerEl.appendChild(a);
        }
        if (next) {
            const a = document.createElement('a');
            a.classList.add('theory-pager__link', 'theory-pager__link--next');
            a.href = next.page;
            a.textContent = next.title + ' →';
            pagerEl.appendChild(a);
        }
    }

} catch (e) {
    console.error('Ошибка рендеринга раздела теории:', e);
} }

// ================= ГЛАВНАЯ: СТАТИСТИКА =================
(function renderHomeStats() {
    const questionsEl = document.getElementById('stat-questions');
    const termsEl = document.getElementById('stat-terms');
    const formulasEl = document.getElementById('stat-formulas');
    const sectionsEl = document.getElementById('stat-sections');
    if (sectionsEl && typeof theoryData !== 'undefined') {
        sectionsEl.textContent = theoryData.length;
    }
    if (questionsEl && typeof quizDataBasic !== 'undefined' && typeof quizDataEngineer !== 'undefined') {
        questionsEl.textContent = quizDataBasic.length + quizDataEngineer.length;
    }
    if (termsEl && typeof glossaryData !== 'undefined') {
        termsEl.textContent = glossaryData.length;
    }
    if (formulasEl && typeof formulasData !== 'undefined') {
        formulasEl.textContent = formulasData.length;
    }
})();

