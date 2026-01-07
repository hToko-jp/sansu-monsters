// Initialize Database Reference
// (Firebase is already initialized in firebase-config.js)
const db = firebase.database();

class AudioController {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }

    init() {
        if (!this.initialized) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        }
    }

    playTone(freq, type, duration, startTime = 0) {
        if (!this.initialized) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playCorrect(combo) {
        // Success chord (C major-ish)
        this.playTone(523.25, 'sine', 0.1, 0); // C5
        this.playTone(659.25, 'sine', 0.1, 0.05); // E5

        // Pitch goes up with combo
        if (combo > 1) {
            const bonusPitch = Math.min(combo * 50, 500);
            this.playTone(1046.5 + bonusPitch, 'triangle', 0.2, 0.1);
        }
    }

    playWrong() {
        // Dissonant low tone
        this.playTone(150, 'sawtooth', 0.2, 0);
        this.playTone(142, 'sawtooth', 0.2, 0.05);
    }
}

class Game {
    constructor() {
        this.audio = new AudioController();
        this.combo = 0;
        this.score = 0;
        this.timeLeft = 60;
        this.isPlaying = false;
        this.timerInterval = null;
        this.currentProblem = {};
        this.userInput = "";


        // DOM Elements
        this.screens = {
            start: document.getElementById('start-screen'),
            game: document.getElementById('game-screen'),
            result: document.getElementById('result-screen'),
            ranking: document.getElementById('ranking-screen')
        };
        this.scoreEl = document.getElementById('score');
        this.timerEl = document.getElementById('timer');
        this.equationEl = document.getElementById('equation');
        this.finalScoreEl = document.getElementById('final-score');
        this.feedbackEl = document.getElementById('feedback');
        this.comboEl = document.getElementById('combo-display');


        // High Score Elements
        this.playerNameInput = document.getElementById('player-name');
        this.saveScoreBtn = document.getElementById('save-score-btn');
        this.rankingListEl = document.getElementById('ranking-list');
        this.restartBtn = document.getElementById('restart-btn');

        // Bind events
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('ranking-btn').addEventListener('click', () => this.showRanking());
        document.getElementById('back-home-btn').addEventListener('click', () => this.reset());

        this.saveScoreBtn.addEventListener('click', () => this.saveScoreHandler());
        this.restartBtn.addEventListener('click', () => {
            this.reset();
        });

        // Input setup
        this.setupInputs();
    }

