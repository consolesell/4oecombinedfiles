// main.js

/* Enhanced Deriv Bot v2.0: Advanced Adaptive Intelligence
 - Adaptive Contextual Indicators with dynamic weighting
 - Predictive Micro-Structure Analysis for candle patterns
 - Intelligent Duration Optimization with risk-adjusted expiry
 - Machine Learning-inspired decision framework
 - Multi-dimensional market regime detection
 - Enhanced pattern recognition and confidence scoring
 - Real-time tick subscription for live updates
 - Advanced error handling and reconnection logic
 - Persistent settings via localStorage
 - Safety: Live mode requires single confirmation
 - Automatic contract purchase without user prompts
*/

/* ---------- Config ---------- */
const APP_ID = 1089;
const CANDLES_COUNT = 200;
const AUTO_INTERVAL_MS = 10000;
const KEEP_ALIVE_MS = 25000;
const TICK_SUBSCRIPTION = true;

/* ---------- State ---------- */
let ws = null;
let candleData = [];
let tickBuffer = []; // For micro-structure analysis
let chart = null;
let authorized = false;
let autoTrading = false;
let autoTimer = null;
let pingTimer = null;
let tradesMade = 0;
let lastProposalReceived = null;
let accountBalance = null;
let tickSubscriptionId = null;
let settings = {};
let marketRegime = { type: 'UNKNOWN', volatility: 0, trend: 0, confidence: 0 };
let indicatorWeights = { ma: 1.0, rsi: 1.0, bb: 1.0, momentum: 1.0, volume: 1.0 };
let patternLibrary = new Map();
let performanceMetrics = { wins: 0, losses: 0, totalProfit: 0, regimeHistory: [] };

/* ---------- DOM ---------- */
const tokenInput = document.getElementById('token');
const symbolEl = document.getElementById('symbol');
const granEl = document.getElementById('granularity');
const stakeEl = document.getElementById('stake');
const connectBtn = document.getElementById('connectBtn');
const startAutoBtn = document.getElementById('startAutoBtn');
const stopAutoBtn = document.getElementById('stopAutoBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const statusEl = document.getElementById('status');
const lastUpdatedEl = document.getElementById('lastUpdated');
const feedEl = document.getElementById('feed');
const indList = document.getElementById('indList');
const decisionText = document.getElementById('decisionText');
const tradesCountEl = document.getElementById('tradesCount');
const historyEl = document.getElementById('history');
const loadingOverlay = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const liveModeCheckbox = document.getElementById('liveMode');
const confirmLiveCheckbox = document.getElementById('confirmLive');
const confirmLiveGroup = document.getElementById('confirmLiveGroup');

/* ---------- UI Helpers ---------- */
function showLoading(text = 'Please wait...') {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
}
function hideLoading() {
    loadingOverlay.classList.add('hidden');
}
function setStatus(text, color = '') {
    statusEl.textContent = text;
    statusEl.style.color = color || 'var(--muted-color)';
}
function appendFeed(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `feed-item ${type}`;
    const time = new Date().toLocaleTimeString();
    div.innerHTML = `<span>${msg}</span><span style="color:var(--muted-color)">${time}</span>`;
    feedEl.prepend(div);
    feedEl.scrollTop = 0;
}
function saveHistoryRecord(record) {
    const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
    hist.unshift(record);
    localStorage.setItem('tradeHistory', JSON.stringify(hist));
    renderHistory();
    updatePerformanceMetrics(record);
}
function renderHistory() {
    const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
    historyEl.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'history-summary';
    const totalProfit = hist.reduce((s, h) => s + (h.profit || 0), 0);
    const winRate = hist.length > 0 ? (hist.filter(h => h.result === 'WIN').length / hist.length * 100).toFixed(1) : 0;
    summary.innerHTML = `<strong>Total Trades:</strong> ${hist.length} • <strong>Win Rate:</strong> ${winRate}% • <strong>Total P/L:</strong> ${totalProfit.toFixed(2)} USD`;
    historyEl.appendChild(summary);
    hist.slice(0, 200).forEach(r => {
        const d = document.createElement('div');
        d.className = 'history-item';
        const profitColor = r.profit > 0 ? 'var(--success-color)' : (r.profit < 0 ? 'var(--error-color)' : 'var(--muted-color)');
        d.innerHTML = `
            <span>${r.time}</span>
            <span>${r.mode}</span>
            <span>${r.symbol}</span>
            <span>${r.decision}</span>
            <span>Stake: ${r.amount}</span>
            <span style="color: ${profitColor}">${r.result || 'PENDING'} ${r.profit !== undefined ? '(' + r.profit.toFixed(2) + ')' : ''}</span>
        `;
        historyEl.appendChild(d);
    });
    tradesCountEl.textContent = `Trades: ${hist.length}`;
}
function clearHistory() {
    localStorage.removeItem('tradeHistory');
    performanceMetrics = { wins: 0, losses: 0, totalProfit: 0, regimeHistory: [] };
    renderHistory();
    appendFeed('Trade history cleared', 'warn');
}
function updateBalanceDisplay() {
    if (accountBalance !== null) {
        setStatus(`Authorized | Balance: ${accountBalance.toFixed(2)} USD | Regime: ${marketRegime.type}`, 'var(--success-color)');
    }
}

/* ---------- Auto-trading Loop ---------- */
function startAutoTrading() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !authorized) {
        appendFeed('Please connect and authorize first', 'warn');
        return;
    }
    autoTrading = true;
    startAutoBtn.disabled = true;
    stopAutoBtn.disabled = false;
    appendFeed('Auto trading activated with adaptive intelligence', 'success');
    autoCheck();
    autoTimer = setInterval(autoCheck, settings.autoInterval || AUTO_INTERVAL_MS);
}

