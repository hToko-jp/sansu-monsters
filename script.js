// Firebase Initialize (Config is loaded from external firebase-config.js)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

class Entity {
    constructor(name, maxHp, elementIdPrefix) {
        this.name = name;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.prefix = elementIdPrefix;
        this.updateUI();
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        this.updateUI();

        // Trigger damage visuals
        this.showDamageNumber(amount);

        // Shake effect
        const visual = document.getElementById(`${this.prefix}-visual`);
        visual.classList.remove('shake');
        void visual.offsetWidth; // Trigger reflow
        visual.classList.add('shake');
    }

    updateUI() {
        const hpBar = document.getElementById(`${this.prefix}-hp-bar`);
        const hpText = document.getElementById(`${this.prefix}-hp`);
        const maxHpText = document.getElementById(`${this.prefix}-max-hp`);

        if (hpBar && hpText) {
            const percentage = (this.hp / this.maxHp) * 100;
            hpBar.style.width = `${percentage}%`;
            hpText.textContent = this.hp;
            if (maxHpText) maxHpText.textContent = this.maxHp;

            // Color change
            if (percentage < 30) hpBar.style.backgroundColor = 'var(--hp-low)';
            else if (percentage < 60) hpBar.style.backgroundColor = 'var(--hp-mid)';
            else hpBar.style.backgroundColor = 'var(--hp-high)';
        }
    }

    showDamageNumber(amount) {
        const overlay = document.getElementById(`${this.prefix}-damage`);
        const damageEl = document.createElement('div');
        damageEl.classList.add('damage-pop');
        damageEl.textContent = `-${amount}`;
        overlay.appendChild(damageEl);

        setTimeout(() => {
            damageEl.remove();
        }, 1000);
    }
}

class Game {
    constructor() {
        console.log("Game Initializing...");

        this.hero = new Entity("勇者", 100, "hero");
        this.level = 1;
        this.score = 0;
        this.currentProblem = null;
        this.problemStartTime = 0;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Message queue for auto-scrolling log
        this.messageQueue = [];
        this.isDisplayingMessage = false;

        // Initial Monster
        this.spawnMonster();

        this.setupEventListeners();
        this.queueMessage("バトル カイシ！");
    }

