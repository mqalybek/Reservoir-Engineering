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
const btnStartGdis = document.getElementById('btn-start-gdis');
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

// Тип вопроса: 'single' | 'multi' | 'matrix'. Явное поле `type` в данных
// имеет приоритет; иначе определяем по форме answer (обратная совместимость
// со старыми данными quizDataBasic/quizDataEngineer, где type не указан).
function getQuestionType(q) {
    if (q.type) return q.type;
    return Array.isArray(q.answer) ? 'multi' : 'single';
}

// Правильный ответ ещё не известен (answer: null) — вопрос показывается,
// но не участвует в подсчёте баллов и не подсвечивается верно/неверно.
function hasKnownAnswer(q) {
    return q.answer !== null && q.answer !== undefined;
}

function isMultiQuestion(q) {
    return getQuestionType(q) === 'multi';
}

// Готовит копию теста: перемешивает вопросы и варианты ответов,
// пересчитывая индексы правильных ответов под новый порядок.
// Матричные вопросы (type: 'matrix') не перемешиваются — их строки/
// столбцы образуют таблицу, порядок которой важен для восприятия.
function prepareQuizData(sourceData) {
    return shuffleArray(sourceData).map(q => {
        if (getQuestionType(q) === 'matrix') return q;
        const order = shuffleArray(q.options.map((_, i) => i));
        return {
            question: q.question,
            options: order.map(i => q.options[i]),
            answer: !hasKnownAnswer(q)
                ? null
                : (Array.isArray(q.answer) ? q.answer.map(a => order.indexOf(a)) : order.indexOf(q.answer)),
            type: q.type
        };
    });
}

// Состояние ответа: single — number | null; multi — { selected: number[], locked: boolean } | null;
// matrix — { [название строки]: название столбца } | null.
// «Заблокирован» здесь означает «зафиксирован как окончательный» для целей
// точек навигации/прогресс-бара — не обязательно запрещает дальнейшее
// редактирование (см. isEditable) для вопросов без известного ответа.
function isAnswerLocked(answerState, question) {
    if (answerState === null || answerState === undefined) return false;
    const type = getQuestionType(question);
    if (type === 'matrix') {
        return question.rows.every(r => answerState[r] !== undefined);
    }
    if (type === 'multi') {
        return hasKnownAnswer(question) ? answerState.locked : answerState.selected.length > 0;
    }
    return true;
}

// Можно ли ещё менять ответ. Пока правильный ответ не известен —
// разрешаем менять выбор сколько угодно раз (нечего блокировать).
function isEditable(answerState, question) {
    if (!hasKnownAnswer(question)) return true;
    return !isAnswerLocked(answerState, question);
}

function isAnswerCorrect(answerState, question) {
    if (!isAnswerLocked(answerState, question)) return false;
    if (!hasKnownAnswer(question)) return false;
    const type = getQuestionType(question);
    if (type === 'matrix') {
        return question.rows.every(r => answerState[r] === question.answer[r]);
    }
    if (type === 'multi') {
        return question.answer.every(a => answerState.selected.includes(a)) &&
               answerState.selected.every(a => question.answer.includes(a));
    }
    return answerState === question.answer;
}

