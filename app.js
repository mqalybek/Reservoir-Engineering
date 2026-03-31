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