function stopAutoTrading() {
    autoTrading = false;
    startAutoBtn.disabled = false;
    stopAutoBtn.disabled = true;
    if (autoTimer) clearInterval(autoTimer);
    appendFeed('Auto trading deactivated', 'warn');
}

async function autoCheck() {
    if (!candleData || candleData.length < 50) {
        appendFeed('Insufficient candle data for decision', 'warn');
        return;
    }
    
    const d = advancedDecisionEngine(candleData);
    
    decisionText.textContent = `${d.action} — ${d.reason} (Confidence: ${(d.confidence * 100).toFixed(0)}% | Signal: ${d.compositeSignal ? d.compositeSignal.toFixed(2) : 'N/A'})`;
    updateIndicatorsUI(d.indicators);
    appendFeed(`Decision: ${d.action} (${d.reason})`, 'info');

    if (d.action === 'HOLD' || d.confidence < 0.65) {
        appendFeed(`Holding position - Signal strength insufficient (Conf: ${(d.confidence * 100).toFixed(0)}%)`, 'info');
        return;
    }

    const stake = parseFloat(stakeEl.value) || 1;
    const symbol = symbolEl.value;
    const contract_type = d.action.includes('BUY') ? 'CALL' : 'PUT';
    
    // Optimize duration based on market conditions
    const durationOptimization = optimizeTradeDuration(
        d, 
        marketRegime, 
        d.indicators.volatility,
        d.indicators.pattern
    );
    
    const params = {
        amount: stake,
        symbol,
        contract_type,
        duration: durationOptimization.duration,
        duration_unit: 's',
        decision: d.action,
        decisionObj: d
    };

    appendFeed(`Trade parameters: ${contract_type} | Duration: ${durationOptimization.duration}s | ${durationOptimization.rationale}`, 'info');

    if (liveModeCheckbox.checked) {
        requestLiveProposal(params);
    } else {
        simulateTrade(params, d.indicators);
    }
}