function startQuiz(type) {
    if (type) currentTestType = type;

    const source = currentTestType === 'engineer'
        ? (typeof quizDataEngineer !== 'undefined' ? quizDataEngineer : [])
        : currentTestType === 'gdis'
        ? (typeof quizDataGdis !== 'undefined' ? quizDataGdis : [])
        : (typeof quizDataBasic !== 'undefined' ? quizDataBasic : []);
    if (!source.length) return;

    currentQuestionIndex = 0;
    score = 0;
    currentQuizData = prepareQuizData(source);
    userAnswers = new Array(currentQuizData.length).fill(null);

    // Пока ни у одного вопроса теста нет известного ответа, счёт
    // во время прохождения не показываем — «Счёт: 0» выглядел бы
    // так, будто все ответы неверны.
    const scoreWrapEl = document.getElementById('quiz-score-wrap');
    if (scoreWrapEl) scoreWrapEl.classList.toggle('hidden', !currentQuizData.some(hasKnownAnswer));

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
            return;
        }
        const state = userAnswers[index];
        const q = currentQuizData[index];
        if (!isAnswerLocked(state, q)) return;
        if (!hasKnownAnswer(q)) {
            dot.classList.add('answered_neutral');
        } else {
            dot.classList.add(isAnswerCorrect(state, q) ? 'answered_correct' : 'answered_wrong');
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
    const type = getQuestionType(currentQuestion);
    const graded = hasKnownAnswer(currentQuestion);

    if (type === 'matrix') {
        renderMatrixQuestion(currentQuestion, answerState, graded);
        updateButtonsVisibility();
        return;
    }

    const isMulti = type === 'multi';

    if (isMulti && graded) {
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

        if (!graded) {
            // Ответ ещё не задан: только подсвечиваем текущий выбор,
            // без «верно/неверно» и без блокировки — можно менять свободно.
            if (isMulti) {
                if (answerState && answerState.selected.includes(index)) {
                    button.classList.add('selected');
                }
            } else if (answerState === index) {
                button.classList.add('selected');
            }
            return;
        }

        // Восстановление состояния при возврате к вопросу (с известным ответом)
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

// Матричный вопрос (тип 'matrix'): таблица rows × columns, одна
// радиокнопка на пересечении на строку. Общий name у радио в строке
// даёт нативный «выбор одного варианта» и доступность из коробки.
function renderMatrixQuestion(question, answerState, graded) {
    if (question.image) {
        const figure = document.createElement('figure');
        figure.classList.add('quiz-question-figure');
        const img = document.createElement('img');
        img.src = question.image;
        img.alt = question.imageAlt || '';
        img.loading = 'lazy';
        img.classList.add('quiz-question-image');
        figure.appendChild(img);
        if (question.imageCaption) {
            const caption = document.createElement('figcaption');
            caption.textContent = question.imageCaption;
            figure.appendChild(caption);
        }
        optionsEl.appendChild(figure);
    }

    const wrap = document.createElement('div');
    wrap.classList.add('quiz-matrix-wrap');
    const table = document.createElement('table');
    table.classList.add('quiz-matrix');

    const thead = table.createTHead();
    const headRow = thead.insertRow();
    headRow.insertCell();
    question.columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headRow.appendChild(th);
    });

    const tbody = table.createTBody();
    const state = answerState || {};
    const editable = isEditable(answerState, question);

    question.rows.forEach((rowName, rowIdx) => {
        const tr = tbody.insertRow();
        const rowTh = document.createElement('th');
        rowTh.scope = 'row';
        rowTh.textContent = rowName;
        tr.appendChild(rowTh);

        question.columns.forEach(colName => {
            const td = tr.insertCell();
            const label = document.createElement('label');
            label.classList.add('quiz-matrix__cell');

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'matrix-' + currentQuestionIndex + '-' + rowIdx;
            input.checked = state[rowName] === colName;
            input.disabled = !editable;
            input.addEventListener('change', () => selectMatrixCell(rowName, colName));
            label.appendChild(input);

            if (graded) {
                const isCorrectCell = question.answer && question.answer[rowName] === colName;
                const isUserCell = state[rowName] === colName;
                if (isCorrectCell) label.classList.add('correct');
                else if (isUserCell) label.classList.add('wrong');
            }

            td.appendChild(label);
        });
    });

    wrap.appendChild(table);
    optionsEl.appendChild(wrap);
}