    setupInputs() {
        // On-screen buttons
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.dataset.val;
                const action = e.target.dataset.action;

                if (action === 'delete') {
                    this.handleInput('Backspace');
                } else if (action === 'enter') {
                    this.handleInput('Enter');
                } else if (val !== undefined) {
                    this.handleInput(val);
                }
            });
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (this.isPlaying) {
                if ((e.key >= '0' && e.key <= '9') || e.key === 'Backspace' || e.key === 'Enter') {
                    this.handleInput(e.key);
                }
            }
        });
    }

    handleInput(key) {
        if (!this.isPlaying) return;

        if (key === 'Enter') {
            this.checkAnswer();
        } else if (key === 'Backspace') {
            this.userInput = this.userInput.slice(0, -1);
            this.updateDisplay();
        } else {
            // Limit input length to 3 digits
            if (this.userInput.length < 3) {
                this.userInput += key;
                this.updateDisplay();
            }
        }
    }

    start() {
        // Initialize Audio Context on user interaction
        this.audio.init();

        this.score = 0;
        this.combo = 0;
        this.timeLeft = 60;
        this.isPlaying = true;
        this.userInput = "";

        this.updateScore();
        this.updateTimer();

        this.switchScreen('game');
        this.nextProblem();

        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            if (this.timeLeft <= 0) {
                this.end();
            }
        }, 1000);
    }

    reset() {
        this.switchScreen('start');
    }

    end() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        this.finalScoreEl.textContent = this.score;
        this.playerNameInput.value = "";

        this.saveScoreBtn.parentElement.classList.remove('hidden');
        this.restartBtn.classList.add('hidden');
        this.restartBtn.textContent = "ほぞん せずに もどる";
        this.restartBtn.classList.remove('hidden');

        this.switchScreen('result');
    }

    showRanking() {
        this.switchScreen('ranking');
        this.renderRanking();
    }

    saveScoreHandler() {
        const name = this.playerNameInput.value.trim() || "名無しさん";

        this.saveScoreBtn.disabled = true;
        this.saveScoreBtn.textContent = "そうしんちゅう...";

        // Use Compat Reference style
        const scoresRef = db.ref('scores');
        scoresRef.push({
            name: name,
            score: this.score,
            date: new Date().toISOString()
        })
            .then(() => {
                this.saveScoreBtn.disabled = false;
                this.saveScoreBtn.textContent = "きろく する";
                this.showRanking();
            })
            .catch((error) => {
                console.error("Error saving score: ", error);
                alert("エラー: スコアの保存に失敗しました。インターネット接続を確認してください。");
                this.saveScoreBtn.disabled = false;
                this.saveScoreBtn.textContent = "リトライ";
            });
    }

    renderRanking() {
        this.rankingListEl.innerHTML = '<div class="ranking-item" style="justify-content:center;">読み込み中...</div>';

        const scoresRef = db.ref('scores');
        // Order by score, get last 20 (highest, since default sort is ascending)
        scoresRef.orderByChild('score').limitToLast(20).once('value')
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    let scoreArray = [];
                    Object.keys(data).forEach(key => {
                        scoreArray.push(data[key]);
                    });

                    // Sort descending (b.score - a.score)
                    scoreArray.sort((a, b) => b.score - a.score);

                    let html = `
                    <div class="ranking-item header">
                        <span class="rank-num">#</span>
                        <span style="flex:1; text-align:left; padding-left:1rem;">Name</span>
                        <span>Score</span>
                    </div>
                `;

                    scoreArray.forEach((s, index) => {
                        const rank = index + 1;
                        let rankClass = "";
                        if (rank === 1) rankClass = "rank-1";
                        if (rank === 2) rankClass = "rank-2";
                        if (rank === 3) rankClass = "rank-3";

                        html += `
                        <div class="ranking-item ${rankClass}">
                            <span class="rank-num">${rank}</span>
                            <span style="flex:1; text-align:left; padding-left:1rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.name}</span>
                            <span>${s.score}</span>
                        </div>
                    `;
                    });

                    this.rankingListEl.innerHTML = html;
                } else {
                    this.rankingListEl.innerHTML = `
                    <div class="ranking-item header">
                         <span class="rank-num">#</span>
                         <span style="flex:1; text-align:left; padding-left:1rem;">Name</span>
                         <span>Score</span>
                    </div>
                    <div class="ranking-item" style="justify-content:center; opacity:0.6;">まだ データが ないよ</div>
                `;
                }
            })
            .catch((error) => {
                console.error("Error fetching ranking: ", error);
                this.rankingListEl.innerHTML = `<div class="ranking-item" style="justify-content:center; color:#ef4444;">エラー: データを取得できませんでした</div>`;
            });
    }

    switchScreen(screenName) {
        Object.values(this.screens).forEach(el => el.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }

    updateTimer() {
        this.timerEl.textContent = this.timeLeft;
        if (this.timeLeft <= 10) {
            this.timerEl.style.color = '#ef4444';
        } else {
            this.timerEl.style.color = '#ffffff';
        }
    }

    updateScore() {
        this.scoreEl.textContent = this.score;
        this.scoreEl.classList.remove('pop');
        void this.scoreEl.offsetWidth;
        this.scoreEl.classList.add('pop');
    }

    nextProblem() {
        this.userInput = "";
        this.currentProblem = this.generateProblem();
        this.renderEquation();
        // Don't clear feedback immediately if showing combo, but for now logic is simple
        // this.feedbackEl.textContent = ""; 
    }


    generateProblem() {
        const type = Math.random() < 0.5 ? 'left' : 'right';
        const sum = Math.floor(Math.random() * 19) + 2;
        const a = Math.floor(Math.random() * (sum - 1)) + 1;
        const b = sum - a;

        return {
            a: a,
            b: b,
            c: sum,
            hidden: type
        };
    }

    renderEquation() {
        const { a, b, c, hidden } = this.currentProblem;
        let html = '';

        if (hidden === 'left') {
            html = `<span class="blank">?</span> <span>+</span> <span>${b}</span> <span>=</span> <span>${c}</span>`;
        } else {
            html = `<span>${a}</span> <span>+</span> <span class="blank">?</span> <span>=</span> <span>${c}</span>`;
        }

        this.equationEl.innerHTML = html;
        this.updateDisplay();
    }

    updateDisplay() {
        const blankEl = this.equationEl.querySelector('.blank');
        if (blankEl) {
            blankEl.textContent = this.userInput === "" ? "?" : this.userInput;

            if (this.userInput !== "") {
                blankEl.style.color = '#ffffff';
            } else {
                blankEl.style.color = '#ffeb3b';
            }
        }
    }

    checkAnswer() {
        if (this.userInput === "") return;

        const val = parseInt(this.userInput, 10);
        let correctVal;

        if (this.currentProblem.hidden === 'left') {
            correctVal = this.currentProblem.a;
        } else {
            correctVal = this.currentProblem.b;
        }

        if (val === correctVal) {
            // Correct
            this.combo++;

            // Score calculation: Base 10 + (Combo * 2)
            const pts = 10 + (this.combo > 1 ? (this.combo - 1) * 2 : 0);
            this.score += pts;

            this.updateScore();
            this.showFeedback(true);
            this.audio.playCorrect(this.combo);
            this.nextProblem();
        } else {
            // Incorrect
            this.combo = 0;
            this.showFeedback(false);
            this.audio.playWrong();
            this.shakeScreen();
            this.userInput = "";
            this.updateDisplay();
        }
    }

    showFeedback(isCorrect) {
        if (isCorrect) {
            this.feedbackEl.textContent = ""; // Clear old
            if (this.combo > 1) {
                this.comboEl.textContent = `${this.combo} COMBO!`;
                this.comboEl.classList.remove('pop-combo');
                void this.comboEl.offsetWidth;
                this.comboEl.classList.add('pop-combo');

                // Colors change with higher combos
                if (this.combo >= 5) this.comboEl.style.color = '#ff00ff'; // Magenta
                else if (this.combo >= 3) this.comboEl.style.color = '#00ffff'; // Cyan
                else this.comboEl.style.color = '#ffd700'; // Gold
            } else {
                this.comboEl.textContent = "";
            }
        } else {
            this.comboEl.textContent = "";
            this.feedbackEl.textContent = "ざんねん！";
            this.feedbackEl.style.color = '#ef4444';
        }
    }

    shakeScreen() {
        this.equationEl.classList.add('shake');
        setTimeout(() => this.equationEl.classList.remove('shake'), 400);
    }
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});