/* ---------- WebSocket and API Handling ---------- */
function connectAndAuthorize() {
    const token = tokenInput.value.trim();
    if (!token) {
        alert('Enter a valid Deriv token (demo recommended for safety)');
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    showLoading('Establishing connection to Deriv...');
    setStatus('Connecting...', 'var(--muted-color)');
    ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);

    ws.onopen = () => {
        appendFeed('WebSocket connection established', 'success');
        try {
            ws.send(JSON.stringify({ authorize: token }));
        } catch (e) {
            appendFeed(`Authorization failed: ${e.message}`, 'error');
        }
        pingTimer = setInterval(() => {
            try {
                ws.send(JSON.stringify({ ping: 1 }));
            } catch (e) {}
        }, KEEP_ALIVE_MS);
    };

    ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);

        if (data.error) {
            appendFeed(`API Error: ${data.error.message || JSON.stringify(data.error)}`, 'error');
            hideLoading();
            return;
        }

        if (data.msg_type === 'authorize' && data.authorize) {
            authorized = true;
            accountBalance = data.authorize.balance;
            updateBalanceDisplay();
            hideLoading();
            appendFeed('Authorization successful - Adaptive intelligence activated', 'success');
            fetchCandles(symbolEl.value, parseInt(granEl.value, 10));
            startAutoBtn.disabled = false;
            if (TICK_SUBSCRIPTION) subscribeToTicks(symbolEl.value);
            return;
        }

        if (data.candles) {
            candleData = data.candles;
            const now = new Date().toLocaleTimeString();
            lastUpdatedEl.textContent = `Last Updated: ${now}`;
            updateChartAndIndicators();
            appendFeed(`Candles data refreshed - Analyzing ${candleData.length} candles`, 'info');
            hideLoading();
            return;
        }

        if (data.tick) {
            // Store tick for micro-structure analysis
            tickBuffer.push({ epoch: data.tick.epoch, quote: data.tick.quote });
            if (tickBuffer.length > 50) tickBuffer.shift();
            
            const latestTick = { epoch: data.tick.epoch, close: data.tick.quote, high: data.tick.quote, low: data.tick.quote, open: data.tick.quote };
            if (candleData.length > 0 && latestTick.epoch > candleData[candleData.length - 1].epoch + parseInt(granEl.value, 10)) {
                candleData.push(latestTick);
                if (candleData.length > CANDLES_COUNT) candleData.shift();
                updateChartAndIndicators();
            }
            return;
        }

        if (data.proposal) {
            lastProposalReceived = data.proposal;
            appendFeed(`Proposal received - Ask Price: ${data.proposal.ask_price} | Payout: ${data.proposal.payout}`, 'info');
            // Automatic purchase without confirmation prompt
            if (liveModeCheckbox.checked && data.proposal.id) {
                try {
                    ws.send(JSON.stringify({ buy: data.proposal.id, price: data.proposal.ask_price, subscribe: 1 }));
                    appendFeed(`Auto-buy executed for proposal ID: ${data.proposal.id}`, 'success');
                } catch (e) {
                    appendFeed(`Buy failed: ${e.message}`, 'error');
                }
            }
            return;
        }

        if (data.buy) {
            const buy = data.buy;
            const rec = {
                time: new Date().toLocaleTimeString(),
                mode: 'LIVE',
                symbol: buy.symbol,
                amount: buy.buy_price,
                decision: buy.contract_type === 'CALL' ? 'SELL' : 'BUY',
                result: 'PENDING',
                contract_id: buy.contract_id,
                profit: 0,
                regime: marketRegime.type
            };
            saveHistoryRecord(rec);
            appendFeed(`Live buy confirmed - Contract ID: ${buy.contract_id}`, 'success');
            return;
        }

        if (data.proposal_open_contract) {
            const poc = data.proposal_open_contract;
            if (poc.contract_id) {
                const hist = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
                const idx = hist.findIndex(h => h.contract_id === poc.contract_id);
                if (idx >= 0) {
                    const rec = hist[idx];
                    rec.result = poc.status.toUpperCase();
                    if (poc.profit !== undefined) {
                        rec.profit = parseFloat(poc.profit);
                        accountBalance += rec.profit;
                        updateBalanceDisplay();
                    }
                    hist[idx] = rec;
                    localStorage.setItem('tradeHistory', JSON.stringify(hist));
                    renderHistory();
                    appendFeed(`Contract ${poc.contract_id} updated: ${rec.result} (${rec.profit.toFixed(2)})`, rec.profit > 0 ? 'success' : 'error');
                }
            }
            return;
        }
    };

    ws.onclose = () => {
        appendFeed('WebSocket connection closed - Attempting reconnect...', 'warn');
        setStatus('Disconnected', 'var(--muted-color)');
        authorized = false;
        hideLoading();
        clearInterval(pingTimer);
        setTimeout(() => {
            if (!authorized && tokenInput.value.trim()) {
                appendFeed('Auto-reconnecting...', 'info');
                connectAndAuthorize();
            }
        }, 5000);
    };

    ws.onerror = (err) => {
        appendFeed('WebSocket error occurred', 'error');
        hideLoading();
    };
}