function selectMatrixCell(row, col) {
    const question = currentQuizData[currentQuestionIndex];
    const state = userAnswers[currentQuestionIndex];
    if (!isEditable(state, question)) return;
    if (!userAnswers[currentQuestionIndex]) userAnswers[currentQuestionIndex] = {};
    userAnswers[currentQuestionIndex][row] = col;
    afterAnswerLocked();
    loadQuestion();
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

// Ответ ещё не задан: свободно переключаем выбор (multi — как чекбоксы,
// single — как радио), без блокировки и подсветки правильности.
function selectUngraded(type, selectedIndex) {
    const idx = currentQuestionIndex;
    if (type === 'multi') {
        if (!userAnswers[idx]) userAnswers[idx] = { selected: [] };
        const selected = userAnswers[idx].selected;
        const pos = selected.indexOf(selectedIndex);
        if (pos === -1) selected.push(selectedIndex); else selected.splice(pos, 1);
    } else {
        userAnswers[idx] = selectedIndex;
    }
    afterAnswerLocked();
    loadQuestion();
}

function selectAnswer(selectedIndex, selectedBtn) {
    const currentQuestion = currentQuizData[currentQuestionIndex];

    if (!hasKnownAnswer(currentQuestion)) {
        selectUngraded(getQuestionType(currentQuestion), selectedIndex);
        return;
    }

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
    score = userAnswers.reduce((acc, ans, idx) => {
        const q = currentQuizData[idx];
        return (hasKnownAnswer(q) && isAnswerCorrect(ans, q)) ? acc + 1 : acc;
    }, 0);
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

function formatMatrixPairs(question, pairs) {
    return question.rows
        .map(r => `${r} → ${pairs && pairs[r] !== undefined ? pairs[r] : '—'}`)
        .join('; ');
}

function formatUserAnswer(q, state) {
    const type = getQuestionType(q);
    if (type === 'matrix') {
        return state ? formatMatrixPairs(q, state) : '— (нет ответа)';
    }
    if (type === 'multi') {
        return (state && state.selected && state.selected.length)
            ? formatAnswer(q, state.selected)
            : '— (нет ответа)';
    }
    return (state === null || state === undefined) ? '— (нет ответа)' : q.options[state];
}

function formatCorrectAnswer(q) {
    const type = getQuestionType(q);
    if (type === 'matrix') return formatMatrixPairs(q, q.answer);
    return formatAnswer(q, type === 'multi' ? q.answer : [q.answer]);
}

function renderReview() {
    if (!reviewEl) return;
    reviewEl.innerHTML = '';

    const mistakes = [];
    const ungradedAnswered = [];

    currentQuizData.forEach((q, idx) => {
        const state = userAnswers[idx];
        if (hasKnownAnswer(q)) {
            if (!isAnswerCorrect(state, q)) mistakes.push({ q, state });
        } else if (isAnswerLocked(state, q)) {
            ungradedAnswered.push({ q, state });
        }
    });

    function appendSection(title, items, extraItemClass) {
        const heading = document.createElement('h3');
        heading.classList.add('quiz-review__title');
        heading.textContent = title;
        reviewEl.appendChild(heading);

        items.forEach(({ q, state }) => {
            const item = document.createElement('div');
            item.classList.add('quiz-review__item');
            if (extraItemClass) item.classList.add(extraItemClass);

            const questionP = document.createElement('p');
            questionP.classList.add('quiz-review__question');
            questionP.textContent = q.question;
            item.appendChild(questionP);

            const userP = document.createElement('p');
            userP.classList.add('quiz-review__answer', 'quiz-review__answer--user');
            userP.textContent = 'Ваш ответ: ' + formatUserAnswer(q, state);
            item.appendChild(userP);

            if (hasKnownAnswer(q)) {
                const correctP = document.createElement('p');
                correctP.classList.add('quiz-review__answer', 'quiz-review__answer--correct');
                correctP.textContent = 'Правильный ответ: ' + formatCorrectAnswer(q);
                item.appendChild(correctP);
            }

            reviewEl.appendChild(item);
        });
    }

    if (mistakes.length > 0) {
        appendSection(`Разбор ошибок (${mistakes.length})`, mistakes);
    }
    if (ungradedAnswered.length > 0) {
        appendSection(
            `Ваши ответы (${ungradedAnswered.length}) — ключ ответа ещё не добавлен`,
            ungradedAnswered,
            'quiz-review__item--neutral'
        );
    }
}

function showResults() {
    quizBox.classList.add('hidden');
    quizResultScreen.classList.remove('hidden');

    recalculateScore();
    const gradedCount = currentQuizData.filter(hasKnownAnswer).length;

    const resultTextEl = document.querySelector('.quiz-result__text');
    const ungradedNoteEl = document.getElementById('quiz-result-ungraded-note');

    if (gradedCount === 0) {
        // Ни у одного вопроса пока нет ключа ответа — показываем
        // нейтральное сообщение вместо «0 из N», которое выглядело бы
        // как провал.
        if (resultTextEl) resultTextEl.classList.add('hidden');
        if (ungradedNoteEl) ungradedNoteEl.classList.remove('hidden');
        if (finalVerdictEl) {
            finalVerdictEl.textContent = 'Вы прошли все вопросы. Как только появятся правильные ответы, результат будет посчитан автоматически.';
        }
    } else {
        if (resultTextEl) resultTextEl.classList.remove('hidden');
        if (ungradedNoteEl) ungradedNoteEl.classList.add('hidden');
        const percent = Math.round((score / gradedCount) * 100);
        finalScoreEl.textContent = `${score} из ${gradedCount}`;
        if (finalPercentEl) finalPercentEl.textContent = percent + '%';
        if (finalVerdictEl) finalVerdictEl.textContent = getVerdict(percent);
    }

    renderReview();
    if (gradedCount > 0) saveBestResult(currentTestType, score, gradedCount);
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
        { type: 'engineer', data: typeof quizDataEngineer !== 'undefined' ? quizDataEngineer : null },
        { type: 'gdis', data: typeof quizDataGdis !== 'undefined' ? quizDataGdis : null }
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
if (btnStartGdis) btnStartGdis.addEventListener('click', () => startQuiz('gdis'));
if (btnNext) btnNext.addEventListener('click', handleNextButton);
if (btnPrev) btnPrev.addEventListener('click', handlePrevButton);
if (btnFinish) btnFinish.addEventListener('click', showResults);
if (btnRestart) btnRestart.addEventListener('click', () => startQuiz());
if (btnBackToTests) btnBackToTests.addEventListener('click', backToTestSelection);

// ================= ГЛОССАРИЙ =================
const glossaryListEl = document.getElementById('glossary-list');
const searchInput = document.getElementById('glossary-search-input');

if (glossaryListEl && typeof glossaryData !== 'undefined') {
    const azEl = document.getElementById('glossary-az');
    const countEl = document.getElementById('glossary-count');

    // Термины отсортированы по алфавиту (кириллица, затем латиница).
    const sortedTerms = glossaryData.slice().sort((a, b) => a.term.localeCompare(b.term, 'ru'));
    // Кириллические термины — по своей букве; термины на латинице (PVT и т.п.)
    // собираются в один бакет «A-Z», чтобы латинская P не дублировала русскую Р.
    const firstLetter = term => {
        const c = term[0].toUpperCase();
        return /[A-Z]/.test(c) ? 'A-Z' : c;
    };

    let letterFilter = 'all';   // 'all' или конкретная буква
    let searchQuery = '';

    function renderGlossary(data, expand) {
        glossaryListEl.innerHTML = '';
        if (data.length === 0) {
            const empty = document.createElement('p');
            empty.classList.add('glossary-empty');
            empty.textContent = 'Термин не найден.';
            glossaryListEl.appendChild(empty);
            return;
        }
        data.forEach(item => {
            const details = document.createElement('details');
            details.classList.add('glossary-item');
            if (expand) details.open = true;

            const summary = document.createElement('summary');
            summary.classList.add('glossary-item__term');
            summary.textContent = item.term;

            const def = document.createElement('div');
            def.classList.add('glossary-item__def');
            def.textContent = item.definition;

            details.append(summary, def);
            glossaryListEl.appendChild(details);
        });
    }

    function applyGlossaryFilter() {
        const filtered = sortedTerms.filter(item => {
            const matchesLetter = letterFilter === 'all' || firstLetter(item.term) === letterFilter;
            const matchesSearch = !searchQuery ||
                item.term.toLowerCase().includes(searchQuery) ||
                item.definition.toLowerCase().includes(searchQuery);
            return matchesLetter && matchesSearch;
        });
        // Раскрываем определения, если фильтр сузил список (поиск или буква).
        const expand = searchQuery.length > 0 || (letterFilter !== 'all' && filtered.length <= 8);
        renderGlossary(filtered, expand);
        if (countEl) {
            countEl.textContent = filtered.length === sortedTerms.length
                ? `Всего терминов: ${sortedTerms.length}`
                : `Показано: ${filtered.length} из ${sortedTerms.length}`;
        }
    }

    // Алфавитный указатель: кнопка «Все» + буквы, реально встречающиеся в терминах.
    if (azEl) {
        const letters = Array.from(new Set(sortedTerms.map(item => firstLetter(item.term))))
            .sort((a, b) => a.localeCompare(b, 'ru'));
        // Латинский бакет «A-Z» — в конец указателя.
        const azIndex = letters.indexOf('A-Z');
        if (azIndex > -1) letters.push(letters.splice(azIndex, 1)[0]);

        function makeAzButton(label, value) {
            const btn = document.createElement('button');
            btn.classList.add('glossary-az__btn');
            btn.textContent = label;
            if (value === 'all') btn.classList.add('active');
            btn.dataset.value = value;
            btn.addEventListener('click', () => {
                letterFilter = value;
                azEl.querySelectorAll('.glossary-az__btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyGlossaryFilter();
            });
            return btn;
        }

        azEl.appendChild(makeAzButton('Все', 'all'));
        letters.forEach(l => azEl.appendChild(makeAzButton(l, l)));
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            // При активном поиске сбрасываем буквенный фильтр на «Все».
            if (searchQuery && letterFilter !== 'all' && azEl) {
                letterFilter = 'all';
                azEl.querySelectorAll('.glossary-az__btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.value === 'all'));
            }
            applyGlossaryFilter();
        });
    }

    // Поддержка ссылок вида glossary.html?q=термин (из теории).
    const params = new URLSearchParams(window.location.search);
    const query = (params.get('q') || '').trim();
    if (query && searchInput) {
        searchInput.value = query;
        searchQuery = query.toLowerCase();
    }
    applyGlossaryFilter();
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

// ================= КАЛЬКУЛЯТОРЫ: ВЫБОР =================
// Сначала показываем экран выбора, затем — один выбранный калькулятор.
// Логика самих расчётов ниже не меняется: элементы всегда в DOM.
const calcChooserEl = document.getElementById('calc-chooser');
if (calcChooserEl) {
    const panelsEl = document.getElementById('calc-panels');
    const backBtn = document.getElementById('calc-back');
    const calcCards = Array.from(panelsEl.querySelectorAll('.calc-card'));

    function openCalc(id) {
        const target = document.getElementById(id);
        if (!target || !target.classList.contains('calc-card')) return false;
        calcCards.forEach(c => c.classList.toggle('hidden', c !== target));
        calcChooserEl.classList.add('hidden');
        panelsEl.classList.remove('hidden');
        return true;
    }

    function showChooser() {
        panelsEl.classList.add('hidden');
        calcChooserEl.classList.remove('hidden');
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }
    }

    calcChooserEl.querySelectorAll('.calc-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            if (openCalc(tile.dataset.target)) {
                history.replaceState(null, '', '#' + tile.dataset.target);
            }
        });
    });

    if (backBtn) backBtn.addEventListener('click', showChooser);

    // Прямая ссылка вида calculators.html#calc-card-darcy (из справочника
    // формул) — сразу открывает нужный калькулятор.
    function openCalcFromHash() {
        const id = window.location.hash.slice(1);
        if (id) openCalc(id);
    }
    openCalcFromHash();
    window.addEventListener('hashchange', openCalcFromHash);
}

