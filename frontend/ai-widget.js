(() => {
    const API_BASE = window.API_BASE_URL || 'http://localhost:3333/api';
    const SESSION_KEY = 'bidfix_ai_session';
    const PANEL_STATE_KEY = 'bidfix_ai_panel_state';
    const PANEL_SIZE_KEY = 'bidfix_ai_panel_size';

    const quickActionMap = {
        'Cara Bid': 'Bagaimana cara melakukan bid di aplikasi ini?',
        'Cara Pembayaran': 'Bagaimana cara pembayaran dan cek status pembayaran?',
        'Cari Tempat Service': 'Saya butuh rekomendasi tempat service terpercaya di dekat saya.',
        'Status Order': 'Bagaimana cara cek status order saya?',
        FAQ: 'Tolong berikan FAQ penggunaan aplikasi yang paling umum.',
        'Hubungi Admin': 'Saya butuh bantuan admin/customer service.',
    };

    const getSessionId = () => {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
            return stored;
        }
        const generated = `sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        localStorage.setItem(SESSION_KEY, generated);
        return generated;
    };

    const escapeHtml = (value) =>
        String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const getAuthToken = () => {
        const token = localStorage.getItem('bidfix_token');
        if (!token || typeof token !== 'string') {
            return null;
        }
        const trimmed = token.trim();
        return trimmed || null;
    };

    const buildJsonHeaders = () => {
        const headers = {
            'Content-Type': 'application/json',
        };
        const token = getAuthToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    };

    const buildStreamHeaders = () => ({
        ...buildJsonHeaders(),
        Accept: 'text/event-stream',
    });

    const renderInlineMarkdown = (escapedText) => {
        let text = escapedText;
        const codeTokens = [];

        text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
            const key = `@@CODE_${codeTokens.length}@@`;
            codeTokens.push(`<code>${code}</code>`);
            return key;
        });

        text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

        text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
        text = text.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

        text = text.replace(/@@CODE_(\d+)@@/g, (_match, index) => codeTokens[Number(index)] || '');
        return text;
    };

    const renderMarkdown = (value) => {
        const escaped = escapeHtml(value);
        const lines = escaped.split(/\r?\n/);
        let html = '';
        let inOrderedList = false;
        let inUnorderedList = false;

        const closeLists = () => {
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            if (inUnorderedList) {
                html += '</ul>';
                inUnorderedList = false;
            }
        };

        lines.forEach((line) => {
            const trimmed = line.trim();

            if (!trimmed) {
                closeLists();
                html += '<div class="ai-line-gap"></div>';
                return;
            }

            const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
            if (orderedMatch) {
                if (!inOrderedList) {
                    if (inUnorderedList) {
                        html += '</ul>';
                        inUnorderedList = false;
                    }
                    html += '<ol class="ai-list ai-list-ordered">';
                    inOrderedList = true;
                }
                html += `<li>${renderInlineMarkdown(orderedMatch[1])}</li>`;
                return;
            }

            const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
            if (unorderedMatch) {
                if (!inUnorderedList) {
                    if (inOrderedList) {
                        html += '</ol>';
                        inOrderedList = false;
                    }
                    html += '<ul class="ai-list ai-list-unordered">';
                    inUnorderedList = true;
                }
                html += `<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`;
                return;
            }

            closeLists();
            html += `<p>${renderInlineMarkdown(trimmed)}</p>`;
        });

        closeLists();

        if (!html.trim()) {
            return '<p>-</p>';
        }

        return html;
    };

    const widget = document.createElement('div');
    widget.className = 'ai-widget';
    widget.innerHTML = `
        <button class="ai-fab" type="button" aria-label="Buka AI Assistant" title="Buka AI Assistant" data-ai-toggle>
            <span class="ai-fab-chat" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10H17M7 14H13M22 12C22 17.5228 17.5228 22 12 22C10.3431 22 8.7802 21.5978 7.40381 20.8854L2 22L3.11458 16.5962C2.40224 15.2198 2 13.6569 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>
            <span class="ai-fab-close" aria-hidden="true">×</span>
        </button>
        <section class="ai-panel" aria-hidden="true" data-ai-modal>
            <header class="ai-header">
                <div>
                    <div class="ai-title">AI Assistant BidFix</div>
                    <div class="ai-subtitle">Bantuan bid, pembayaran, dan rekomendasi service</div>
                </div>
                <div class="ai-header-actions">
                    <button class="ai-icon-btn" type="button" data-ai-maximize aria-label="Perbesar panel" title="Perbesar panel">⤢</button>
                    <button class="ai-icon-btn" type="button" data-ai-close aria-label="Tutup panel" title="Tutup panel">−</button>
                </div>
            </header>
            <div class="ai-body">
                <div class="ai-messages" data-ai-messages></div>
                <div class="ai-quick-actions" data-ai-quick-actions>
                    <button type="button">Cara Bid</button>
                    <button type="button">Cara Pembayaran</button>
                    <button type="button">Cari Tempat Service</button>
                    <button type="button">Status Order</button>
                    <button type="button">FAQ</button>
                    <button type="button">Hubungi Admin</button>
                </div>
                <form class="ai-form" data-ai-form>
                    <input type="text" placeholder="Ketik pertanyaan Anda..." data-ai-input maxlength="500" required>
                    <button type="submit" data-ai-send>Kirim</button>
                </form>
            </div>
        </section>
    `;

    document.body.appendChild(widget);

    const sessionId = getSessionId();
    const toggleButton = widget.querySelector('[data-ai-toggle]');
    const closeButton = widget.querySelector('[data-ai-close]');
    const maximizeButton = widget.querySelector('[data-ai-maximize]');
    const panel = widget.querySelector('[data-ai-modal]');
    const messagesEl = widget.querySelector('[data-ai-messages]');
    const quickActionsEl = widget.querySelector('[data-ai-quick-actions]');
    const form = widget.querySelector('[data-ai-form]');
    const input = widget.querySelector('[data-ai-input]');
    const sendButton = widget.querySelector('[data-ai-send]');

    let isLoading = false;
    let historyLoaded = false;

    const scrollToBottom = () => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const syncFabState = () => {
        const isOpen = widget.classList.contains('is-open');
        toggleButton.setAttribute('aria-label', isOpen ? 'Tutup AI Assistant' : 'Buka AI Assistant');
        toggleButton.setAttribute('title', isOpen ? 'Tutup AI Assistant' : 'Buka AI Assistant');
    };

    const setLoading = (loading) => {
        isLoading = loading;
        sendButton.disabled = loading;
        input.disabled = loading;
    };

    const setMessageContent = (item, text, metaText = '') => {
        item.innerHTML = `
            <div class="ai-message-content">${renderMarkdown(text)}</div>
            ${metaText ? `<div class="ai-message-meta">${escapeHtml(metaText)}</div>` : ''}
        `;
    };

    const appendMessage = (role, text, metaText = '') => {
        const item = document.createElement('article');
        item.className = `ai-message ${role}`;
        setMessageContent(item, text, metaText);
        messagesEl.appendChild(item);
        scrollToBottom();
        return item;
    };

    const appendTyping = () => {
        const item = document.createElement('article');
        item.className = 'ai-message ai';
        item.innerHTML = `
            <span class="ai-typing" aria-label="AI sedang mengetik">
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
            </span>
        `;
        messagesEl.appendChild(item);
        scrollToBottom();
        return item;
    };

    const updateQuickActions = (quickActions) => {
        if (!Array.isArray(quickActions) || !quickActions.length) {
            return;
        }

        quickActionsEl.innerHTML = '';
        quickActions.forEach((action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = action.label;
            button.dataset.quickValue = action.value;
            quickActionsEl.appendChild(button);
        });
    };

    const renderRecommendationMessage = (recommendations) => {
        if (!Array.isArray(recommendations) || !recommendations.length) {
            return;
        }

        const listText = recommendations
            .slice(0, 3)
            .map((item, index) => {
                const distance = item.distanceKm === null ? 'jarak n/a' : `${item.distanceKm} km`;
                return `${index + 1}. **${item.name}** (rating ${item.rating}, ${distance})`;
            })
            .join('\n');
        appendMessage('ai', `Rekomendasi terdekat:\n${listText}`);
    };

    const parseSseEvent = (rawEvent) => {
        if (!rawEvent || !rawEvent.trim()) {
            return null;
        }

        const lines = rawEvent.split(/\r?\n/);
        let eventName = 'message';
        const dataLines = [];

        lines.forEach((line) => {
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
                return;
            }
            if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
            }
        });

        if (!dataLines.length) {
            return { eventName, data: null };
        }

        const rawData = dataLines.join('\n');
        try {
            return { eventName, data: JSON.parse(rawData) };
        } catch (error) {
            return { eventName, data: { content: rawData } };
        }
    };

    const requestChatStream = async ({ message, locationPayload, onChunk }) => {
        const response = await fetch(`${API_BASE}/ai/chat?stream=true`, {
            method: 'POST',
            headers: buildStreamHeaders(),
            body: JSON.stringify({
                message,
                sessionId,
                stream: true,
                ...locationPayload,
            }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || 'Terjadi kendala pada server AI.');
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream') || !response.body) {
            return response.json().catch(() => ({}));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let latestChunkText = '';
        let donePayload = null;

        const processEvent = (rawEvent) => {
            const parsed = parseSseEvent(rawEvent);
            if (!parsed) {
                return;
            }

            if (parsed.eventName === 'chunk' && parsed.data && typeof parsed.data.content === 'string') {
                latestChunkText = parsed.data.content;
                onChunk(latestChunkText);
                return;
            }

            if (parsed.eventName === 'done' && parsed.data && typeof parsed.data === 'object') {
                donePayload = parsed.data;
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || '';
            events.forEach(processEvent);
        }

        if (buffer.trim()) {
            processEvent(buffer);
        }

        if (!donePayload) {
            donePayload = {};
        }

        if (!donePayload.reply && latestChunkText) {
            donePayload.reply = latestChunkText;
        }

        return donePayload;
    };

    const fetchHistory = async () => {
        try {
            const token = getAuthToken();
            const response = await fetch(`${API_BASE}/ai/history?sessionId=${encodeURIComponent(sessionId)}&limit=20`, {
                headers: token
                    ? {
                        Authorization: `Bearer ${token}`,
                    }
                    : {},
            });
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            const items = Array.isArray(data.data) ? data.data : [];
            if (!items.length) {
                return;
            }
            messagesEl.innerHTML = '';
            items.forEach((entry) => {
                appendMessage('user', entry.userMessage || '');
                appendMessage('ai', entry.aiResponse || '', `Intent: ${entry.intent || '-'} | Sentimen: ${entry.sentiment || '-'}`);
            });
        } catch (error) {
            // Ignore history fetch errors on widget boot.
        }
    };

    const getLocationIfNeeded = async (message) => {
        const normalized = String(message || '').toLowerCase();
        const shouldUseLocation =
            normalized.includes('service') ||
            normalized.includes('bengkel') ||
            normalized.includes('terdekat') ||
            normalized.includes('vendor');

        if (!shouldUseLocation || !navigator.geolocation) {
            return {};
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                () => resolve({}),
                {
                    enableHighAccuracy: false,
                    timeout: 4500,
                }
            );
        });
    };

    const savePanelState = () => {
        localStorage.setItem(PANEL_STATE_KEY, widget.classList.contains('is-open') ? 'open' : 'closed');
    };

    const setMaximizeState = (shouldMaximize) => {
        widget.classList.toggle('is-maximized', shouldMaximize);
        localStorage.setItem(PANEL_SIZE_KEY, shouldMaximize ? 'max' : 'normal');
        maximizeButton.textContent = shouldMaximize ? '⤡' : '⤢';
        maximizeButton.setAttribute('aria-label', shouldMaximize ? 'Kembalikan ukuran panel' : 'Perbesar panel');
        maximizeButton.setAttribute('title', shouldMaximize ? 'Kembalikan ukuran panel' : 'Perbesar panel');
        closeButton.setAttribute('aria-label', shouldMaximize ? 'Kecilkan panel' : 'Tutup panel');
        closeButton.setAttribute('title', shouldMaximize ? 'Kecilkan panel' : 'Tutup panel');
    };

    const sendMessage = async (rawMessage) => {
        const message = String(rawMessage || '').trim();
        if (!message || isLoading) {
            return;
        }

        appendMessage('user', message);
        input.value = '';
        setLoading(true);
        const typingEl = appendTyping();
        let aiMessageEl = null;

        const ensureAiMessageElement = () => {
            if (aiMessageEl) {
                return aiMessageEl;
            }

            aiMessageEl = document.createElement('article');
            aiMessageEl.className = 'ai-message ai';
            messagesEl.appendChild(aiMessageEl);
            typingEl.remove();
            return aiMessageEl;
        };

        try {
            const locationPayload = await getLocationIfNeeded(message);
            const payload = await requestChatStream({
                message,
                locationPayload,
                onChunk: (partialContent) => {
                    const target = ensureAiMessageElement();
                    setMessageContent(target, partialContent || '...');
                    scrollToBottom();
                },
            });

            const target = ensureAiMessageElement();
            const meta = `Intent: ${payload.intent || '-'} | Sentimen: ${payload.sentiment || '-'}`;
            setMessageContent(target, payload.reply || 'Maaf, belum ada jawaban.', meta);
            scrollToBottom();

            renderRecommendationMessage(payload.recommendations);
            updateQuickActions(payload.quickActions || []);
        } catch (error) {
            typingEl.remove();
            appendMessage('ai', error.message || 'Tidak dapat terhubung ke server AI. Periksa koneksi Anda.');
        } finally {
            setLoading(false);
            input.focus();
        }
    };

    const openPanel = async () => {
        widget.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        savePanelState();
        syncFabState();
        input.focus();

        if (!historyLoaded) {
            historyLoaded = true;
            await fetchHistory();
            if (!messagesEl.children.length) {
                appendMessage('ai', 'Halo, saya AI Assistant BidFix. Saya bisa bantu soal bid, pembayaran, status order, dan rekomendasi service.');
            }
        }
    };

    const closePanel = () => {
        widget.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        savePanelState();
        syncFabState();
    };

    const togglePanel = () => {
        if (widget.classList.contains('is-open')) {
            closePanel();
            return;
        }
        openPanel();
    };

    toggleButton.addEventListener('click', togglePanel);
    closeButton.addEventListener('click', () => {
        if (widget.classList.contains('is-maximized')) {
            setMaximizeState(false);
            return;
        }
        closePanel();
    });

    maximizeButton.addEventListener('click', () => {
        const next = !widget.classList.contains('is-maximized');
        setMaximizeState(next);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && widget.classList.contains('is-open')) {
            closePanel();
        }
    });

    quickActionsEl.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) {
            return;
        }

        const label = button.textContent.trim();
        const mapped = quickActionMap[label] || label;
        sendMessage(mapped);
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        sendMessage(input.value);
    });

    const savedMaxState = localStorage.getItem(PANEL_SIZE_KEY) === 'max';
    setMaximizeState(savedMaxState);

    const savedPanelState = localStorage.getItem(PANEL_STATE_KEY);
    const defaultOpen = window.matchMedia('(min-width: 992px)').matches;
    if (savedPanelState === 'open' || (!savedPanelState && defaultOpen)) {
        openPanel();
    } else {
        closePanel();
    }
    syncFabState();
})();
