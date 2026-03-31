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

let currentQuestionIndex = 0;
let score = 0;

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    quizStartScreen.classList.add('hidden');
    quizResultScreen.classList.add('hidden');
    quizBox.classList.remove('hidden');
    scoreEl.textContent = score;
    loadQuestion();
}

function loadQuestion() {
    resetState();
    const currentQuestion = quizData[currentQuestionIndex];
    counterEl.textContent = `Вопрос ${currentQuestionIndex + 1} из ${quizData.length}`;
    questionEl.textContent = currentQuestion.question;

    currentQuestion.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = option;
        button.classList.add('quiz__btn');
        if (index === currentQuestion.answer) {
            button.dataset.correct = true;
        }
        button.addEventListener('click', selectAnswer);
        optionsEl.appendChild(button);
    });
}

function resetState() {
    btnNext.classList.add('hidden');
    while (optionsEl.firstChild) {
        optionsEl.removeChild(optionsEl.firstChild);
    }
}

function selectAnswer(e) {
    const selectedBtn = e.target;
    const isCorrect = selectedBtn.dataset.correct === "true";
    
    if (isCorrect) {
        selectedBtn.classList.add('correct');
        score++;
        scoreEl.textContent = score;
    } else {
        selectedBtn.classList.add('wrong');
    }

    // Подсвечиваем правильный и блокируем все кнопки
    Array.from(optionsEl.children).forEach(button => {
        if (button.dataset.correct === "true") {
            button.classList.add('correct');
        }
        button.disabled = true;
    });

    btnNext.classList.remove('hidden');
}

function handleNextButton() {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizData.length) {
        loadQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    quizBox.classList.add('hidden');
    quizResultScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;

    // Сохранение Рангов (прогресс)
    const currentMax = parseInt(localStorage.getItem('maxQuizScore') || '0');
    if (score > currentMax) {
        localStorage.setItem('maxQuizScore', score.toString());
        updateRankUI();
    }
}

if(btnStartQuiz) btnStartQuiz.addEventListener('click', startQuiz);
if(btnNext) btnNext.addEventListener('click', handleNextButton);
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
const btnCalcStooip = document.getElementById('btn-calc-stooip');
const btnCalcApi = document.getElementById('btn-calc-api');

if (btnCalcStooip) {
    btnCalcStooip.addEventListener('click', () => {
        const A = parseFloat(document.getElementById('calc-area').value) || 0;
        const h = parseFloat(document.getElementById('calc-h').value) || 0;
        const poro = parseFloat(document.getElementById('calc-poro').value) || 0;
        const So = parseFloat(document.getElementById('calc-so').value) || 0;
        const Bo = parseFloat(document.getElementById('calc-bo').value) || 1;

        const stooip = (7758 * A * h * poro * So) / Bo;
        document.getElementById('res-stooip').innerText = Math.round(stooip).toLocaleString('ru-RU') + ' STB';
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