// ================= КАЛЬКУЛЯТОРЫ: РАСЧЁТЫ =================
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
        // Сворачиваемая карточка: в свёрнутом виде видно название и
        // формулу, детали (переменные, примечание, источник) — по клику.
        const card = document.createElement('details');
        card.classList.add('formula-card');
        card.id = 'formula-' + formula.id;
        card.dataset.category = formula.category;
        card.dataset.search = [
            formula.title,
            formula.note || '',
            (formula.variables || []).map(v => v.name).join(' ')
        ].join(' ').toLowerCase();

        const summary = document.createElement('summary');
        summary.classList.add('formula-card__summary');

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
            // Клик по ссылке ведёт в калькулятор, а не сворачивает карточку.
            link.addEventListener('click', (e) => e.stopPropagation());
            head.appendChild(link);
        }
        summary.appendChild(head);

        const math = document.createElement('div');
        math.classList.add('formula-math');
        renderMath(math, formula.latex, true);
        summary.appendChild(math);
        card.appendChild(summary);

        const body = document.createElement('div');
        body.classList.add('formula-card__body');

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
            body.appendChild(table);
        }

        if (formula.note) {
            const note = document.createElement('p');
            note.classList.add('formula-note');
            note.textContent = formula.note;
            body.appendChild(note);
        }

        if (formula.source) {
            const source = document.createElement('p');
            source.classList.add('formula-source');
            source.textContent = 'Источник: ' + formula.source;
            body.appendChild(source);
        }

        card.appendChild(body);
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

    // Переход по якорю #formula-xxx (например, из теории): раскрыть и
    // подсветить нужную карточку.
    function openFormulaFromHash() {
        const hash = window.location.hash;
        if (!hash.startsWith('#formula-')) return;
        const target = document.getElementById(hash.slice(1));
        if (target && target.tagName === 'DETAILS') {
            target.open = true;
            target.scrollIntoView({ block: 'start' });
        }
    }
    openFormulaFromHash();
    window.addEventListener('hashchange', openFormulaFromHash);
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

