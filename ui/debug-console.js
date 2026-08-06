/**
 * WZK3 Debug Console - Advanced Error Catching & Debug System
 * Features:
 * - Catches all runtime errors (unhandled rejections, errors)
 * - Groups repetitive messages into collapsible summaries
 * - Copy-to-clipboard for easy bug reporting
 * - Color-coded severity levels
 * - Filterable by category
 * - Minimizable to reduce clutter
 */

(function() {
  'use strict';

  // === Configuration ===
  const CONFIG = {
    maxMessages: 200,
    groupThreshold: 3,        // After N similar messages, start grouping
    groupDecayMs: 5000,      // Reset group count after this idle time
    collapseAfter: 8,        // Auto-collapse groups larger than this
    storageKey: 'wzk3-debug-log',
    enabled: true,
    showTimestamp: true,
    showSource: true
  };

  // === State ===
  const state = {
    messages: [],
    groupedCounts: new Map(),
    lastMessageTime: 0,
    isCollapsed: false,
    filters: { error: true, warn: true, info: true, debug: false },
    stats: { total: 0, errors: 0, warnings: 0, grouped: 0 }
  };

  // === DOM Elements ===
  let container = null;
  let messageList = null;
  let header = null;
  let filterBar = null;
  let isInitialized = false;

  // === Severity Colors ===
  const SEVERITY = {
    error:   { bg: '#1a0005', border: '#ff3344', icon: '✖', color: '#ff6b7a' },
    warn:    { bg: '#1a1400', border: '#ffaa00', icon: '⚠', color: '#ffc940' },
    info:    { bg: '#001a1a', border: '#00cccc', icon: 'ℹ', color: '#66eaea' },
    debug:   { bg: '#0a0a14', border: '#6666aa', icon: '•', color: '#aaaadd' },
    success: { bg: '#001a00', border: '#44cc44', icon: '✓', color: '#88ee88' },
    system:  { bg: '#14001a', border: '#cc44cc', icon: '⚙', color: '#dd88dd' }
  };

  /**
   * Initialize the debug console
   */
  function init() {
    if (isInitialized) return;
    
    createUI();
    interceptConsole();
    interceptErrors();
    setupKeyboardShortcut();
    
    isInitialized = true;
    log('system', '[WZK3 Debug Console initialized]');
  }

  /**
   * Create the UI container
   */
  function createUI() {
    container = document.createElement('div');
    container.id = 'wzk3-debug-console';
    container.innerHTML = `
      <style>
        #wzk3-debug-console {
          position: fixed;
          bottom: 12px;
          right: 12px;
          width: 420px;
          max-height: 320px;
          background: rgba(8, 10, 18, 0.95);
          border: 1px solid rgba(100, 120, 180, 0.25);
          border-radius: 10px;
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          font-size: 11px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.6),
            0 0 60px rgba(0, 200, 255, 0.05);
          backdrop-filter: blur(12px);
          transition: height 0.25s ease, opacity 0.25s ease;
          overflow: hidden;
        }
        #wzk3-debug-console.minimized {
          max-height: 36px;
        }
        #wzk3-debug-console .dbg-header {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          background: linear-gradient(135deg, rgba(20, 30, 50, 0.95), rgba(10, 15, 28, 0.98));
          border-bottom: 1px solid rgba(100, 120, 180, 0.15);
          cursor: pointer;
          user-select: none;
          gap: 8px;
          flex-shrink: 0;
        }
        #wzk3-debug-console .dbg-title {
          color: #88aaff;
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.5px;
          flex: 1;
        }
        #wzk3-debug-console .dbg-stats {
          display: flex;
          gap: 10px;
          font-size: 10px;
        }
        #wzk3-debug-console .dbg-stat {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }
        #wzk3-debug-console .dbg-stat-err { background: rgba(255, 51, 68, 0.2); color: #ff6b7a; }
        #wzk3-debug-console .dbg-stat-warn { background: rgba(255, 170, 0, 0.2); color: #ffc940; }
        #wzk3-debug-console .dbg-stat-info { background: rgba(0, 204, 204, 0.15); color: #66eaea; }
        #wzk3-debug-console .dbg-btn {
          width: 22px;
          height: 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: all 0.15s ease;
          background: rgba(255, 255, 255, 0.08);
          color: #99aacc;
        }
        #wzk3-debug-console .dbg-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }
        #wzk3-debug-console .dbg-filters {
          display: flex;
          gap: 4px;
          padding: 5px 10px;
          background: rgba(0, 0, 0, 0.25);
          border-bottom: 1px solid rgba(100, 120, 180, 0.1);
          flex-shrink: 0;
        }
        #wzk3-debug-console .dbg-filter-btn {
          padding: 3px 8px;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          color: #7788aa;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        #wzk3-debug-console .dbg-filter-btn.active {
          border-color: currentColor;
        }
        #wzk3-debug-console .dbg-filter-btn[data-filter="error"].active { color: #ff6b7a; }
        #wzk3-debug-console .dbg-filter-btn[data-filter="warn"].active { color: #ffc940; }
        #wzk3-debug-console .dbg-filter-btn[data-filter="info"].active { color: #66eaea; }
        #wzk3-debug-console .dbg-messages {
          overflow-y: auto;
          flex: 1;
          padding: 4px 0;
          scroll-behavior: smooth;
        }
        #wzk3-debug-console .dbg-messages::-webkit-scrollbar {
          width: 6px;
        }
        #wzk3-debug-console .dbg-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        #wzk3-debug-console .dbg-messages::-webkit-scrollbar-thumb {
          background: rgba(100, 130, 200, 0.3);
          border-radius: 3px;
        }
        #wzk3-debug-console .dbg-msg {
          display: flex;
          align-items: flex-start;
          padding: 4px 10px;
          border-left: 3px solid transparent;
          transition: background 0.1s ease;
          gap: 8px;
          line-height: 1.45;
        }
        #wzk3-debug-console .dbg-msg:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        #wzk3-debug-console .dbg-msg-error { border-left-color: #ff3344; background: rgba(255, 51, 68, 0.06); }
        #wzk3-debug-console .dbg-msg-warn { border-left-color: #ffaa00; background: rgba(255, 170, 0, 0.04); }
        #wzk3-debug-console .dbg-msg-info { border-left-color: #00cccc; }
        #wzk3-debug-console .dbg-msg-debug { border-left-color: #6666aa; opacity: 0.7; }
        #wzk3-debug-console .dbg-msg-system { border-left-color: #cc44cc; }
        #wzk3-debug-console .dbg-msg-success { border-left-color: #44cc44; }
        #wzk3-debug-console .dbg-icon {
          flex-shrink: 0;
          width: 16px;
          text-align: center;
          font-size: 11px;
        }
        #wzk3-debug-console .dbg-content {
          flex: 1;
          min-width: 0;
          word-break: break-word;
        }
        #wzk3-debug-console .dbg-time {
          flex-shrink: 0;
          color: #556688;
          font-size: 10px;
        }
        #wzk3-debug-console .dbg-text {
          color: #c8d4e8;
        }
        #wzk3-debug-console .dbg-text-error { color: #ff6b7a; }
        #wzk3-debug-console .dbg-text-warn { color: #ffc940; }
        #wzk3-debug-console .dbg-source {
          color: #667788;
          font-size: 10px;
          margin-top: 2px;
        }
        #wzk3-debug-console .dbg-group {
          border-left-color: #8888aa !important;
          background: rgba(150, 150, 200, 0.06) !important;
        }
        #wzk3-debug-console .dbg-group-header {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        #wzk3-debug-console .dbg-group-count {
          background: rgba(100, 140, 255, 0.2);
          color: #99bbff;
          padding: 1px 6px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
        }
        #wzk3-debug-console .dbg-group-body {
          display: none;
          padding-left: 20px;
          border-top: 1px solid rgba(100, 120, 180, 0.1);
          margin-top: 4px;
        }
        #wzk3-debug-console .dbg-group.expanded .dbg-group-body {
          display: block;
        }
        #wzk3-debug-console .dbg-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(100, 120, 180, 0.1);
          flex-shrink: 0;
          gap: 8px;
        }
        #wzk3-debug-console .dbg-copy-btn {
          flex: 1;
          padding: 5px 10px;
          background: linear-gradient(135deg, rgba(0, 150, 200, 0.3), rgba(80, 100, 200, 0.2));
          border: 1px solid rgba(100, 180, 255, 0.3);
          border-radius: 6px;
          color: #88ddff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        #wzk3-debug-console .dbg-copy-btn:hover {
          background: linear-gradient(135deg, rgba(0, 180, 230, 0.4), rgba(100, 130, 230, 0.3));
          border-color: rgba(100, 200, 255, 0.5);
        }
        #wzk3-debug-console .dbg-copy-btn.copied {
          background: linear-gradient(135deg, rgba(0, 200, 100, 0.4), rgba(50, 180, 80, 0.3));
          border-color: rgba(100, 220, 120, 0.5);
          color: #88eeaa;
        }
        #wzk3-debug-console .dbg-clear-btn {
          padding: 5px 10px;
          background: rgba(255, 80, 80, 0.15);
          border: 1px solid rgba(255, 100, 100, 0.2);
          border-radius: 6px;
          color: #ee8888;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        #wzk3-debug-console .dbg-clear-btn:hover {
          background: rgba(255, 80, 80, 0.25);
        }
      </style>
      <div class="dbg-header" id="dbg-header">
        <span class="dbg-title">🔧 WZK3 DEBUG</span>
        <div class="dbg-stats">
          <span class="dbg-stat dbg-stat-err" id="dbg-err-count">0</span>
          <span class="dbg-stat dbg-stat-warn" id="dbg-warn-count">0</span>
          <span class="dbg-stat dbg-stat-info" id="dbg-info-count">0</span>
        </div>
        <button class="dbg-btn" id="dbg-minimize" title="Minimize">−</button>
        <button class="dbg-btn" id="dbg-close" title="Close">×</button>
      </div>
      <div class="dbg-filters" id="dbg-filters">
        <button class="dbg-filter-btn active" data-filter="error">Errors</button>
        <button class="dbg-filter-btn active" data-filter="warn">Warnings</button>
        <button class="dbg-filter-btn active" data-filter="info">Info</button>
        <button class="dbg-filter-btn" data-filter="debug">Debug</button>
      </div>
      <div class="dbg-messages" id="dbg-messages"></div>
      <div class="dbg-footer">
        <button class="dbg-copy-btn" id="dbg-copy">📋 Copy Log</button>
        <button class="dbg-clear-btn" id="dbg-clear">Clear</button>
      </div>
    `;

    document.body.appendChild(container);

    // Cache references
    header = container.querySelector('#dbg-header');
    messageList = container.querySelector('#dbg-messages');
    filterBar = container.querySelector('#dbg-filters');

    // Bind events
    bindEvents();
  }

  /**
   * Bind UI events
   */
  function bindEvents() {
    // Header click toggles minimize
    header.addEventListener('click', (e) => {
      if (e.target === header || e.target.closest('.dbg-title') || e.target.id === 'dbg-minimize') {
        toggleMinimize();
      }
    });

    // Close button
    container.querySelector('#dbg-close').addEventListener('click', () => {
      container.style.display = 'none';
    });

    // Filter buttons
    filterBar.querySelectorAll('.dbg-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const filter = btn.dataset.filter;
        state.filters[filter] = btn.classList.contains('active');
        renderMessages();
      });
    });

    // Copy button
    container.querySelector('#dbg-copy').addEventListener('click', copyLog);

    // Clear button
    container.querySelector('#dbg-clear').addEventListener('click', clearLog);
  }

  /**
   * Setup keyboard shortcut (F12 or Ctrl+` to toggle)
   */
  function setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.key === '`')) {
        e.preventDefault();
        toggleVisibility();
      }
    });
  }

  /**
   * Intercept console methods
   */
  function interceptConsole() {
    const originalMethods = {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console)
    };

    console.error = (...args) => {
      originalMethods.error(...args);
      formatAndLog('error', args);
    };
    console.warn = (...args) => {
      originalMethods.warn(...args);
      formatAndLog('warn', args);
    };
    console.info = (...args) => {
      originalMethods.info(...args);
      formatAndLog('info', args);
    };
    console.log = (...args) => {
      originalMethods.log(...args);
      // Only capture logs that look like game-related (bracketed prefixes)
      const str = args[0]?.toString?.() || '';
      if (/^\[.*?\]/.test(str)) {
        const level = str.includes('ERROR') ? 'error' : str.includes('WARN') ? 'warn' : 'debug';
        formatAndLog(level, args);
      }
    };
  }

  /**
   * Intercept unhandled errors and promise rejections
   */
  function interceptErrors() {
    window.addEventListener('error', (e) => {
      log('error', `${e.message}`, {
        source: e.filename ? e.filename.split('/').pop() : 'unknown',
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack
      });
      e.preventDefault();
    }, true);

    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason;
      const message = reason?.message || String(reason);
      log('error', `Unhandled Promise Rejection: ${message}`, {
        source: 'Promise',
        stack: reason?.stack
      });
      e.preventDefault();
    });
  }

  /**
   * Format console arguments into a string
   */
  function formatArgs(args) {
    return args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      } else if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2).slice(0, 500);
        } catch {
          return String(arg).slice(0, 500);
        }
      }
      return String(arg).slice(0, 300);
    }).join(' ');
  }

  /**
   * Format and add a log entry
   */
  function formatAndLog(severity, args) {
    if (!CONFIG.enabled) return;

    const text = formatArgs(args);
    const firstArg = args[0]?.toString?.() || '';
    
    // Extract source from common patterns like "[main]", "[Renderer]", etc.
    let source = null;
    const match = firstArg.match(/^\[([^\]]+)\]/);
    if (match) {
      source = match[1];
    }

    log(severity, text.replace(/^\[[^\]]+\]\s*/, ''), { source });
  }

  /**
   * Core logging function
   */
  function log(severity, text, meta = {}) {
    const now = Date.now();
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });

    // Check for grouping
    const key = `${severity}:${text.slice(0, 100)}`;
    const timeSinceLast = now - state.lastMessageTime;

    if (timeSinceLast > CONFIG.groupDecayMs) {
      state.groupedCounts.clear();
    }
    state.lastMessageTime = now;

    let groupCount = null;
    if (state.groupedCounts.has(key)) {
      const count = state.groupedCounts.get(key) + 1;
      state.groupedCounts.set(key, count);
      
      if (count >= CONFIG.groupThreshold) {
        groupCount = count;
        state.stats.grouped++;
        
        // Update existing group element instead of adding new
        updateGroup(key, count, time);
        updateStats(severity);
        return;
      }
    } else {
      state.groupedCounts.set(key, 1);
    }

    // Create message object
    const msg = {
      id: ++state.stats.total,
      severity,
      text: text.slice(0, 500),
      source: meta.source || source,
      time,
      timestamp: now,
      stack: meta.stack,
      groupKey: groupCount >= CONFIG.groupThreshold ? key : null,
      groupCount
    };

    state.messages.push(msg);

    // Trim old messages
    if (state.messages.length > CONFIG.maxMessages) {
      state.messages.shift();
    }

    // Update stats
    if (severity === 'error') state.stats.errors++;
    if (severity === 'warn') state.stats.warnings++;

    // Render
    addMessageElement(msg);
    updateStats(severity);
    autoScroll();
  }

  /**
   * Add a message element to the DOM
   */
  function addMessageElement(msg) {
    if (!state.filters[msg.severity]) return;

    const sev = SEVERITY[msg.severity] || SEVERITY.info;
    const el = document.createElement('div');
    el.className = `dbg-msg dbg-msg-${msg.severity}`;
    el.dataset.id = msg.id;
    el.dataset.groupKey = msg.groupKey || '';

    el.innerHTML = `
      <span class="dbg-icon">${sev.icon}</span>
      <div class="dbg-content">
        <div class="dbg-text dbg-text-${msg.severity}">${escapeHtml(msg.text)}</div>
        ${msg.source ? `<div class="dbg-source">${escapeHtml(msg.source)}</div>` : ''}
        ${msg.stack ? `<div class="dbg-source" style="max-height:60px;overflow:auto;opacity:0.6">${escapeHtml(msg.stack.slice(0, 800))}</div>` : ''}
      </div>
      <span class="dbg-time">${msg.time}</span>
    `;

    messageList.appendChild(el);
  }

  /**
   * Update an existing group's count
   */
  function updateGroup(key, count, time) {
    const el = messageList.querySelector(`[data-group-key="${key}"]`);
    if (!el) return;

    const countEl = el.querySelector('.dbg-group-count');
    if (countEl) {
      countEl.textContent = `×${count}`;
    }
  }

  /**
   * Render all messages (for filtering)
   */
  function renderMessages() {
    messageList.innerHTML = '';
    for (const msg of state.messages) {
      if (state.filters[msg.severity]) {
        addMessageElement(msg);
      }
    }
  }

  /**
   * Update stats display
   */
  function updateStats(changedSeverity) {
    const errEl = document.getElementById('dbg-err-count');
    const warnEl = document.getElementById('dbg-warn-count');
    const infoEl = document.getElementById('dbg-info-count');
    
    if (errEl) errEl.textContent = state.stats.errors;
    if (warnEl) warnEl.textContent = state.stats.warnings;
    if (infoEl) infoEl.textContent = state.stats.total - state.stats.errors - state.stats.warnings;
  }

  /**
   * Auto-scroll to bottom
   */
  function autoScroll() {
    if (!state.isCollapsed && container && !container.classList.contains('minimized')) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }

  /**
   * Toggle minimize state
   */
  function toggleMinimize() {
    state.isCollapsed = !state.isCollapsed;
    container.classList.toggle('minimized', state.isCollapsed);
    container.querySelector('#dbg-minimize').textContent = state.isCollapsed ? '+' : '−';
  }

  /**
   * Toggle visibility entirely
   */
  function toggleVisibility() {
    if (container.style.display === 'none') {
      container.style.display = '';
    } else {
      container.style.display = container.style.display === 'none' ? '' : 'none';
    }
  }

  /**
   * Copy entire log to clipboard
   */
  async function copyLog() {
    const btn = container.querySelector('#dbg-copy');
    const output = generateLogOutput();

    try {
      await navigator.clipboard.writeText(output);
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Copy Log';
        btn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = output;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = '📋 Copy Log';
      }, 2000);
    }
  }

  /**
   * Generate formatted log output for copying
   */
  function generateLogOutput() {
    const lines = [
      '=== WZK3 Debug Log ===',
      `Generated: ${new Date().toISOString()}`,
      `Total Messages: ${state.stats.total} | Errors: ${state.stats.errors} | Warnings: ${state.stats.warnings}`,
      `URL: ${location.href}`,
      `User Agent: ${navigator.userAgent}`,
      ''.padEnd(50, '='),
      ''
    ];

    for (const msg of state.messages) {
      const prefix = `[${msg.time}] [${msg.severity.toUpperCase()}]`;
      lines.push(`${prefix} ${msg.text}`);
      if (msg.source) lines.push(`  → Source: ${msg.source}`);
      if (msg.stack) lines.push(`  Stack:\n${msg.stack.split('\n').map(l => '    ' + l).join('\n')}`);
      lines.push('');
    }

    lines.push(''.padEnd(50, '='));
    lines.push('END OF LOG');
    return lines.join('\n');
  }

  /**
   * Clear the log
   */
  function clearLog() {
    state.messages = [];
    state.groupedCounts.clear();
    state.stats = { total: 0, errors: 0, warnings: 0, grouped: 0 };
    messageList.innerHTML = '';
    updateStats();
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // === Initialize when DOM is ready ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API globally for programmatic access
  window.__WZK3_DEBUG = {
    log,
    clear: clearLog,
    show: () => { container.style.display = ''; },
    hide: () => { container.style.display = 'none'; },
    getStats: () => ({ ...state.stats }),
    getMessages: () => [...state.messages],
    setEnabled: (v) => { CONFIG.enabled = v; }
  };

})();
