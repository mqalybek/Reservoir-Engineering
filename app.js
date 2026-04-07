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
const btnStartQuiz = document.getElementById('btn-start-quiz');
const quizStartScreen = document.getElementById('quiz-start-screen');
const quizBox = document.getElementById('quiz-box');
const quizResultScreen = document.getElementById('quiz-result-screen');
const questionEl = document.getElementById('quiz-question');
const optionsEl = document.getElementById('quiz-options');
const counterEl = document.getElementById('quiz-counter');
const scoreEl = document.getElementById('quiz-score');
const btnNext = document.getElementById('btn-next-question');
const finalScoreEl = document.getElementById('final-score');
const btnRestart = document.getElementById('btn-restart-quiz');

const navDotsContainer = document.getElementById('quiz-nav-dots');
const btnPrev = document.getElementById('btn-prev-question');
const btnFinish = document.getElementById('btn-finish-quiz');

let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    if(typeof quizData !== 'undefined') {
        userAnswers = new Array(quizData.length).fill(null);
    }
    quizStartScreen.classList.add('hidden');
    quizResultScreen.classList.add('hidden');
    quizBox.classList.remove('hidden');
    scoreEl.textContent = score;
    renderNavDots();
    loadQuestion();
}

function renderNavDots() {
    if (!navDotsContainer) return;
    navDotsContainer.innerHTML = '';
    quizData.forEach((_, index) => {
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
        dot.className = 'quiz-dot'; // reset
        if (index === currentQuestionIndex) {
            dot.classList.add('active');
        } else if (userAnswers[index] !== null) {
            const isCorrect = userAnswers[index] === quizData[index].answer;
            dot.classList.add(isCorrect ? 'answered_correct' : 'answered_wrong');
        }
    });
}

function loadQuestion() {
    resetState();
    updateNavDots();
    const currentQuestion = quizData[currentQuestionIndex];
    counterEl.textContent = `Вопрос ${currentQuestionIndex + 1} из ${quizData.length}`;
    questionEl.textContent = currentQuestion.question;

    const answeredIndex = userAnswers[currentQuestionIndex];

    currentQuestion.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = option;
        button.classList.add('quiz__btn');
        if (index === currentQuestion.answer) {
            button.dataset.correct = true;
        }
        
        button.addEventListener('click', () => selectAnswer(index, button));
        optionsEl.appendChild(button);

        // Восстановление состояния, если уже отвечено
        if (answeredIndex !== null) {
            button.disabled = true;
            if (index === currentQuestion.answer) {
                button.classList.add('correct');
            } else if (index === answeredIndex) {
                button.classList.add('wrong');
            }
        }
    });

    updateButtonsVisibility();
}

function updateButtonsVisibility() {
    if(btnPrev) {
        if (currentQuestionIndex > 0) btnPrev.classList.remove('hidden');
        else btnPrev.classList.add('hidden');
    }
    
    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    if(btnNext) {
        if (isLastQuestion) btnNext.classList.add('hidden');
        else btnNext.classList.remove('hidden');
    }
    
    if(btnFinish) {
        const allAnswered = userAnswers.length > 0 && userAnswers.every(ans => ans !== null);
        if (isLastQuestion || allAnswered) btnFinish.classList.remove('hidden');
        else btnFinish.classList.add('hidden');
    }
}

function resetState() {
    if(btnNext) btnNext.classList.add('hidden');
    if(btnPrev) btnPrev.classList.add('hidden');
    if(btnFinish) btnFinish.classList.add('hidden');
    while (optionsEl.firstChild) {
        optionsEl.removeChild(optionsEl.firstChild);
    }
}

function selectAnswer(selectedIndex, selectedBtn) {
    if (userAnswers[currentQuestionIndex] !== null) return;

    const currentQuestion = quizData[currentQuestionIndex];
    const isCorrect = selectedIndex === currentQuestion.answer;
    
    userAnswers[currentQuestionIndex] = selectedIndex;

    if (isCorrect) {
        selectedBtn.classList.add('correct');
    } else {
        selectedBtn.classList.add('wrong');
    }

    // Блокируем кнопки и подсвечиваем правильный
    Array.from(optionsEl.children).forEach((button, i) => {
        if (i === currentQuestion.answer) {
            button.classList.add('correct');
        }
        button.disabled = true;
    });

    recalculateScore();
    updateNavDots();
    updateButtonsVisibility();
}

function recalculateScore() {
    score = 0;
    userAnswers.forEach((ans, idx) => {
        if (ans === quizData[idx].answer) score++;
    });
    scoreEl.textContent = score;
}