/* ---------- Event Listeners ---------- */
connectBtn.addEventListener('click', () => {
    connectBtn.disabled = true;
    connectAndAuthorize();
    setTimeout(() => connectBtn.disabled = false, 2000);
});

startAutoBtn.addEventListener('click', startAutoTrading);
stopAutoBtn.addEventListener('click', stopAutoTrading);
clearHistoryBtn.addEventListener('click', clearHistory);

symbolEl.addEventListener('change', () => {
    if (ws && authorized) {
        if (tickSubscriptionId) {
            ws.send(JSON.stringify({ forget: tickSubscriptionId }));
        }
        tickBuffer = []; // Reset tick buffer for new symbol
        fetchCandles(symbolEl.value, parseInt(granEl.value, 10));
        if (TICK_SUBSCRIPTION) subscribeToTicks(symbolEl.value);
    }
});

granEl.addEventListener('change', () => {
    if (ws && authorized) {
        tickBuffer = []; // Reset tick buffer
        fetchCandles(symbolEl.value, parseInt(granEl.value, 10));
    }
});

liveModeCheckbox.addEventListener('change', () => {
    // Hide confirm group - single checkbox confirmation only
    if (confirmLiveGroup) {
        confirmLiveGroup.style.display = 'none';
    }
    if (liveModeCheckbox.checked) {
        appendFeed('⚠️ LIVE MODE ENABLED - Real money at risk! Automatic trading active!', 'warn');
    } else {
        appendFeed('Live mode disabled - Simulation mode active', 'info');
    }
});

/* ---------- Initialization ---------- */
function init() {
    // Hide the second confirmation checkbox group on load
    if (confirmLiveGroup) {
        confirmLiveGroup.style.display = 'none';
    }
    
    // Load persistent settings
    settings = JSON.parse(localStorage.getItem('botSettings') || '{}');
    if (settings.symbol) symbolEl.value = settings.symbol;
    if (settings.granularity) granEl.value = settings.granularity;
    if (settings.stake) stakeEl.value = settings.stake;

    // Save on changes
    symbolEl.addEventListener('change', () => { 
        settings.symbol = symbolEl.value; 
        localStorage.setItem('botSettings', JSON.stringify(settings)); 
    });
    granEl.addEventListener('change', () => { 
        settings.granularity = granEl.value; 
        localStorage.setItem('botSettings', JSON.stringify(settings)); 
    });
    stakeEl.addEventListener('input', () => { 
        settings.stake = stakeEl.value; 
        localStorage.setItem('botSettings', JSON.stringify(settings)); 
    });

    renderHistory();
    setStatus('Idle - Adaptive Intelligence Ready', 'var(--muted-color)');
    appendFeed('🤖 Enhanced Bot v2.0 initialized with Adaptive Intelligence', 'info');
    appendFeed('✓ IndicatorsModel: Dynamic weighting enabled', 'success');
    appendFeed('✓ CandlesModel: Predictive pattern recognition active', 'success');
    appendFeed('✓ DurationModel: Adaptive temporal optimization ready', 'success');
    appendFeed('✓ Automatic contract execution enabled', 'success');
    appendFeed('Enter token and connect to begin trading', 'info');
}
init();

/* Expose for manual triggers */
window.fetchCandlesNow = () => fetchCandles(symbolEl.value, parseInt(granEl.value, 10));
