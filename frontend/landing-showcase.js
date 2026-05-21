(() => {
    const summaryTotalReviews = document.getElementById('summaryTotalReviews');
    const summaryAverageRating = document.getElementById('summaryAverageRating');
    const summaryCompletedOrders = document.getElementById('summaryCompletedOrders');
    const reviewList = document.getElementById('reviewList');

    if (!reviewList) {
        return;
    }

    const dummySummary = {
        totalReviews: 142,
        averageRating: 4.9,
        completedOrders: 580,
    };

    const dummyReviews = [
        {
            rating: 5,
            comment: 'AC sempat tidak dingin, setelah dicek langsung normal lagi dan area kerja dirapikan sebelum teknisi pulang.',
            service: 'Perbaikan AC',
            User: { name: 'Siti Nurhaliza' },
            Merchant: { business_name: 'Sejuk Teknik' },
            created_at: '2026-05-18T10:15:00+07:00',
        },
        {
            rating: 5,
            comment: 'Mesin cuci bunyi keras, teknisi ganti komponen yang rusak dan kasih tips perawatan supaya tidak terulang.',
            service: 'Service Mesin Cuci',
            User: { name: 'Andi Pratama' },
            Merchant: { business_name: 'Laundry Fix Pro' },
            created_at: '2026-05-16T14:00:00+07:00',
        },
        {
            rating: 4,
            comment: 'Kulkas sempat tidak dingin. Proses diagnosa detail, sparepart ready, dan hasil akhir sesuai ekspektasi.',
            service: 'Perbaikan Kulkas',
            User: { name: 'Nadia Azzahra' },
            Merchant: { business_name: 'CoolCare Service' },
            created_at: '2026-05-13T09:30:00+07:00',
        },
        {
            rating: 5,
            comment: 'Laptop overheat, dibersihkan dan ganti thermal paste. Sekarang performa lebih stabil untuk kerja harian.',
            service: 'Service Laptop',
            User: { name: 'Rizky Ramadhan' },
            Merchant: { business_name: 'TechPoint Repair' },
            created_at: '2026-05-10T19:10:00+07:00',
        },
        {
            rating: 5,
            comment: 'TV tiba-tiba mati, teknisi datang malam hari dan langsung ketemu masalah di power supply. Besoknya normal kembali.',
            service: 'Perbaikan TV',
            User: { name: 'Dewi Lestari' },
            Merchant: { business_name: 'Elektronik Jaya' },
            created_at: '2026-05-08T20:25:00+07:00',
        },
        {
            rating: 4,
            comment: 'Pompa air sering mati hidup. Setelah servis, tekanan air stabil dan teknisi jelaskan cara pakai yang aman.',
            service: 'Service Pompa Air',
            User: { name: 'Budi Santoso' },
            Merchant: { business_name: 'Home Utility Fix' },
            created_at: '2026-05-05T08:45:00+07:00',
        },
    ];

    const escapeHtml = (value) =>
        String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const formatDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return 'Baru saja';
        }

        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const starText = (rating) => {
        const safe = Math.max(0, Math.min(5, Number(rating) || 0));
        const full = Math.round(safe);
        return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;
    };

    const renderSummary = (summary) => {
        if (summaryTotalReviews) {
            summaryTotalReviews.textContent = `${summary.totalReviews || 0}+`;
        }

        if (summaryAverageRating) {
            summaryAverageRating.textContent = summary.averageRating
                ? `${Number(summary.averageRating).toFixed(1)}/5`
                : '0.0/5';
        }

        if (summaryCompletedOrders) {
            summaryCompletedOrders.textContent = `${summary.completedOrders || 0}+`;
        }
    };

    const buildReviewCardMarkup = (review) => {
        const userName = review?.User?.name || 'User';
        const merchantName = review?.Merchant?.business_name || 'Merchant';
        const rating = Number(review.rating) || 0;
        const comment = review.comment || 'Review belum tersedia.';
        const service = review.service || 'Layanan perbaikan';

        return `
            <article class="review-card">
                <div class="review-top">
                    <div class="review-stars" aria-label="rating ${rating}">${starText(rating)}</div>
                    <div class="review-date">${formatDate(review.created_at)}</div>
                </div>
                <p class="review-comment">${escapeHtml(comment)}</p>
                <div class="review-meta">
                    <span class="review-user">${escapeHtml(userName)}</span>
                    <span class="review-merchant">${escapeHtml(merchantName)} (<span class="review-service">${escapeHtml(service)}</span>)</span>
                </div>
            </article>
        `;
    };

    const renderReviews = (reviews) => {
        reviewList.innerHTML = '';
        const safeReviews = Array.isArray(reviews) ? reviews.filter(Boolean) : [];

        if (!safeReviews.length) {
            return;
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const slider = document.createElement('div');
        slider.className = 'review-slider';

        const track = document.createElement('div');
        track.className = 'review-slider-track';
        slider.appendChild(track);

        const shouldAutoSlide = safeReviews.length > 1 && !prefersReducedMotion;
        const renderedReviews = shouldAutoSlide ? [...safeReviews, safeReviews[0]] : [safeReviews[0]];

        renderedReviews.forEach((review, index) => {
            const slide = document.createElement('div');
            slide.className = 'review-slide';

            if (shouldAutoSlide && index === renderedReviews.length - 1) {
                slide.setAttribute('aria-hidden', 'true');
            }

            slide.innerHTML = buildReviewCardMarkup(review);
            track.appendChild(slide);
        });

        reviewList.appendChild(slider);

        if (!shouldAutoSlide) {
            return;
        }

        const totalRealSlides = safeReviews.length;
        let currentIndex = 0;
        let slideTimer = null;
        let isTransitioning = false;

        const moveTo = (index, withTransition) => {
            track.style.transition = withTransition ? 'transform 450ms ease' : 'none';
            track.style.transform = `translateX(-${index * 100}%)`;
            currentIndex = index;
        };

        const startAutoSlide = () => {
            if (slideTimer) {
                clearInterval(slideTimer);
            }

            slideTimer = setInterval(() => {
                if (isTransitioning) {
                    return;
                }

                isTransitioning = true;
                moveTo(currentIndex + 1, true);
            }, 3200);
        };

        moveTo(0, false);
        startAutoSlide();

        track.addEventListener('transitionend', () => {
            isTransitioning = false;

            if (currentIndex >= totalRealSlides) {
                moveTo(0, false);
            }
        });

        slider.addEventListener('mouseenter', () => {
            if (slideTimer) {
                clearInterval(slideTimer);
            }
        });

        slider.addEventListener('mouseleave', () => {
            startAutoSlide();
        });
    };

    const initShowcase = () => {
        renderSummary(dummySummary);
        renderReviews(dummyReviews);
    };

    initShowcase();
})();
