(() => {
    const API_BASE = window.API_BASE_URL || `${window.location.origin}/api`;
    const themeClasses = ['theme-blue', 'theme-yellow', 'theme-pink', 'theme-green'];
    const landingPageUrl = '../../index.html';

    const requestList = document.getElementById('requestList');
    const emptyState = document.getElementById('requestEmpty');
    const loadingState = document.getElementById('requestLoading');
    const orderList = document.getElementById('orderList');
    const orderEmpty = document.getElementById('orderEmpty');
    const orderLoading = document.getElementById('orderLoading');
    const categorySelect = document.getElementById('categorySelect');
    const requestForm = document.getElementById('requestForm');
    const formAlert = document.getElementById('formAlert');
    const jobTitleInput = document.getElementById('jobTitle');
    const jobDescriptionInput = document.getElementById('jobDescription');
    const userAddressInput = document.getElementById('userAddress');
    const jobBudgetInput = document.getElementById('jobBudget');

    const modal = document.getElementById('detailModal');
    const detailTitle = modal?.querySelector('[data-detail-title]');
    const detailSubtitle = modal?.querySelector('[data-detail-subtitle]');
    const detailStatus = modal?.querySelector('[data-detail-status]');
    const detailCategory = modal?.querySelector('[data-detail-category]');
    const detailLocation = modal?.querySelector('[data-detail-location]');
    const detailBudget = modal?.querySelector('[data-detail-budget]');
    const detailMode = modal?.querySelector('[data-detail-mode]');
    const detailDate = modal?.querySelector('[data-detail-date]');
    const detailDescription = modal?.querySelector('[data-detail-description]');
    const detailLoading = modal?.querySelector('[data-detail-loading]');
    const detailContent = modal?.querySelector('[data-detail-content]');
    const bidList = modal?.querySelector('[data-bid-list]');
    const bidEmpty = modal?.querySelector('[data-bid-empty]');

    const confirmModal = document.getElementById('merchantConfirmModal');
    const confirmName = confirmModal?.querySelector('[data-confirm-name]');
    const confirmMeta = confirmModal?.querySelector('[data-confirm-meta]');
    const confirmContact = confirmModal?.querySelector('[data-confirm-contact]');
    const confirmPrice = confirmModal?.querySelector('[data-confirm-price]');
    const confirmEta = confirmModal?.querySelector('[data-confirm-eta]');
    const confirmNote = confirmModal?.querySelector('[data-confirm-note]');
    const confirmAlert = confirmModal?.querySelector('[data-confirm-alert]');
    const confirmButton = document.getElementById('confirmSelectMerchant');

    const paymentModal = document.getElementById('paymentModal');
    const paymentSubtitle = paymentModal?.querySelector('[data-payment-subtitle]');
    const paymentProof = paymentModal?.querySelector('[data-payment-proof]');
    const paymentNote = paymentModal?.querySelector('[data-payment-note]');
    const payFinalButton = document.getElementById('payFinalButton');

    const actionModal = document.getElementById('actionModal');
    const actionTitle = actionModal?.querySelector('[data-action-title]');
    const actionMessage = actionModal?.querySelector('[data-action-message]');
    const actionConfirmButton = document.getElementById('actionConfirmButton');
    const actionCancelButton = document.getElementById('actionCancelButton');
    const actionCloseButtons = actionModal
        ? Array.from(actionModal.querySelectorAll('[data-action-close]'))
        : [];

    const statusMap = {
        open: { label: 'Terbuka', className: 'status-open' },
        closed: { label: 'Ditutup', className: 'status-closed' },
        in_progress: { label: 'Diproses', className: 'status-in-progress' },
        completed: { label: 'Selesai', className: 'status-completed' },
        disputed: { label: 'Dispute', className: 'status-disputed' },
        cancelled: { label: 'Dibatalkan', className: 'status-cancelled' },
    };

    const DP_PERCENTAGE = 0.3;
    const MIDTRANS_SNAP_SCRIPT_ID = 'midtrans-snap-script';

    let categoryMap = new Map();
    let requestsCache = new Map();
    let bidsCache = new Map();
    let ordersCache = new Map();
    let ordersByRequest = new Map();
    let paymentsByOrder = new Map();
    let currentRequest = null;
    let currentBids = [];
    let pendingSelection = null;
    let pendingPaymentOrder = null;
    let actionModalResolver = null;
    let actionModalLastFocus = null;
    let midtransSnapScriptPromise = null;
    let midtransSnapScriptConfig = null;

    const getClosest = (target, selector) => {
        if (!target) {
            return null;
        }
        if (target instanceof Element) {
            return target.closest(selector);
        }
        if (target.parentElement) {
            return target.parentElement.closest(selector);
        }
        return null;
    };

    const getStoredUser = () => {
        const raw = localStorage.getItem('bidfix_user');
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    };

    const redirectToLanding = () => {
        window.location.href = landingPageUrl;
    };

    const ensureUserAccess = () => {
        const token = localStorage.getItem('bidfix_token');
        const user = getStoredUser();
        if (!token || !user || user.role !== 'user') {
            redirectToLanding();
            return null;
        }
        return { token, user };
    };

    const getAuthHeaders = () => {
        const auth = ensureUserAccess();
        if (!auth) {
            return null;
        }
        return { Authorization: `Bearer ${auth.token}` };
    };

    const fetchJson = async (url) => {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
            throw new Error('Unauthorized');
        }
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLanding();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const providerMessage =
                errorBody?.response?.error?.message ||
                errorBody?.response?.message ||
                errorBody?.error?.message ||
                '';
            if (errorBody?.message && providerMessage) {
                throw new Error(`${errorBody.message}: ${providerMessage}`);
            }
            throw new Error(errorBody.message || providerMessage || 'Request failed');
        }
        return response.json();
    };

    const postJson = async (url, payload, extraHeaders = {}) => {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
            throw new Error('Unauthorized');
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
                ...extraHeaders,
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLanding();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const providerMessage =
                errorBody?.providerError ||
                errorBody?.response?.error?.message ||
                errorBody?.response?.message ||
                errorBody?.error?.message ||
                '';
            if (errorBody?.message && providerMessage) {
                throw new Error(`${errorBody.message}: ${providerMessage}`);
            }
            throw new Error(errorBody.message || providerMessage || 'Request failed');
        }
        return response.json();
    };

    const putJson = async (url, payload) => {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
            throw new Error('Unauthorized');
        }
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLanding();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.message || 'Request failed');
        }
        return response.json();
    };

    const delay = (ms) => new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

    const resolveActionModal = (value) => {
        if (typeof actionModalResolver === 'function') {
            const resolver = actionModalResolver;
            actionModalResolver = null;
            resolver(value);
        }
    };

    const closeActionModal = (value = false) => {
        if (!actionModal) {
            return;
        }

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && actionModal.contains(activeElement)) {
            activeElement.blur();
        }

        actionModal.classList.remove('is-open');
        actionModal.setAttribute('aria-hidden', 'true');
        updateBodyModalState();
        resolveActionModal(value);

        if (actionModalLastFocus instanceof HTMLElement && actionModalLastFocus.isConnected) {
            actionModalLastFocus.focus();
        }
        actionModalLastFocus = null;
    };

    const openActionModal = ({
        title = 'Informasi',
        message = '',
        confirmText = 'OK',
        cancelText = 'Batalkan',
        showCancel = false,
    } = {}) =>
        new Promise((resolve) => {
            if (!actionModal || !actionTitle || !actionMessage || !actionConfirmButton || !actionCancelButton) {
                resolve(false);
                return;
            }

            actionTitle.textContent = title;
            actionMessage.textContent = message;
            actionConfirmButton.textContent = confirmText;
            actionCancelButton.textContent = cancelText;
            actionConfirmButton.disabled = false;
            actionCancelButton.disabled = false;
            actionCancelButton.style.display = showCancel ? 'inline-flex' : 'none';
            actionCloseButtons.forEach((button) => {
                button.onclick = () => closeActionModal(false);
            });
            actionConfirmButton.onclick = () => closeActionModal(true);
            actionCancelButton.onclick = () => closeActionModal(false);

            const activeElement = document.activeElement;
            actionModalLastFocus = activeElement instanceof HTMLElement ? activeElement : null;
            actionModalResolver = resolve;
            actionModal.classList.add('is-open');
            actionModal.setAttribute('aria-hidden', 'false');
            updateBodyModalState();
            requestAnimationFrame(() => {
                actionConfirmButton.focus();
            });
        });

    const askPaymentConfirmation = ({ title, message, confirmText, cancelText }) =>
        openActionModal({
            title,
            message,
            confirmText,
            cancelText,
            showCancel: true,
        });

    const showPaymentNotice = ({ title, message, confirmText = 'Mengerti' }) =>
        openActionModal({
            title,
            message,
            confirmText,
            showCancel: false,
        });

    const formatCurrency = (value) => {
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        const numberValue = Number(value);
        if (Number.isNaN(numberValue)) {
            return String(value);
        }
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(numberValue);
    };

    const formatDate = (value) => {
        if (!value) {
            return '-';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatLocation = (request) => {
        const user = getStoredUser();
        const address = userAddressInput?.value?.trim() || user?.address;
        if (address) {
            return address;
        }
        if (request?.location_lat && request?.location_lng) {
            return `${request.location_lat}, ${request.location_lng}`;
        }
        return 'Alamat belum diisi';
    };

    const formatMode = (mode) => {
        if (mode === 'toko') {
            return 'Servis di Toko';
        }
        if (mode === 'teknisi') {
            return 'Teknisi Datang';
        }
        return '-';
    };

    const formatEtaDays = (etaValue) => {
        if (!etaValue) {
            return '-';
        }
        const etaDate = new Date(etaValue);
        if (Number.isNaN(etaDate.getTime())) {
            return etaValue;
        }
        const now = new Date();
        const diffMs = etaDate.getTime() - now.getTime();
        const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return `${diffDays} hari`;
    };

    const getPaymentState = (orderId) => {
        return paymentsByOrder.get(orderId) || { dpPaid: false, finalPaid: false };
    };

    const getOrderStatusInfo = (order) => {
        const paymentState = getPaymentState(order.id);
        if (paymentState.finalPaid || order.status === 'completed') {
            return { label: 'Done (1x24 jam)', className: 'status-done' };
        }
        if (order.status === 'awaiting_confirmation') {
            return { label: 'Pelunasan', className: 'status-settle' };
        }
        if (order.status === 'in_progress') {
            return { label: 'On Progress', className: 'status-progress' };
        }
        if (!paymentState.dpPaid) {
            return { label: 'Menunggu Pembayaran', className: 'status-payment' };
        }
        return { label: 'Menunggu Teknisi', className: 'status-waiting' };
    };

    const getRequestStatusInfo = (request) => {
        const order = ordersByRequest.get(request.id);
        if (!order) {
            return statusMap[request.status] || { label: request.status || '-', className: 'status-cancelled' };
        }
        const orderStatus = getOrderStatusInfo(order);
        if (orderStatus.className === 'status-done') {
            return { label: 'Selesai', className: 'status-completed' };
        }
        return orderStatus;
    };

    const showLoading = (isLoading) => {
        if (loadingState) {
            loadingState.classList.toggle('is-visible', isLoading);
        }
    };

    const showEmptyState = (isEmpty) => {
        if (emptyState) {
            emptyState.classList.toggle('is-visible', isEmpty);
        }
    };

    const showOrderLoading = (isLoading) => {
        if (orderLoading) {
            orderLoading.classList.toggle('is-visible', isLoading);
        }
    };

    const showOrderEmpty = (isEmpty) => {
        if (orderEmpty) {
            orderEmpty.classList.toggle('is-visible', isEmpty);
        }
    };

    const populateUserAddress = (user) => {
        if (!userAddressInput) {
            return;
        }
        userAddressInput.value = user?.address || '';
    };

    const showFormAlert = (type, message) => {
        if (!formAlert) {
            return;
        }
        formAlert.textContent = message;
        formAlert.classList.toggle('is-error', type === 'error');
        formAlert.classList.toggle('is-success', type === 'success');
        formAlert.classList.add('is-visible');
    };

    const clearFormAlert = () => {
        if (!formAlert) {
            return;
        }
        formAlert.textContent = '';
        formAlert.classList.remove('is-visible', 'is-error', 'is-success');
    };

    const parseCurrencyInput = (value) => {
        if (!value) {
            return null;
        }
        const digits = value.replace(/[^\d]/g, '');
        if (!digits) {
            return null;
        }
        return Number(digits);
    };

    const formatCurrencyInput = (value) => {
        const digits = value.replace(/[^\d]/g, '');
        if (!digits) {
            return '';
        }
        const numberValue = Number(digits);
        if (Number.isNaN(numberValue)) {
            return '';
        }
        const formatted = new Intl.NumberFormat('id-ID').format(numberValue);
        return `Rp ${formatted}`;
    };


    const buildStatus = (request) => {
        return getRequestStatusInfo(request);
    };

    const renderRequests = (requests) => {
        if (!requestList) {
            return;
        }
        requestList.innerHTML = '';

        if (!requests.length) {
            showEmptyState(true);
            return;
        }

        showEmptyState(false);

        requests.forEach((request, index) => {
            const themeClass = themeClasses[index % themeClasses.length];
            const statusInfo = buildStatus(request);
            const categoryName = categoryMap.get(request.category_id) || 'Tanpa kategori';
            const bids = bidsCache.get(request.id) || [];
            const bidsCount = bids.length;
            const description = request.description || 'Deskripsi belum tersedia.';

            const card = document.createElement('article');
            card.className = `job-card ${themeClass}`;
            card.innerHTML = `
                <div class="job-header">
                    <span class="job-category">${categoryName}</span>
                    <span class="job-status ${statusInfo.className}">${statusInfo.label}</span>
                </div>
                <h3 class="job-title">${request.title || 'Judul belum tersedia'}</h3>
                <p class="job-description">${description}</p>
                <div class="job-details">
                    <div class="job-detail-item">
                        <span class="detail-icon" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></span>
                        <span>${formatLocation(request)}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="detail-icon" aria-hidden="true"><i class="fa-solid fa-wallet"></i></span>
                        <span>Budget: ${formatCurrency(request.min_bid_amount)}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="detail-icon" aria-hidden="true"><i class="fa-solid fa-user-group"></i></span>
                        <span>${bidsCount} Penawaran</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="detail-icon" aria-hidden="true"><i class="fa-solid fa-clock"></i></span>
                        <span>Posted: ${formatDate(request.created_at)}</span>
                    </div>
                </div>
                <div class="job-footer">
                    <button class="btn-detail" data-request-id="${request.id}">
                        <i class="fa-solid fa-eye" aria-hidden="true"></i>
                        Lihat Detail
                    </button>
                </div>
            `;

            requestList.appendChild(card);
        });
    };

    const renderBidList = (bids, request) => {
        if (!bidList || !bidEmpty) {
            return;
        }

        currentBids = bids;
        currentRequest = request;

        bidList.innerHTML = '';
        if (!bids.length) {
            bidEmpty.classList.add('is-visible');
            return;
        }

        bidEmpty.classList.remove('is-visible');
        const order = request ? ordersByRequest.get(request.id) : null;
        const selectionLocked = Boolean(order);

        bids.forEach((bid) => {
            const merchant = bid.Merchant;
            const merchantUser = merchant?.User;
            const merchantName =
                merchant?.business_name ||
                merchantUser?.name ||
                `Merchant #${bid.merchant_id}`;
            const merchantMeta = merchantUser?.name ? `Pemilik: ${merchantUser.name}` : 'Merchant terverifikasi';
            const isSelected = Boolean(bid.is_selected);
            const badgeLabel = isSelected ? 'Terpilih' : selectionLocked ? 'Terkunci' : '';
            const isDisabled = selectionLocked || isSelected;

            const item = document.createElement('div');
            item.className = 'bid-item';
            item.innerHTML = `
                <div class="bid-item-head">
                    <div class="bid-merchant">
                        <strong>${merchantName}</strong>
                        <span>${merchantMeta}</span>
                    </div>
                    <div class="bid-action">
                        ${badgeLabel ? `<span class="bid-selected">${badgeLabel}</span>` : ''}
                        <button class="btn-select" data-select-bid-id="${bid.id}" ${isDisabled ? 'disabled' : ''}>
                            Pilih Merchant
                        </button>
                    </div>
                </div>
                <div>Harga: ${formatCurrency(bid.price)}</div>
                <div>Estimasi: ${formatEtaDays(bid.eta)}</div>
                <div>Catatan: ${bid.note || '-'}</div>
            `;
            bidList.appendChild(item);
        });
    };

    const updateDetailModal = (request, bids) => {
        if (!modal || !request) {
            return;
        }

        const statusInfo = buildStatus(request);

        if (detailTitle) {
            detailTitle.textContent = request.title || 'Detail Request';
        }

        if (detailSubtitle) {
            detailSubtitle.textContent = `Request ID: ${request.id}`;
        }

        if (detailStatus) {
            detailStatus.textContent = statusInfo.label;
            detailStatus.className = `detail-status ${statusInfo.className}`;
        }

        if (detailCategory) {
            detailCategory.textContent = categoryMap.get(request.category_id) || 'Tanpa kategori';
        }

        if (detailLocation) {
            detailLocation.textContent = formatLocation(request);
        }

        if (detailBudget) {
            detailBudget.textContent = formatCurrency(request.min_bid_amount);
        }

        if (detailMode) {
            detailMode.textContent = formatMode(request.mode_service);
        }

        if (detailDate) {
            detailDate.textContent = formatDate(request.created_at);
        }

        if (detailDescription) {
            detailDescription.textContent = request.description || '-';
        }

        renderBidList(bids, request);
    };

    const updateBodyModalState = () => {
        const isDetailOpen = modal?.classList.contains('is-open');
        const isConfirmOpen = confirmModal?.classList.contains('is-open');
        const isPaymentOpen = paymentModal?.classList.contains('is-open');
        const isActionOpen = actionModal?.classList.contains('is-open');
        document.body.classList.toggle(
            'modal-open',
            Boolean(isDetailOpen || isConfirmOpen || isPaymentOpen || isActionOpen)
        );
    };

    const openModal = () => {
        if (!modal) {
            return;
        }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        updateBodyModalState();
    };

    const closeModal = () => {
        if (!modal) {
            return;
        }
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        updateBodyModalState();
    };

    const showConfirmAlert = (message) => {
        if (!confirmAlert) {
            return;
        }
        confirmAlert.textContent = message;
        confirmAlert.classList.add('is-visible', 'is-error');
    };

    const clearConfirmAlert = () => {
        if (!confirmAlert) {
            return;
        }
        confirmAlert.textContent = '';
        confirmAlert.classList.remove('is-visible', 'is-error');
    };

    const openConfirmModal = (bid, request) => {
        if (!confirmModal) {
            return;
        }
        const merchant = bid?.Merchant;
        const merchantUser = merchant?.User;
        const merchantName =
            merchant?.business_name ||
            merchantUser?.name ||
            `Merchant #${bid?.merchant_id || '-'}`;
        const merchantMeta = merchantUser?.name
            ? `Pemilik: ${merchantUser.name}`
            : 'Detail merchant belum tersedia.';
        const merchantContact = merchantUser?.phone || merchantUser?.email || 'Kontak belum tersedia.';

        if (confirmName) {
            confirmName.textContent = merchantName;
        }
        if (confirmMeta) {
            confirmMeta.textContent = merchantMeta;
        }
        if (confirmContact) {
            confirmContact.textContent = `Kontak: ${merchantContact}`;
        }
        if (confirmPrice) {
            confirmPrice.textContent = `Harga: ${formatCurrency(bid?.price)}`;
        }
        if (confirmEta) {
            confirmEta.textContent = `Estimasi: ${formatEtaDays(bid?.eta)}`;
        }
        if (confirmNote) {
            confirmNote.textContent = `Catatan: ${bid?.note || '-'}`;
        }

        pendingSelection = { bid, request };
        clearConfirmAlert();
        confirmModal.classList.add('is-open');
        confirmModal.setAttribute('aria-hidden', 'false');
        updateBodyModalState();
    };

    const closeConfirmModal = () => {
        if (!confirmModal) {
            return;
        }
        confirmModal.classList.remove('is-open');
        confirmModal.setAttribute('aria-hidden', 'true');
        updateBodyModalState();
    };

    const openPaymentModal = (order) => {
        if (!paymentModal || !order) {
            return;
        }
        pendingPaymentOrder = order;
        if (paymentSubtitle) {
            paymentSubtitle.textContent = `Order #${order.id} - ${order?.Request?.title || 'Permintaan layanan'}`;
        }
        let proofList = [];
        if (Array.isArray(order.proof_photos)) {
            proofList = order.proof_photos;
        } else if (typeof order.proof_photos === 'string') {
            try {
                proofList = JSON.parse(order.proof_photos);
            } catch (error) {
                proofList = [];
            }
        }

        if (paymentProof) {
            paymentProof.innerHTML = '';
            if (!proofList.length) {
                paymentProof.innerHTML = '<div class="payment-proof-item">Belum ada lampiran.</div>';
            } else {
                proofList.forEach((proof, index) => {
                    const item = document.createElement('div');
                    item.className = 'payment-proof-item';
                    const label = proof?.url ? `Lampiran ${index + 1}` : `Lampiran ${index + 1} belum tersedia`;
                    item.innerHTML = proof?.url
                        ? `<a href="${proof.url}" target="_blank" rel="noreferrer">${label}</a>`
                        : label;
                    paymentProof.appendChild(item);
                });
            }
        }
        if (paymentNote) {
            const noteValue = proofList[0]?.note
                ? proofList[0].note
                : 'Tidak ada keterangan tambahan.';
            paymentNote.textContent = noteValue;
        }
        paymentModal.classList.add('is-open');
        paymentModal.setAttribute('aria-hidden', 'false');
        updateBodyModalState();
    };

    const closePaymentModal = () => {
        if (!paymentModal) {
            return;
        }
        paymentModal.classList.remove('is-open');
        paymentModal.setAttribute('aria-hidden', 'true');
        updateBodyModalState();
        pendingPaymentOrder = null;
    };

    const setDetailLoading = (isLoading) => {
        if (detailLoading) {
            detailLoading.style.display = isLoading ? 'block' : 'none';
        }
        if (detailContent) {
            detailContent.style.display = isLoading ? 'none' : 'flex';
        }
    };

    const loadDetail = async (requestId) => {
        if (!requestId) {
            return;
        }
        openModal();
        setDetailLoading(true);

        let request = requestsCache.get(requestId);
        let bids = bidsCache.get(requestId) || [];

        try {
            const [requestResponse, bidsResponse] = await Promise.all([
                fetchJson(`${API_BASE}/requests/${requestId}`),
                fetchJson(`${API_BASE}/bids?request_id=${requestId}`),
            ]);
            request = requestResponse || request;
            bids = bidsResponse || bids;
        } catch (error) {
            // fallback to cached data
        }

        if (request) {
            currentRequest = request;
            currentBids = bids;
            updateDetailModal(request, bids);
        }
        setDetailLoading(false);
    };

    const loadCategories = async () => {
        try {
            const categories = await fetchJson(`${API_BASE}/categories`);
            categoryMap = new Map(categories.map((category) => [category.id, category.name]));

            if (categorySelect) {
                categorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
                categories.forEach((category) => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    categorySelect.appendChild(option);
                });
            }
        } catch (error) {
            // ignore category errors
        }
    };

    const loadRequests = async () => {
        const user = getStoredUser();
        const url = user?.id ? `${API_BASE}/requests?user_id=${user.id}` : `${API_BASE}/requests`;
        const requests = await fetchJson(url);
        requestsCache = new Map(requests.map((request) => [request.id, request]));
        return requests;
    };

    const loadBids = async () => {
        const bids = await fetchJson(`${API_BASE}/bids`);
        bidsCache = new Map();
        bids.forEach((bid) => {
            if (!bidsCache.has(bid.request_id)) {
                bidsCache.set(bid.request_id, []);
            }
            bidsCache.get(bid.request_id).push(bid);
        });
        return bids;
    };

    const loadOrders = async () => {
        const user = getStoredUser();
        if (!user?.id) {
            return [];
        }
        const orders = await fetchJson(`${API_BASE}/orders?user_id=${user.id}`);
        ordersCache = new Map(orders.map((order) => [order.id, order]));
        ordersByRequest = new Map();
        orders.forEach((order) => {
            if (order.request_id) {
                ordersByRequest.set(order.request_id, order);
            }
        });
        return orders;
    };

    const loadPayments = async () => {
        const user = getStoredUser();
        if (!user?.id) {
            return [];
        }
        const payments = await fetchJson(`${API_BASE}/payments?user_id=${user.id}`);
        paymentsByOrder = new Map();
        payments.forEach((payment) => {
            if (!payment.order_id) {
                return;
            }
            const summary = paymentsByOrder.get(payment.order_id) || { dpPaid: false, finalPaid: false };
            if (payment.type === 'dp' && payment.status === 'succeeded') {
                summary.dpPaid = true;
            }
            if (payment.type === 'final' && payment.status === 'succeeded') {
                summary.finalPaid = true;
            }
            paymentsByOrder.set(payment.order_id, summary);
        });
        return payments;
    };

    const pollPaymentResult = async (lookupId) => {
        if (!lookupId) {
            return null;
        }

        const attempts = 36;
        let lastKnownResult = null;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                const result = await fetchJson(`${API_BASE}/payment/status/${encodeURIComponent(String(lookupId))}`);
                lastKnownResult = result;
                const status = String(result?.status || '').toUpperCase();
                if (['PAID', 'FAILED', 'EXPIRED', 'REFUNDED'].includes(status)) {
                    return result;
                }
            } catch (error) {
                // keep polling until attempts exhausted
            }

            await delay(5000);
        }

        return lastKnownResult;
    };

    const getMidtransSnapScriptUrl = (isProduction) =>
        isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';

    const ensureMidtransSnapLoaded = async ({ clientKey, isProduction }) => {
        const normalizedClientKey = String(clientKey || '').trim();
        if (!normalizedClientKey) {
            throw new Error('Konfigurasi MIDTRANS_CLIENT_KEY belum tersedia.');
        }

        const scriptUrl = getMidtransSnapScriptUrl(Boolean(isProduction));
        const hasSameConfig =
            midtransSnapScriptConfig &&
            midtransSnapScriptConfig.clientKey === normalizedClientKey &&
            midtransSnapScriptConfig.scriptUrl === scriptUrl;

        if (window.snap && hasSameConfig) {
            return;
        }

        if (midtransSnapScriptPromise && hasSameConfig) {
            await midtransSnapScriptPromise;
            return;
        }

        const existingScript = document.getElementById(MIDTRANS_SNAP_SCRIPT_ID);
        if (existingScript) {
            existingScript.remove();
        }

        midtransSnapScriptConfig = {
            clientKey: normalizedClientKey,
            scriptUrl,
        };

        midtransSnapScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.id = MIDTRANS_SNAP_SCRIPT_ID;
            script.src = scriptUrl;
            script.async = true;
            script.setAttribute('data-client-key', normalizedClientKey);
            script.onload = () => {
                if (window.snap && typeof window.snap.pay === 'function') {
                    resolve(window.snap);
                    return;
                }
                reject(new Error('Snap.js gagal dimuat.'));
            };
            script.onerror = () => {
                reject(new Error('Gagal memuat library Midtrans Snap.'));
            };
            document.head.appendChild(script);
        }).catch((error) => {
            midtransSnapScriptPromise = null;
            throw error;
        });

        await midtransSnapScriptPromise;
    };

    const openMidtransSnapPopup = async ({ token, clientKey, isProduction }) => {
        const snapToken = String(token || '').trim();
        if (!snapToken) {
            throw new Error('Snap token tidak tersedia.');
        }

        await ensureMidtransSnapLoaded({ clientKey, isProduction });

        return new Promise((resolve, reject) => {
            try {
                window.snap.pay(snapToken, {
                    onSuccess: (result) => resolve({ event: 'success', result }),
                    onPending: (result) => resolve({ event: 'pending', result }),
                    onError: (result) => resolve({ event: 'error', result }),
                    onClose: () => resolve({ event: 'close', result: null }),
                });
            } catch (error) {
                reject(error);
            }
        });
    };

    const renderOrders = (orders) => {
        if (!orderList) {
            return;
        }
        orderList.innerHTML = '';

        if (!orders.length) {
            showOrderEmpty(true);
            return;
        }

        showOrderEmpty(false);

        orders.forEach((order) => {
            const request = order.Request || {};
            const bid = order.Bid || {};
            const merchant = order.Merchant;
            const merchantUser = merchant?.User;
            const merchantName =
                merchant?.business_name ||
                merchantUser?.name ||
                `Merchant #${order.merchant_id || '-'}`;
            const statusInfo = getOrderStatusInfo(order);
            const totalPrice = Number(order.total_price) || 0;
            const dpAmount = Number(order.dp_amount) || Math.round(totalPrice * DP_PERCENTAGE);
            const etaText = bid.eta ? formatEtaDays(bid.eta) : '-';

            const card = document.createElement('article');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="order-header">
                    <div>
                        <h3 class="order-title">${request.title || 'Request Perbaikan'}</h3>
                        <div class="order-subtitle">Merchant: ${merchantName}</div>
                    </div>
                    <span class="order-status ${statusInfo.className}">${statusInfo.label}</span>
                </div>
                <div class="order-meta">
                    <div class="order-meta-item"><i class="fa-solid fa-wallet" aria-hidden="true"></i>Total: ${formatCurrency(totalPrice)}</div>
                    <div class="order-meta-item"><i class="fa-solid fa-sack-dollar" aria-hidden="true"></i>DP: ${formatCurrency(dpAmount)}</div>
                    <div class="order-meta-item"><i class="fa-solid fa-clock" aria-hidden="true"></i>ETA: ${etaText}</div>
                </div>
                <div class="order-actions">
                    ${
                        statusInfo.className === 'status-payment'
                            ? `<button class="btn-pay" data-pay-type="dp" data-order-id="${order.id}">Bayar DP</button>`
                            : statusInfo.className === 'status-settle'
                                ? `<button class="btn-pay" data-pay-preview data-order-id="${order.id}">Lihat Lampiran</button>`
                                : ''
                    }
                </div>
            `;
            orderList.appendChild(card);
        });
    };

    const refreshOrders = async () => {
        showOrderLoading(true);
        showOrderEmpty(false);
        try {
            const [orders] = await Promise.all([loadOrders(), loadPayments()]);
            renderOrders(orders);
        } catch (error) {
            showOrderEmpty(true);
            if (orderEmpty) {
                orderEmpty.textContent = 'Gagal memuat order.';
            }
        } finally {
            showOrderLoading(false);
        }
    };

    const handlePay = async (orderId, type) => {
        const order = ordersCache.get(orderId);
        if (!order) {
            return false;
        }
        const auth = ensureUserAccess();
        if (!auth?.user?.id) {
            return false;
        }

        const totalPrice = Number(order.total_price) || 0;
        const dpAmount = Number(order.dp_amount) || Math.round(totalPrice * DP_PERCENTAGE);
        const payAmount = type === 'final' ? totalPrice - dpAmount : dpAmount;
        if (!payAmount || payAmount <= 0) {
            return false;
        }

        const confirmed = await askPaymentConfirmation({
            title: 'Konfirmasi Pembayaran',
            message: `Lanjutkan pembayaran sebesar ${formatCurrency(payAmount)}?`,
            confirmText: 'Lanjutkan',
            cancelText: 'Batalkan',
        });
        if (!confirmed) {
            return false;
        }

        try {
            const idempotencyKey = `pay-${order.id}-${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const gatewayResponse = await postJson(
                `${API_BASE}/payment/create`,
                {
                    orderId: order.id,
                    amount: payAmount,
                    type,
                    customerName: auth.user.name,
                    customerEmail: auth.user.email,
                    customerPhone: auth.user.phone,
                },
                { 'X-Idempotency-Key': idempotencyKey }
            );

            const snapToken = gatewayResponse?.snapToken || null;
            const snapClientKey = gatewayResponse?.snapClientKey || window.MIDTRANS_CLIENT_KEY || '';
            const snapIsProduction =
                typeof gatewayResponse?.isProduction === 'boolean'
                    ? gatewayResponse.isProduction
                    : String(window.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true';
            const gatewayStatus = String(gatewayResponse?.status || '').toUpperCase();

            if (gatewayStatus === 'PAID') {
                await showPaymentNotice({
                    title: 'Pembayaran Berhasil',
                    message: 'Pembayaran sudah terkonfirmasi berhasil.',
                });
                await refreshOrders();
                await refreshRequests();
                return true;
            }

            if (!snapToken) {
                await showPaymentNotice({
                    title: 'Pembayaran Gagal',
                    message: 'Snap token belum tersedia. Silakan coba lagi beberapa saat.',
                });
                return false;
            }

            const snapResult = await openMidtransSnapPopup({
                token: snapToken,
                clientKey: snapClientKey,
                isProduction: snapIsProduction,
            });

            if (snapResult?.event === 'error') {
                const providerMessage =
                    snapResult?.result?.status_message ||
                    snapResult?.result?.statusMessage ||
                    'Transaksi gagal diproses.';
                await showPaymentNotice({
                    title: 'Pembayaran Gagal',
                    message: providerMessage,
                });
                await refreshOrders();
                await refreshRequests();
                return false;
            }

            if (snapResult?.event === 'close') {
                await showPaymentNotice({
                    title: 'Popup Ditutup',
                    message: 'Popup pembayaran ditutup. Status transaksi akan tetap dicek otomatis.',
                });
            }

            const lookupId = gatewayResponse.invoiceNumber || gatewayResponse.paymentId || order.id;
            const statusResult = await pollPaymentResult(lookupId);
            const finalStatus = String(statusResult?.status || '').toUpperCase();

            if (finalStatus === 'PAID') {
                if (type === 'final') {
                    try {
                        await putJson(`${API_BASE}/orders/${order.id}`, {
                            status: 'completed',
                            completed_at: new Date().toISOString(),
                        });
                        await putJson(`${API_BASE}/requests/${order.request_id}`, { status: 'completed' });
                    } catch (error) {
                        // callback backend tetap jadi sumber utama sinkronisasi
                    }
                }
                await showPaymentNotice({
                    title: 'Pembayaran Berhasil',
                    message: 'Pembayaran terkonfirmasi berhasil.',
                });
            } else if (finalStatus) {
                await showPaymentNotice({
                    title: 'Status Pembayaran',
                    message: `Pembayaran belum berhasil. Status saat ini: ${finalStatus}.`,
                });
            } else {
                await showPaymentNotice({
                    title: 'Masih Diproses',
                    message: 'Status pembayaran masih diproses. Silakan refresh halaman beberapa saat lagi.',
                });
            }
        } catch (error) {
            await showPaymentNotice({
                title: 'Pembayaran Gagal',
                message: error.message || 'Gagal membuat pembayaran.',
            });
            return false;
        }

        await refreshOrders();
        await refreshRequests();
        return true;
    };

    const refreshRequests = async () => {
        showLoading(true);
        showEmptyState(false);
        showOrderLoading(true);
        showOrderEmpty(false);
        try {
            const [requests, , orders] = await Promise.all([
                loadRequests(),
                loadBids(),
                loadOrders(),
                loadPayments(),
            ]);
            renderOrders(orders);
            renderRequests(requests);
        } catch (error) {
            showEmptyState(true);
            if (emptyState) {
                emptyState.textContent = 'Gagal memuat data request.';
            }
            showOrderEmpty(true);
            if (orderEmpty) {
                orderEmpty.textContent = 'Gagal memuat order.';
            }
        } finally {
            showLoading(false);
            showOrderLoading(false);
        }
    };

    const init = async () => {
        const auth = ensureUserAccess();
        if (!auth) {
            return;
        }
        showLoading(true);
        showEmptyState(false);
        showOrderLoading(true);
        showOrderEmpty(false);
        try {
            populateUserAddress(auth.user);
            await loadCategories();
            const [requests, , orders] = await Promise.all([
                loadRequests(),
                loadBids(),
                loadOrders(),
                loadPayments(),
            ]);
            renderOrders(orders);
            renderRequests(requests);
        } catch (error) {
            showEmptyState(true);
            if (emptyState) {
                emptyState.textContent = 'Gagal memuat data request.';
            }
            showOrderEmpty(true);
            if (orderEmpty) {
                orderEmpty.textContent = 'Gagal memuat order.';
            }
        } finally {
            showLoading(false);
            showOrderLoading(false);
        }
    };

    if (requestList) {
        requestList.addEventListener('click', (event) => {
            const button = event.target.closest('[data-request-id]');
            if (!button) {
                return;
            }
            const requestId = Number(button.dataset.requestId);
            if (requestId) {
                loadDetail(requestId);
            }
        });
    }

    if (bidList) {
        bidList.addEventListener('click', (event) => {
            const button = event.target.closest('[data-select-bid-id]');
            if (!button) {
                return;
            }
            const bidId = Number(button.dataset.selectBidId);
            const bid = currentBids.find((item) => item.id === bidId);
            if (!bid || !currentRequest) {
                return;
            }
            openConfirmModal(bid, currentRequest);
        });
    }

    if (orderList) {
        orderList.addEventListener('click', (event) => {
            const payButton = event.target.closest('[data-pay-type]');
            if (payButton) {
                const orderId = Number(payButton.dataset.orderId);
                const payType = payButton.dataset.payType;
                if (!orderId || !payType) {
                    return;
                }
                handlePay(orderId, payType);
                return;
            }

            const previewButton = event.target.closest('[data-pay-preview]');
            if (!previewButton) {
                return;
            }
            const orderId = Number(previewButton.dataset.orderId);
            if (!orderId) {
                return;
            }
            const order = ordersCache.get(orderId);
            if (order) {
                openPaymentModal(order);
            }
        });
    }

    if (requestForm) {
        requestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearFormAlert();

            const auth = ensureUserAccess();
            if (!auth?.user?.id) {
                showFormAlert('error', 'Silakan login untuk membuat request.');
                return;
            }

            const title = jobTitleInput?.value.trim();
            const description = jobDescriptionInput?.value.trim();
            const categoryId = Number(categorySelect?.value);
            const budgetValue = parseCurrencyInput(jobBudgetInput?.value || '');

            if (!title) {
                showFormAlert('error', 'Judul pekerjaan wajib diisi.');
                return;
            }

            if (!categoryId) {
                showFormAlert('error', 'Pilih kategori terlebih dahulu.');
                return;
            }

            const payload = {
                user_id: auth.user.id,
                title,
                description,
                category_id: categoryId,
                min_bid_amount: budgetValue,
                mode_service: 'teknisi',
            };

            try {
                const created = await postJson(`${API_BASE}/requests`, payload);
                requestForm.reset();
                populateUserAddress(auth.user);
                showFormAlert('success', 'Request berhasil diposting.');
                await refreshRequests();
            } catch (error) {
                showFormAlert('error', error.message || 'Gagal memposting request.');
            }
        });
    }

    if (jobBudgetInput) {
        jobBudgetInput.addEventListener('input', () => {
            const formatted = formatCurrencyInput(jobBudgetInput.value);
            jobBudgetInput.value = formatted;
        });

        jobBudgetInput.addEventListener('blur', () => {
            jobBudgetInput.value = formatCurrencyInput(jobBudgetInput.value);
        });
    }

    if (modal) {
        modal.querySelectorAll('[data-detail-close]').forEach((button) => {
            button.addEventListener('click', closeModal);
        });

        document.addEventListener('keydown', (event) => {
            if (
                event.key === 'Escape' &&
                modal.classList.contains('is-open') &&
                !confirmModal?.classList.contains('is-open') &&
                !paymentModal?.classList.contains('is-open') &&
                !actionModal?.classList.contains('is-open')
            ) {
                closeModal();
            }
        });
    }

    if (confirmModal) {
        confirmModal.querySelectorAll('[data-confirm-close]').forEach((button) => {
            button.addEventListener('click', closeConfirmModal);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && confirmModal.classList.contains('is-open')) {
                closeConfirmModal();
            }
        });
    }

    if (paymentModal) {
        paymentModal.querySelectorAll('[data-payment-close]').forEach((button) => {
            button.addEventListener('click', closePaymentModal);
        });

        document.addEventListener('keydown', (event) => {
            if (
                event.key === 'Escape' &&
                paymentModal.classList.contains('is-open') &&
                !actionModal?.classList.contains('is-open')
            ) {
                closePaymentModal();
            }
        });
    }

    if (actionModal) {
        actionModal.addEventListener('click', (event) => {
            if (!actionModal.classList.contains('is-open')) {
                return;
            }

            const confirmTarget = getClosest(event.target, '#actionConfirmButton');
            if (confirmTarget) {
                closeActionModal(true);
                return;
            }

            const cancelTarget = getClosest(event.target, '#actionCancelButton');
            const closeTarget = getClosest(event.target, '[data-action-close]');
            if (cancelTarget || closeTarget) {
                closeActionModal(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && actionModal.classList.contains('is-open')) {
                closeActionModal(false);
            }
        });
    }

    if (payFinalButton) {
        payFinalButton.addEventListener('click', async () => {
            if (!pendingPaymentOrder) {
                return;
            }
            const paid = await handlePay(pendingPaymentOrder.id, 'final');
            if (paid) {
                closePaymentModal();
            }
        });
    }

    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            if (!pendingSelection?.bid || !pendingSelection?.request) {
                return;
            }
            const { bid, request } = pendingSelection;
            const auth = ensureUserAccess();
            if (!auth?.user?.id) {
                showConfirmAlert('Silakan login untuk melanjutkan.');
                return;
            }

            if (ordersByRequest.has(request.id)) {
                showConfirmAlert('Request ini sudah memiliki merchant terpilih.');
                return;
            }

            const totalPrice = Number(bid.price);
            if (!totalPrice) {
                showConfirmAlert('Harga penawaran tidak valid.');
                return;
            }

            const dpAmount = Math.round(totalPrice * DP_PERCENTAGE);

            try {
                await postJson(`${API_BASE}/orders`, {
                    request_id: request.id,
                    bid_id: bid.id,
                    user_id: auth.user.id,
                    merchant_id: bid.merchant_id,
                    total_price: totalPrice,
                    dp_amount: dpAmount,
                    status: 'dp_paid',
                });
                await putJson(`${API_BASE}/bids/${bid.id}`, { is_selected: true });
                await putJson(`${API_BASE}/requests/${request.id}`, { status: 'closed' });

                await refreshRequests();
                closeConfirmModal();
                closeModal();
            } catch (error) {
                showConfirmAlert(error.message || 'Gagal memilih merchant.');
            }
        });
    }

    init();
})();