function handleNextButton() {
    if (currentQuestionIndex < quizData.length - 1) {
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

function handleFinishButton() {
    showResults();
}

function showResults() {
    quizBox.classList.add('hidden');
    quizResultScreen.classList.remove('hidden');
    
    recalculateScore();
    finalScoreEl.textContent = score;

    const currentMax = parseInt(localStorage.getItem('maxQuizScore') || '0');
    if (score > currentMax) {
        localStorage.setItem('maxQuizScore', score.toString());
        updateRankUI();
    }
}

if(btnStartQuiz) btnStartQuiz.addEventListener('click', startQuiz);
if(btnNext) btnNext.addEventListener('click', handleNextButton);
if(btnPrev) btnPrev.addEventListener('click', handlePrevButton);
if(btnFinish) btnFinish.addEventListener('click', handleFinishButton);
if(btnRestart) btnRestart.addEventListener('click', startQuiz);


// ================= ГЛОССАРИЙ =================

const glossaryListEl = document.getElementById('glossary-list');
const searchInput = document.getElementById('glossary-search-input');

function renderGlossary(data) {
    if (!glossaryListEl) return;
    glossaryListEl.innerHTML = '';
    
    if (data.length === 0) {
        glossaryListEl.innerHTML = '<p class="text-white">Термин не найден.</p>';
        return;
    }
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('glossary-item');
        div.innerHTML = `
            <span class="glossary-item__term">${item.term}</span>
            <span class="glossary-item__def">${item.definition}</span>
        `;
        glossaryListEl.appendChild(div);
    });
}

if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = glossaryData.filter(item => 
            item.term.toLowerCase().includes(query) || 
            item.definition.toLowerCase().includes(query)
        );
        renderGlossary(filtered);
    });
}

// Инициализация глоссария
if(typeof glossaryData !== 'undefined') {
    renderGlossary(glossaryData);
}



// ================= СИСТЕМА РАНГОВ =================
function updateRankUI() {
    const maxScore = parseInt(localStorage.getItem('maxQuizScore') || '0');
    const rankText = document.getElementById('rank-text');
    if (!rankText) return;

    if (maxScore === 0) {
        rankText.innerText = 'Новичок';
    } else if (maxScore <= 10) {
        rankText.innerText = 'Студент';
    } else if (maxScore <= 20) {
        rankText.innerText = 'Инженер';
    } else if (maxScore <= 29) {
        rankText.innerText = 'Главный геолог';
    } else {
        rankText.innerText = 'Эксперт 👑';
    }
}
// Вызываем при загрузке
updateRankUI();

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
    setTimeout(() => {
        fcTerm.innerText = glossaryData[index].term;
        fcDef.innerText = glossaryData[index].definition;
    }, 150);
}

if (flashcard && typeof glossaryData !== 'undefined') {
    renderFlashcard(0);

    flashcard.addEventListener('click', () => {
        flashcard.classList.toggle('is-flipped');
    });

    btnPrevCard.addEventListener('click', () => {
        currentFlashcardIndex = (currentFlashcardIndex - 1 + glossaryData.length) % glossaryData.length;
        renderFlashcard(currentFlashcardIndex);
    });

    btnNextCard.addEventListener('click', () => {
        currentFlashcardIndex = (currentFlashcardIndex + 1) % glossaryData.length;
        renderFlashcard(currentFlashcardIndex);
    });
}

// ================= КАЛЬКУЛЯТОРЫ =================
const btnCalcVol = document.getElementById('btn-calc-vol');
const btnCalcApi = document.getElementById('btn-calc-api');

if (btnCalcVol) {
    btnCalcVol.addEventListener('click', () => {
        const F = parseFloat(document.getElementById('calc-f').value) || 0;
        const h = parseFloat(document.getElementById('calc-h').value) || 0;
        const m = parseFloat(document.getElementById('calc-m').value) || 0;
        const beta = parseFloat(document.getElementById('calc-beta').value) || 0;
        const gamma = parseFloat(document.getElementById('calc-gamma').value) || 0;
        const theta = parseFloat(document.getElementById('calc-theta').value) || 0;

        const qn = F * h * m * beta * gamma * theta;
        document.getElementById('res-vol').innerText = Math.round(qn).toLocaleString('ru-RU') + ' тыс. т';
    });
}

if (btnCalcApi) {
    btnCalcApi.addEventListener('click', () => {
        const api = parseFloat(document.getElementById('calc-api').value) || 10;
        const sg = 141.5 / (api + 131.5);
        const density = sg * 1000;
        document.getElementById('res-api').innerText = density.toFixed(2) + ' кг/м³';
    });
}

// ================= АНИМАЦИИ ПРИ СКРОЛЛЕ =================
document.addEventListener("DOMContentLoaded", () => {
    const fadeElements = document.querySelectorAll('.fade-up');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    fadeElements.forEach(el => observer.observe(el));
});