    playSound(type) {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        const now = this.audioCtx.currentTime;

        if (type === 'attack') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.3);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'levelup') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'gameclear') {
            osc.type = 'sine';
            // Victory Fanfare
            osc.frequency.setValueAtTime(523.25, now); // C
            osc.frequency.setValueAtTime(523.25, now + 0.2);
            osc.frequency.setValueAtTime(523.25, now + 0.4);
            osc.frequency.setValueAtTime(659.25, now + 0.6); // E
            osc.frequency.setValueAtTime(783.99, now + 0.8); // G
            osc.frequency.setValueAtTime(1046.50, now + 1.2); // High C

            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 2.0);

            osc.start(now);
            osc.stop(now + 2.0);
        }
    }

    spawnMonster() {
        const isBoss = this.level % 5 === 0;
        const hp = isBoss ? (50 + this.level * 15) : (20 + (this.level * 10));

        const namePrefix = isBoss ? "【BOSS】" : "";
        this.monster = new Entity(`${namePrefix}モンスター Lv.${this.level}`, hp, "monster");

        // Update Monster Name UI
        const nameEl = document.getElementById('monster-name');
        nameEl.textContent = this.monster.name;
        nameEl.style.color = isBoss ? '#ff4757' : '#ffffff'; // Red text for boss

        // Random Monster Emoji
        const emojis = ['👾', '🐉', '🦖', '👹', '👻', '🤖', '🦇', '💀', '👽'];
        const bossEmojis = ['👺', '🐲', '🧛', '🧟', '🦈'];

        const list = isBoss ? bossEmojis : emojis;
        const randomEmoji = list[Math.floor(Math.random() * list.length)];

        const emojiEl = document.querySelector('.monster-emoji');
        emojiEl.textContent = randomEmoji;

        // Boss Visual effect
        if (isBoss) {
            emojiEl.style.transform = "scale(1.5)";
            this.playSound('wrong'); // Ominous entrance sound
        } else {
            emojiEl.style.transform = "scale(1)";
        }

        this.queueMessage(isBoss ? "きょうだいな ボス が あらわれた！" : `Lv.${this.level} の モンスター が あらわれた！`);
    }

    setupEventListeners() {
        const attackBtn = document.getElementById('attack-btn');
        const submitBtn = document.getElementById('submit-answer-btn');
        const answerInput = document.getElementById('answer-input');
        const saveScoreBtn = document.getElementById('save-score-btn');
        const viewRankingBtn = document.getElementById('view-ranking-btn');
        const closeRankingBtn = document.getElementById('close-ranking-btn');

        if (attackBtn) attackBtn.addEventListener('click', () => this.startAttackPhase());
        if (submitBtn) submitBtn.addEventListener('click', () => this.handleAnswer());

        if (answerInput) {
            answerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAnswer();
            });
        }

        if (saveScoreBtn) {
            saveScoreBtn.addEventListener('click', () => this.saveScore());
        }

        if (viewRankingBtn) {
            viewRankingBtn.addEventListener('click', () => {
                const modal = document.getElementById('ranking-only-modal');
                modal.classList.remove('hidden');
                this.fetchLeaderboard('standalone-leaderboard-list');
                this.playSound('attack'); // Reuse sound for feedback
            });
        }

        if (closeRankingBtn) {
            closeRankingBtn.addEventListener('click', () => {
                document.getElementById('ranking-only-modal').classList.add('hidden');
            });
        }
    }

    log(message) {
        const logArea = document.getElementById('game-log');
        const p = document.createElement('p');
        p.textContent = message;

        // Keep log clean (max 5 items)
        if (logArea.children.length > 5) {
            logArea.removeChild(logArea.lastChild);
        }

        logArea.prepend(p);
    }

    queueMessage(message) {
        this.messageQueue.push(message);
        if (!this.isDisplayingMessage) {
            this.processMessageQueue();
        }
    }

    processMessageQueue() {
        if (this.messageQueue.length === 0) {
            this.isDisplayingMessage = false;
            return;
        }

        this.isDisplayingMessage = true;
        const message = this.messageQueue.shift();
        this.log(message);

        // Wait 800ms before displaying next message
        setTimeout(() => {
            this.processMessageQueue();
        }, 800);
    }

    startAttackPhase() {
        this.playSound('attack');
        this.currentProblem = this.generateProblem(this.level);
        this.problemStartTime = Date.now(); // Record start time for speed bonus

        const modal = document.getElementById('math-modal');
        const problemText = document.getElementById('math-problem-text');

        // Display Logic based on type
        if (this.currentProblem.type === 'standard') {
            problemText.textContent = `${this.currentProblem.a} - ${this.currentProblem.b} = ?`;
        } else if (this.currentProblem.type === 'missing_minuend') {
            problemText.textContent = `? - ${this.currentProblem.b} = ${this.currentProblem.result}`;
        } else if (this.currentProblem.type === 'missing_subtrahend') {
            problemText.textContent = `${this.currentProblem.a} - ? = ${this.currentProblem.result}`;
        } else if (this.currentProblem.type === 'boss_3term') {
            problemText.textContent = `${this.currentProblem.a} - ${this.currentProblem.b} - ${this.currentProblem.c} = ?`;
        }

        modal.classList.remove('hidden');
        const input = document.getElementById('answer-input');
        input.value = '';
        input.focus();
    }

    generateProblem(level) {
        // Boss Level Logic (Every 5th level)
        if (level % 5 === 0) {
            return this.generateBossProblem(level);
        }

        // Standard Levels
        let type = 'standard';

        // Introduce variety starting Level 5
        if (level >= 5) {
            const roll = Math.random();
            if (roll < 0.33) type = 'missing_minuend';
            else if (roll < 0.66) type = 'missing_subtrahend';
        }

        let a, b;

        // Difficulty Logic
        if (level <= 2) {
            a = Math.floor(Math.random() * 10) + 1; // 1-10
            b = Math.floor(Math.random() * a);
        } else if (level <= 4) {
            a = Math.floor(Math.random() * 20) + 5; // 5-24
            b = Math.floor(Math.random() * (a / 2)) + 1;
        } else if (level <= 9) {
            a = Math.floor(Math.random() * 40) + 10;
            b = Math.floor(Math.random() * 20) + 5;
            if (b >= a) b = a - 1;
        } else {
            a = Math.floor(Math.random() * 90) + 10; // 10-99
            b = Math.floor(Math.random() * 50) + 5;
            if (b >= a) b = a - 1;
        }

        const exactAnswer = a - b;

        // Return object structure
        if (type === 'standard') {
            return { type, a, b, answer: exactAnswer };
        } else if (type === 'missing_minuend') {
            // ? - b = result -> Answer is a
            return { type, b, result: exactAnswer, answer: a };
        } else if (type === 'missing_subtrahend') {
            // a - ? = result -> Answer is b
            return { type, a, result: exactAnswer, answer: b };
        }
    }

    generateBossProblem(level) {
        // 3-term subtraction: A - B - C = ?
        // Ensure result is positive
        const a = Math.floor(Math.random() * 30) + (level * 2);
        const b = Math.floor(Math.random() * (a / 3)) + 1;
        const c = Math.floor(Math.random() * (a / 3)) + 1;

        return {
            type: 'boss_3term',
            a, b, c,
            answer: a - b - c
        };
    }

    handleAnswer() {
        const input = document.getElementById('answer-input');
        const val = parseInt(input.value);

        if (isNaN(val)) return; // Do nothing if empty

        const modal = document.getElementById('math-modal');
        modal.classList.add('hidden');

        if (val === this.currentProblem.answer) {
            this.onCorrectAnswer();
        } else {
            this.onWrongAnswer(val);
        }
    }

    onCorrectAnswer() {
        this.playSound('correct');

        // Calculate Speed Bonus
        const timeTakenSec = (Date.now() - this.problemStartTime) / 1000;
        const maxTime = 10; // 10 seconds to get bonus
        // faster = higher score. Max 50 bonus.
        const speedBonus = Math.max(0, Math.floor((maxTime - timeTakenSec) * 5));

        const damage = 10 + Math.floor(Math.random() * 5); // 10-14 damage

        this.queueMessage(`せいかい！ ${speedBonus}点ボーナス！`);
        this.queueMessage(`${damage} のダメージ を あたえた！`);

        // Add to score
        this.score += 10 + speedBonus; // Base 10 + Bonus
        document.getElementById('score-display').textContent = this.score;

        this.monster.takeDamage(damage);
        this.checkBattleState();
    }

    onWrongAnswer(wrongVal) {
        this.playSound('wrong');
        const damage = 5 + Math.floor(Math.random() * 5); // 5-9 damage
        this.queueMessage(`ざんねん... せいかいは ${this.currentProblem.answer} だ。`);
        this.queueMessage(`勇者 は ${damage} のダメージ を うけた！`);
        this.hero.takeDamage(damage);
        this.checkBattleState();
    }

    checkBattleState() {
        if (this.monster.hp <= 0) {
            // Win
            setTimeout(() => {
                // Check if this was the Final Boss (Level 10)
                if (this.level >= 10) {
                    this.gameClear();
                } else {
                    this.queueMessage("モンスター を たおした！");
                    this.levelUp();
                }
            }, 1000);
        } else if (this.hero.hp <= 0) {
            // Lose
            this.queueMessage("勇者 は たおれてしまった...");
            this.playSound('wrong');
            setTimeout(() => {
                alert("ゲームオーバー... リロードして再挑戦しよう！");
                location.reload();
            }, 500);
        }
    }

    levelUp() {
        this.playSound('levelup');
        this.level++;
        document.getElementById('level-display').textContent = this.level;
        this.score += 100;
        document.getElementById('score-display').textContent = this.score;

        setTimeout(() => {
            this.spawnMonster();
        }, 1500);
    }

    gameClear() {
        this.playSound('gameclear');
        this.queueMessage("🎉 すべての モンスター を たおした！ 🎉");

        const modal = document.getElementById('ending-modal');
        const scoreDisplay = document.getElementById('final-score-display');

        // Bonus: Level Clear Bonus + HP Bonus
        const clearBonus = 1000;
        const hpBonus = this.hero.hp * 10;

        this.queueMessage(`HPボーナス: ${hpBonus}点！`);
        this.score += clearBonus + hpBonus;
        scoreDisplay.textContent = this.score;

        modal.classList.remove('hidden');
    }

    // --- Firebase Ranking Logic (v8 Compat) ---
    async saveScore() {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim() || "ななし";
        const score = this.score;

        if (!name) return;

        // Visual feedback
        const btn = document.getElementById('save-score-btn');
        btn.textContent = "ほうこく中...";
        btn.disabled = true;

        try {
            // firebase.database() is global now
            const scoresRef = db.ref('scores');
            await scoresRef.push({
                name: name,
                score: score,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            // Hide input, Show Leaderboard
            document.getElementById('ranking-input-area').classList.add('hidden');
            document.getElementById('ranking-board').classList.remove('hidden');
            this.fetchLeaderboard();

        } catch (error) {
            console.error("Error saving score: ", error);
            btn.textContent = "エラーが発生しました";
            alert("スコアの保存に失敗しました...");
        }
    }

    async fetchLeaderboard(targetListId = 'leaderboard-list') {
        const list = document.getElementById(targetListId);
        if (!list) return;

        list.innerHTML = "<li>ロード中...</li>";

        try {
            // v8 syntax: orderByChild().limitToLast()
            const scoresRef = db.ref('scores');
            const snapshot = await scoresRef.orderByChild('score').limitToLast(10).once('value');

            if (snapshot.exists()) {
                const data = [];
                snapshot.forEach((childSnapshot) => {
                    data.push(childSnapshot.val());
                });

                // Reverse to show highest first
                data.reverse();

                list.innerHTML = ""; // Clear loader
                data.forEach((entry, index) => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${index + 1}. ${entry.name}</span> <span>${entry.score} pts</span>`;
                    list.appendChild(li);
                });
            } else {
                list.innerHTML = "<li>ランキングデータがありません</li>";
            }
        } catch (error) {
            console.error("Error fetching leaderboard: ", error);
            list.innerHTML = "<li>読み込みエラー</li>";
        }
    }
}

// Start Game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
