/**
 * NEXUS CALC - CORE JAVASCRIPT
 * Production-ready Interactive & Dynamic Calculator
 * Features: Realtime preview, safe math parser with trigonometry (DEG/RAD),
 * Web Audio synth, Theme switcher, History drawer, and Keyboard support.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  const state = {
    expression: '',
    result: '0',
    angleMode: 'DEG', // 'DEG' or 'RAD'
    isCalculated: false,
    history: JSON.parse(localStorage.getItem('nexus_calc_history') || '[]'),
    soundEnabled: localStorage.getItem('nexus_calc_sound') !== 'false',
    theme: localStorage.getItem('nexus_calc_theme') || 'cyber',
    sciOpen: false
  };

  // ==========================================================================
  // DOM ELEMENTS
  // ==========================================================================
  const expressionDisplay = document.getElementById('expressionDisplay');
  const resultDisplay = document.getElementById('resultDisplay');
  const resultPrefix = document.getElementById('resultPrefix');
  const displayContainer = document.querySelector('.display-container');
  const calcCard = document.getElementById('calcCard');
  const sciDrawer = document.getElementById('sciDrawer');
  const sciToggleBtn = document.getElementById('sciToggleBtn');
  const angleModeTag = document.getElementById('angleModeTag');
  const angleToggleBtn = document.getElementById('angleToggleBtn');
  const historyPanel = document.getElementById('historyPanel');
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundOnIcon = soundToggleBtn.querySelector('.sound-on');
  const soundOffIcon = soundToggleBtn.querySelector('.sound-off');
  const themeBtn = document.getElementById('themeBtn');
  const themeMenu = document.getElementById('themeMenu');
  const themeDropdown = document.querySelector('.theme-dropdown');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const toast = document.getElementById('toast');
  const buttons = document.querySelectorAll('.btn');

  // ==========================================================================
  // AUDIO SYNTHESIZER (Web Audio API - Zero External Dependencies)
  // ==========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.05, gainValue = 0.08) {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  const soundFX = {
    num: () => playTone(650, 'sine', 0.04, 0.07),
    op: () => playTone(950, 'triangle', 0.06, 0.09),
    clear: () => playTone(340, 'sawtooth', 0.08, 0.08),
    backspace: () => playTone(420, 'triangle', 0.05, 0.08),
    equals: () => {
      if (!state.soundEnabled) return;
      playTone(523.25, 'sine', 0.1, 0.1); // C5
      setTimeout(() => playTone(659.25, 'sine', 0.14, 0.1), 60); // E5
    },
    error: () => {
      if (!state.soundEnabled) return;
      playTone(180, 'sawtooth', 0.2, 0.15);
    }
  };

  // ==========================================================================
  // THEME CONTROLLER
  // ==========================================================================
  function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    state.theme = themeName;
    localStorage.setItem('nexus_calc_theme', themeName);

    // Update active state in menu
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
  }

  // Initialize theme
  applyTheme(state.theme);

  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('open');
  });

  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', () => {
      const selectedTheme = option.dataset.theme;
      applyTheme(selectedTheme);
      themeDropdown.classList.remove('open');
      soundFX.op();
    });
  });

  // Close theme menu on outside click
  document.addEventListener('click', (e) => {
    if (!themeDropdown.contains(e.target)) {
      themeDropdown.classList.remove('open');
    }
  });

  // ==========================================================================
  // SOUND TOGGLE
  // ==========================================================================
  function updateSoundUI() {
    if (state.soundEnabled) {
      soundOnIcon.classList.remove('hidden');
      soundOffIcon.classList.add('hidden');
      soundToggleBtn.classList.remove('active');
    } else {
      soundOnIcon.classList.add('hidden');
      soundOffIcon.classList.remove('hidden');
      soundToggleBtn.classList.add('active');
    }
  }

  soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem('nexus_calc_sound', state.soundEnabled);
    updateSoundUI();
    if (state.soundEnabled) soundFX.num();
  });

  updateSoundUI();

  // ==========================================================================
  // SCIENTIFIC DRAWER TOGGLE
  // ==========================================================================
  sciToggleBtn.addEventListener('click', () => {
    state.sciOpen = !state.sciOpen;
    sciDrawer.classList.toggle('collapsed', !state.sciOpen);
    sciToggleBtn.classList.toggle('active', state.sciOpen);
    calcCard.classList.toggle('sci-expanded', state.sciOpen);
    soundFX.op();
  });

  // ==========================================================================
  // ANGLE MODE TOGGLE (DEG / RAD)
  // ==========================================================================
  function setAngleMode(mode) {
    state.angleMode = mode;
    angleModeTag.textContent = mode;
    angleToggleBtn.textContent = mode === 'DEG' ? 'RAD' : 'DEG';
    updateLivePreview();
  }

  angleToggleBtn.addEventListener('click', () => {
    setAngleMode(state.angleMode === 'DEG' ? 'RAD' : 'DEG');
    soundFX.op();
  });

  // ==========================================================================
  // NOTIFICATION TOAST
  // ==========================================================================
  let toastTimeout = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  // Copy Result Feature
  copyResultBtn.addEventListener('click', () => {
    const textToCopy = state.result.replace(/,/g, '');
    if (!textToCopy || textToCopy === 'Error') return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Copied to clipboard!');
      soundFX.num();
    }).catch(() => {
      showToast('Copy failed');
    });
  });

  // ==========================================================================
  // MATHEMATICAL EVALUATION ENGINE
  // ==========================================================================

  // Factorial helper
  function factorial(n) {
    if (n < 0 || Math.floor(n) !== n) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= Math.min(n, 170); i++) res *= i;
    return res;
  }

  /**
   * Safely compiles and calculates a mathematical expression string
   * Handles radians/degrees for trig, exponents, constants, and auto-balancing
   */
  function evaluateMathExpression(rawExpr) {
    if (!rawExpr || !rawExpr.trim()) return '0';

    let expr = rawExpr;

    // 1. Substitute human-friendly symbols
    expr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    expr = expr.replace(/π/g, 'Math.PI').replace(/\be\b/g, 'Math.E');

    // Percentage support: converts "50%" into "(50 * 0.01)"
    expr = expr.replace(/(\d+(\.\d+)?)%/g, '($1 * 0.01)');

    // 2. Factorials: replace numbers or sub-expressions followed by '!'
    expr = expr.replace(/(\d+(\.\d+)?|\([^\(\)]+\))!/g, (match, val) => {
      return `__fact__(${val})`;
    });

    // 3. Exponents: replace '^' with '**'
    expr = expr.replace(/\^/g, '**');

    // 4. Auto-balance parentheses (close missing closing brackets)
    let openCount = (expr.match(/\(/g) || []).length;
    let closeCount = (expr.match(/\)/g) || []).length;
    while (openCount > closeCount) {
      expr += ')';
      closeCount++;
    }

    // 5. Implicit multiplication: e.g. 5(2), (2)(3), 5Math.PI
    expr = expr.replace(/(\d)(\()/g, '$1*$2');
    expr = expr.replace(/(\))(\d)/g, '$1*$2');
    expr = expr.replace(/(\))(\()/g, '$1*$2');
    expr = expr.replace(/(\d)(Math\.)/g, '$1*$2');

    // 6. Trigonometric wrapper based on DEG/RAD mode
    const degToRad = (x) => (x * Math.PI) / 180;
    const radToDeg = (x) => (x * 180) / Math.PI;

    const customMath = {
      sin: (x) => Math.sin(state.angleMode === 'DEG' ? degToRad(x) : x),
      cos: (x) => {
        // Clean zero for cos(90 deg)
        if (state.angleMode === 'DEG' && Math.abs(x % 180) === 90) return 0;
        return Math.cos(state.angleMode === 'DEG' ? degToRad(x) : x);
      },
      tan: (x) => {
        if (state.angleMode === 'DEG' && Math.abs(x % 180) === 90) return NaN;
        return Math.tan(state.angleMode === 'DEG' ? degToRad(x) : x);
      },
      asin: (x) => {
        const res = Math.asin(x);
        return state.angleMode === 'DEG' ? radToDeg(res) : res;
      },
      acos: (x) => {
        const res = Math.acos(x);
        return state.angleMode === 'DEG' ? radToDeg(res) : res;
      },
      atan: (x) => {
        const res = Math.atan(x);
        return state.angleMode === 'DEG' ? radToDeg(res) : res;
      },
      sqrt: Math.sqrt,
      log: Math.log10,
      ln: Math.log,
      abs: Math.abs,
      PI: Math.PI,
      E: Math.E,
      __fact__: factorial
    };

    // Replace scientific function calls with customMath references
    const supportedFuncs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'abs'];
    supportedFuncs.forEach(fn => {
      const regex = new RegExp(`\\b${fn}\\(`, 'g');
      expr = expr.replace(regex, `scope.${fn}(`);
    });

    expr = expr.replace(/__fact__\(/g, 'scope.__fact__(');
    expr = expr.replace(/Math\.(PI|E)/g, 'scope.$1');

    // 7. Security check: Only allow safe math tokens
    const safeRegex = /^[\d\s+\-*/%^().,MathEPIscopea-z_]+$/i;
    if (!safeRegex.test(expr)) {
      throw new Error('Invalid tokens');
    }

    // 8. Safe Execution Function
    const evalFunction = new Function('scope', `return (${expr});`);
    const evaluated = evalFunction(customMath);

    if (evaluated === undefined || isNaN(evaluated) || !isFinite(evaluated)) {
      if (evaluated === Infinity || evaluated === -Infinity) return 'Cannot divide by 0';
      return 'Error';
    }

    // Fix floating point issues (e.g. 0.1 + 0.2 = 0.3)
    const precisionFixed = parseFloat(evaluated.toFixed(10));
    return precisionFixed.toString();
  }

  // Format large numbers with commas for display
  function formatNumberDisplay(numStr) {
    if (isNaN(numStr) || numStr === 'Error' || numStr.includes('Cannot')) {
      return numStr;
    }
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // ==========================================================================
  // DISPLAY & PREVIEW UPDATES
  // ==========================================================================
  function updateDisplays() {
    expressionDisplay.textContent = state.expression;
    resultDisplay.textContent = formatNumberDisplay(state.result);

    // Auto-scroll displays to right
    expressionDisplay.parentElement.scrollLeft = expressionDisplay.parentElement.scrollWidth;
    resultDisplay.parentElement.scrollLeft = resultDisplay.parentElement.scrollWidth;
  }

  function updateLivePreview() {
    if (!state.expression.trim()) {
      state.result = '0';
      resultPrefix.style.opacity = '0.3';
      updateDisplays();
      return;
    }

    // Check if expression ends with an operator; don't evaluate trailing operators in live preview
    const trimmed = state.expression.trim();
    if (/[+\-*/^%]$/.test(trimmed)) {
      resultPrefix.style.opacity = '0.3';
      return;
    }

    try {
      const preview = evaluateMathExpression(trimmed);
      if (preview !== 'Error' && !preview.includes('Cannot')) {
        state.result = preview;
        resultPrefix.style.opacity = '0.8';
        updateDisplays();
      }
    } catch (e) {
      // Expression incomplete during typing, silently ignore
    }
  }

  function triggerDisplayShake() {
    displayContainer.classList.remove('shake');
    void displayContainer.offsetWidth; // retrigger reflow
    displayContainer.classList.add('shake');
    setTimeout(() => displayContainer.classList.remove('shake'), 450);
  }

  // ==========================================================================
  // CALCULATOR ACTIONS & INPUT HANDLING
  // ==========================================================================
  function inputNumber(digit) {
    soundFX.num();

    if (state.isCalculated) {
      state.expression = digit;
      state.isCalculated = false;
    } else {
      if (state.expression === '0') {
        state.expression = digit;
      } else {
        state.expression += digit;
      }
    }

    updateDisplays();
    updateLivePreview();
  }

  function inputDecimal() {
    soundFX.num();

    if (state.isCalculated) {
      state.expression = '0.';
      state.isCalculated = false;
    } else {
      // Find the last number token in expression to prevent double decimals
      const match = state.expression.match(/[\d.]+$/);
      if (!match) {
        state.expression += '0.';
      } else if (!match[0].includes('.')) {
        state.expression += '.';
      }
    }

    updateDisplays();
  }

  function inputOperator(op) {
    soundFX.op();

    if (state.isCalculated) {
      state.expression = state.result + ' ' + op + ' ';
      state.isCalculated = false;
    } else {
      if (!state.expression) {
        if (op === '-') {
          state.expression = '-';
        } else {
          state.expression = '0 ' + op + ' ';
        }
      } else {
        // If ends with operator, replace it
        if (/ [+\-*/%^] $/.test(state.expression)) {
          state.expression = state.expression.replace(/ [+\-*/%^] $/, ` ${op} `);
        } else {
          state.expression += ` ${op} `;
        }
      }
    }

    updateDisplays();
  }

  function inputFunction(func) {
    soundFX.op();

    if (state.isCalculated) {
      state.expression = func;
      state.isCalculated = false;
    } else {
      state.expression += func;
    }

    updateDisplays();
  }

  function inputConstant(c) {
    soundFX.num();

    if (state.isCalculated) {
      state.expression = c;
      state.isCalculated = false;
    } else {
      state.expression += c;
    }

    updateDisplays();
    updateLivePreview();
  }

  function inputParenthesis() {
    soundFX.op();

    const openCount = (state.expression.match(/\(/g) || []).length;
    const closeCount = (state.expression.match(/\)/g) || []).length;
    const lastChar = state.expression.slice(-1);

    if (openCount > closeCount && (/\d|\)|[πe]/.test(lastChar))) {
      state.expression += ')';
    } else {
      if (/\d|[πe]|\)/.test(lastChar)) {
        state.expression += ' × (';
      } else {
        state.expression += '(';
      }
    }

    updateDisplays();
    updateLivePreview();
  }

  function inputNegate() {
    soundFX.num();

    if (state.isCalculated) {
      state.expression = `-${state.result}`;
      state.isCalculated = false;
      updateDisplays();
      updateLivePreview();
      return;
    }

    // Toggle negation on the last number token
    const regex = /(-?\d+(\.\d+)?)$/;
    const match = state.expression.match(regex);
    if (match) {
      const num = match[0];
      const toggled = num.startsWith('-') ? num.slice(1) : `-${num}`;
      state.expression = state.expression.replace(regex, toggled);
    } else if (state.expression === '') {
      state.expression = '-';
    }

    updateDisplays();
    updateLivePreview();
  }

  function backspace() {
    soundFX.backspace();

    if (state.isCalculated) {
      state.isCalculated = false;
    }

    // Check if trailing is a function call like 'sin(' or operator with spaces
    if (/ (sin|cos|tan|asin|acos|atan|sqrt|log|ln|abs)\($/.test(state.expression)) {
      state.expression = state.expression.replace(/(sin|cos|tan|asin|acos|atan|sqrt|log|ln|abs)\($/, '');
    } else if (/ [+\-*/%^] $/.test(state.expression)) {
      state.expression = state.expression.slice(0, -3);
    } else {
      state.expression = state.expression.slice(0, -1);
    }

    updateDisplays();
    updateLivePreview();
  }

  function clearAll() {
    soundFX.clear();
    state.expression = '';
    state.result = '0';
    state.isCalculated = false;
    resultPrefix.style.opacity = '0.3';
    updateDisplays();
  }

  function executeCalculate() {
    if (!state.expression.trim()) return;

    try {
      const finalResult = evaluateMathExpression(state.expression);

      if (finalResult === 'Error' || finalResult.includes('Cannot')) {
        soundFX.error();
        triggerDisplayShake();
        state.result = finalResult;
        updateDisplays();
        return;
      }

      soundFX.equals();
      const equationRecord = {
        expression: state.expression,
        result: finalResult,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Add to history
      state.history.unshift(equationRecord);
      if (state.history.length > 30) state.history.pop();
      localStorage.setItem('nexus_calc_history', JSON.stringify(state.history));
      renderHistory();

      // Update state
      state.result = finalResult;
      state.isCalculated = true;
      resultPrefix.style.opacity = '1';
      updateDisplays();

    } catch (err) {
      soundFX.error();
      triggerDisplayShake();
      state.result = 'Error';
      updateDisplays();
    }
  }

  // ==========================================================================
  // BUTTON CLICK DISPATCHER WITH RIPPLE EFFECT
  // ==========================================================================
  function createRipple(button) {
    button.classList.remove('ripple');
    void button.offsetWidth;
    button.classList.add('ripple');
    setTimeout(() => button.classList.remove('ripple'), 400);
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      createRipple(button);

      const action = button.dataset.action;
      const value = button.dataset.value;

      switch (action) {
        case 'number':
          inputNumber(value);
          break;
        case 'decimal':
          inputDecimal();
          break;
        case 'operator':
          inputOperator(value);
          break;
        case 'sci-op':
          inputOperator(value);
          break;
        case 'sci-func':
          inputFunction(value);
          break;
        case 'constant':
          inputConstant(value);
          break;
        case 'factorial':
          inputFunction('!');
          updateLivePreview();
          break;
        case 'parenthesis':
          inputParenthesis();
          break;
        case 'negate':
          inputNegate();
          break;
        case 'delete':
          backspace();
          break;
        case 'clear':
          clearAll();
          break;
        case 'calculate':
          executeCalculate();
          break;
      }
    });
  });

  // ==========================================================================
  // KEYBOARD ACCESSIBILITY
  // ==========================================================================
  document.addEventListener('keydown', (e) => {
    // Prevent interfering with input/select fields if any exist
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    let targetButton = null;

    if (e.key >= '0' && e.key <= '9') {
      inputNumber(e.key);
      targetButton = document.querySelector(`[data-action="number"][data-value="${e.key}"]`);
    } else if (e.key === '.') {
      inputDecimal();
      targetButton = document.querySelector('[data-action="decimal"]');
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      inputOperator(e.key);
      targetButton = document.querySelector(`[data-action="operator"][data-value="${e.key}"]`);
    } else if (e.key === '%') {
      inputOperator('%');
      targetButton = document.querySelector(`[data-action="operator"][data-value="%"]`);
    } else if (e.key === '^') {
      inputOperator('^');
      targetButton = document.querySelector(`[data-action="sci-op"][data-value="^"]`);
    } else if (e.key === '(' || e.key === ')') {
      inputParenthesis();
      targetButton = document.querySelector('[data-action="parenthesis"]');
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      executeCalculate();
      targetButton = document.getElementById('equalsBtn');
    } else if (e.key === 'Backspace') {
      backspace();
      targetButton = document.getElementById('deleteBtn');
    } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
      clearAll();
      targetButton = document.getElementById('clearBtn');
    }

    // Visual press animation for keyboard
    if (targetButton) {
      targetButton.classList.add('keyboard-active');
      createRipple(targetButton);
      setTimeout(() => targetButton.classList.remove('keyboard-active'), 150);
    }
  });

  // ==========================================================================
  // HISTORY DRAWER CONTROLS
  // ==========================================================================
  function renderHistory() {
    if (state.history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No calculation history yet</p>
          <span>Calculations will appear here</span>
        </div>
      `;
      return;
    }

    historyList.innerHTML = state.history.map((item, index) => `
      <div class="history-item" data-index="${index}" title="Click to use this result">
        <div class="history-expr">${item.expression} =</div>
        <div class="history-res">${formatNumberDisplay(item.result)}</div>
      </div>
    `).join('');

    // Attach click handlers to items
    historyList.querySelectorAll('.history-item').forEach(itemElem => {
      itemElem.addEventListener('click', () => {
        const item = state.history[itemElem.dataset.index];
        state.expression = item.result;
        state.result = item.result;
        state.isCalculated = true;
        updateDisplays();
        showToast('Result restored to screen');
        soundFX.num();
      });
    });
  }

  historyToggleBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('open');
    soundFX.op();
  });

  closeHistoryBtn.addEventListener('click', () => {
    historyPanel.classList.remove('open');
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (state.history.length === 0) return;
    state.history = [];
    localStorage.removeItem('nexus_calc_history');
    renderHistory();
    showToast('History cleared');
    soundFX.clear();
  });

  // Initial render
  renderHistory();
  updateDisplays();
});
