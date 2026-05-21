const { retrieveKnowledge, normalizeText } = require('./knowledgeRetrievalService');
const { recommendServicePartners } = require('./recommendationService');

const DEFAULT_SYSTEM_PROMPT = [
  'Kamu adalah AI Assistant UKM Bid.',
  'Jawab dalam bahasa Indonesia yang ramah, profesional, singkat, dan jelas.',
  'Gunakan konteks internal yang diberikan, jangan mengarang data.',
  'Jika informasi tidak tersedia, minta user menghubungi admin.',
  'Prioritaskan bantuan penggunaan aplikasi, payment support, status order, dan rekomendasi service.',
].join(' ');

const INTENT_KEYWORDS = {
  APP_GUIDE: [
    'cara bid',
    'bagaimana bid',
    'cara upload',
    'cara pakai',
    'panduan',
    'fitur',
    'tutorial',
  ],
  PAYMENT_SUPPORT: [
    'pembayaran',
    'bayar',
    'invoice',
    'status pembayaran',
    'gagal bayar',
    'refund',
    'payment',
  ],
  SERVICE_RECOMMENDATION: [
    'bengkel',
    'service',
    'rekomendasi',
    'vendor',
    'kerusakan',
    'motor',
    'mobil',
  ],
  ORDER_SUPPORT: [
    'status order',
    'tracking',
    'pesanan',
    'order',
    'progres',
  ],
  FAQ: ['faq', 'pertanyaan umum', 'bantuan', 'help'],
};

const NEGATIVE_SENTIMENT_WORDS = [
  'marah',
  'kecewa',
  'jelek',
  'lama',
  'error',
  'gagal',
  'buruk',
  'parah',
  'kesal',
  'ribet',
];

const POSITIVE_SENTIMENT_WORDS = ['terima kasih', 'mantap', 'bagus', 'cepat', 'puas'];

const ABUSIVE_WORDS = ['bodoh', 'anjing', 'tai', 'bangsat', 'kontol', 'tolol'];

const INJECTION_PATTERNS = ['ignore previous instruction', 'system prompt', 'bypass'];

const DIAGNOSTIC_RULES = [
  {
    keywords: ['tidak bisa nyala', 'ga bisa nyala', 'susah hidup', 'starter'],
    label: 'Mesin Sulit Menyala',
    severity: 'sedang',
    causes: ['Aki lemah', 'Busi kotor/aus', 'Aliran bahan bakar tersendat'],
    firstAid: ['Cek indikator aki', 'Periksa busi', 'Hindari starter berulang terlalu lama'],
    estimatedCost: 'Rp150.000 - Rp600.000',
  },
  {
    keywords: ['bunyi kasar', 'berisik', 'ngelitik', 'suara mesin'],
    label: 'Mesin Berisik',
    severity: 'ringan-sedang',
    causes: ['Oli menipis', 'Komponen CVT/rantai aus', 'Perlu tune-up'],
    firstAid: ['Kurangi beban pemakaian', 'Cek volume oli', 'Jadwalkan inspeksi mekanik'],
    estimatedCost: 'Rp100.000 - Rp500.000',
  },
  {
    keywords: ['ac tidak dingin', 'ac panas', 'freon habis', 'ac bocor'],
    label: 'AC Kurang Dingin',
    severity: 'sedang',
    causes: ['Freon berkurang', 'Filter kotor', 'Kompresor menurun'],
    firstAid: ['Bersihkan filter', 'Pastikan indoor-outdoor menyala normal', 'Cek kemungkinan kebocoran'],
    estimatedCost: 'Rp150.000 - Rp900.000',
  },
  {
    keywords: ['kulkas tidak dingin', 'kulkas bocor', 'freezer tidak beku'],
    label: 'Pendinginan Kulkas Bermasalah',
    severity: 'sedang-tinggi',
    causes: ['Thermostat rusak', 'Kondensor kotor', 'Kebocoran refrigeran'],
    firstAid: ['Kurangi buka tutup pintu', 'Bersihkan area belakang kulkas', 'Amankan makanan sensitif'],
    estimatedCost: 'Rp200.000 - Rp1.200.000',
  },
  {
    keywords: ['mesin cuci tidak berputar', 'mesin cuci bocor', 'drain error'],
    label: 'Mesin Cuci Bermasalah',
    severity: 'sedang',
    causes: ['Belt/sabuk aus', 'Pompa pembuangan tersumbat', 'Sensor pintu bermasalah'],
    firstAid: ['Cek selang pembuangan', 'Kurangi muatan berlebih', 'Uji mode spin tanpa beban'],
    estimatedCost: 'Rp120.000 - Rp800.000',
  },
  {
    keywords: ['layar pecah', 'hp cepat panas', 'laptop panas', 'mati total'],
    label: 'Perangkat Elektronik Bermasalah',
    severity: 'sedang-tinggi',
    causes: ['Kerusakan fisik', 'Thermal paste menurun', 'Masalah baterai/kelistrikan'],
    firstAid: ['Matikan perangkat jika overheat', 'Lepaskan charger sementara', 'Backup data penting bila masih bisa menyala'],
    estimatedCost: 'Rp200.000 - Rp2.000.000',
  },
];

const GENERAL_DAMAGE_KEYWORDS = [
  'rusak',
  'error',
  'mati',
  'nggak nyala',
  'tidak nyala',
  'bocor',
  'berisik',
  'panas',
  'bau',
  'asap',
  'getar',
  'lambat',
];

const normalizeForSearch = (value) => normalizeText(value);

const detectIntent = (message) => {
  const normalized = normalizeForSearch(message);

  const scored = Object.entries(INTENT_KEYWORDS)
    .map(([intent, keywords]) => {
      const score = keywords.reduce((acc, keyword) => {
        if (normalized.includes(keyword)) {
          return acc + 1;
        }
        return acc;
      }, 0);

      return { intent, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score === 0) {
    return 'UNKNOWN';
  }

  return scored[0].intent;
};

const detectSentiment = (message) => {
  const normalized = normalizeForSearch(message);
  const negativeScore = NEGATIVE_SENTIMENT_WORDS.filter((word) => normalized.includes(word)).length;
  const positiveScore = POSITIVE_SENTIMENT_WORDS.filter((word) => normalized.includes(word)).length;

  if (negativeScore > positiveScore) {
    return 'negative';
  }

  if (positiveScore > negativeScore) {
    return 'positive';
  }

  return 'neutral';
};

const detectRisk = (message) => {
  const normalized = normalizeForSearch(message);
  const hasAbusive = ABUSIVE_WORDS.some((word) => normalized.includes(word));
  const hasPromptInjection = INJECTION_PATTERNS.some((pattern) => normalized.includes(pattern));
  const isSpamLike = normalized.length > 800 || /(.)\1{7,}/.test(normalized);

  if (hasAbusive || isSpamLike) {
    return 'high';
  }

  if (hasPromptInjection) {
    return 'medium';
  }

  return 'low';
};

const buildTroubleshooting = (message) => {
  const normalized = normalizeForSearch(message);
  const matchedRule = DIAGNOSTIC_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (matchedRule) {
    return [
      `Diagnosis awal: ${matchedRule.label}.`,
      `Tingkat urgensi: ${matchedRule.severity}.`,
      `Kemungkinan penyebab: ${matchedRule.causes.join(', ')}.`,
      `Langkah awal: ${matchedRule.firstAid.join(', ')}.`,
      `Estimasi biaya awal: ${matchedRule.estimatedCost}.`,
      'Catatan: hasil ini adalah screening awal, pemeriksaan teknisi tetap diperlukan untuk diagnosis final.',
    ];
  }

  const hasGeneralDamageSignal = GENERAL_DAMAGE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );

  if (hasGeneralDamageSignal) {
    return [
      'Diagnosis awal: terdeteksi indikasi gangguan teknis yang perlu pemeriksaan langsung.',
      'Saran awal: hentikan pemakaian berat, dokumentasikan gejala, lalu lakukan pengecekan komponen utama.',
      'Saya bisa bantu lanjutkan dengan rekomendasi service partner terdekat jika lokasi tersedia.',
    ];
  }

  return [];
};

const buildQuickActions = (intent) => {
  const baseActions = [
    { label: 'FAQ', value: 'faq' },
    { label: 'Hubungi Admin', value: 'contact_admin' },
  ];

  if (intent === 'PAYMENT_SUPPORT') {
    return [
      { label: 'Bayar Sekarang', value: 'pay_now' },
      { label: 'Lihat Invoice', value: 'view_invoice' },
      ...baseActions,
    ];
  }

  if (intent === 'SERVICE_RECOMMENDATION') {
    return [
      { label: 'Lihat Vendor', value: 'view_vendor' },
      { label: 'Buat Bid', value: 'create_bid' },
      ...baseActions,
    ];
  }

  if (intent === 'ORDER_SUPPORT') {
    return [
      { label: 'Status Order', value: 'order_status' },
      { label: 'Lihat Invoice', value: 'view_invoice' },
      ...baseActions,
    ];
  }

  return [
    { label: 'Cara Bid', value: 'guide_bid' },
    { label: 'Cara Pembayaran', value: 'guide_payment' },
    ...baseActions,
  ];
};

const buildMemoryContext = (history) => {
  if (!Array.isArray(history) || !history.length) {
    return 'Belum ada history chat sebelumnya.';
  }

  return history
    .slice(-5)
    .map((log, index) => {
      const user = String(log.user_message || '').slice(0, 140);
      const ai = String(log.ai_response || '').slice(0, 180);
      return `Riwayat ${index + 1} - User: ${user} | AI: ${ai}`;
    })
    .join('\n');
};

const buildKnowledgeContext = (sources) => {
  if (!sources.length) {
    return 'Tidak ada source internal relevan.';
  }

  return sources
    .map(
      (source, index) =>
        `Sumber ${index + 1} [${source.category || 'general'}] ${source.title}: ${source.snippet}`
    )
    .join('\n');
};

const buildFallbackReply = ({ message, intent, sentiment, sources, troubleshooting, recommendationText }) => {
  const contextLine = sources.length
    ? `Saya menemukan referensi internal: ${sources
        .map((item) => item.title)
        .slice(0, 3)
        .join(', ')}.`
    : 'Untuk saat ini konteks internal yang relevan masih terbatas.';

  if (intent === 'PAYMENT_SUPPORT') {
    return [
      sentiment === 'negative'
        ? 'Saya paham ini menyulitkan, saya bantu cek langkah pembayaran paling aman.'
        : 'Saya bantu untuk kebutuhan pembayaran Anda.',
      contextLine,
      'Silakan cek status invoice terbaru Anda, pastikan nominal dan metode pembayaran sesuai.',
      'Jika status masih gagal, kirimkan nomor order agar bisa ditindaklanjuti admin.',
    ].join(' ');
  }

  if (intent === 'SERVICE_RECOMMENDATION') {
    return [
      'Saya bantu analisa kebutuhan service Anda.',
      ...troubleshooting,
      recommendationText,
      'Jika Anda kirim lokasi (latitude/longitude), saya bisa urutkan rekomendasi yang paling dekat.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (intent === 'ORDER_SUPPORT') {
    return [
      'Untuk status order, pastikan Anda sudah memilih bid dan pembayaran terkonfirmasi.',
      contextLine,
      'Kalau Anda kirim ID order, saya bantu arahkan langkah pengecekan berikutnya.',
    ].join(' ');
  }

  if (intent === 'APP_GUIDE') {
    return [
      'Alur singkat penggunaan aplikasi: buat request, tunggu penawaran merchant, pilih bid terbaik, lalu proses pembayaran.',
      contextLine,
      'Kalau mau, saya bisa jelaskan langkah detail per menu.',
    ].join(' ');
  }

  return [
    'Saya siap bantu pertanyaan seputar bid, pembayaran, status order, atau rekomendasi service.',
    contextLine,
    'Jika pertanyaan Anda sangat spesifik, mohon sertakan detail agar saya bisa jawab lebih tepat.',
  ].join(' ');
};

const callDeepSeek = async ({
  message,
  intent,
  sentiment,
  memoryContext,
  knowledgeContext,
  troubleshooting,
  recommendationText,
}) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: process.env.AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              `Intent: ${intent}`,
              `Sentiment User: ${sentiment}`,
              `Riwayat Sesi:\n${memoryContext}`,
              `Konteks Internal:\n${knowledgeContext}`,
              troubleshooting.length
                ? `Hasil Troubleshooting:\n${troubleshooting.join('\n')}`
                : 'Hasil Troubleshooting: tidak ada',
              recommendationText ? `Rekomendasi Service:\n${recommendationText}` : 'Rekomendasi Service: tidak ada',
              `Pertanyaan User: ${message}`,
              'Beri jawaban singkat, jelas, dan actionable. Jika info kurang, arahkan ke admin.',
            ].join('\n\n'),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      return null;
    }

    return content.trim();
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const formatRecommendationText = (recommendations) => {
  if (!recommendations.length) {
    return '';
  }

  return recommendations
    .map((item, index) => {
      const distanceLabel = item.distanceKm === null ? 'jarak tidak tersedia' : `${item.distanceKm} km`;
      return `${index + 1}. ${item.name} (rating ${item.rating}, ${distanceLabel}, score ${item.score})`;
    })
    .join('\n');
};

const buildEscalationResponse = (sentiment) => {
  const opener = sentiment === 'negative'
    ? 'Saya memahami keluhan Anda dan ingin bantu secepat mungkin.'
    : 'Saya butuh bantuan admin untuk pertanyaan ini.';

  return `${opener} Silakan hubungi admin/customer service agar kasus ini ditangani langsung.`;
};

const generateAssistantReply = async ({
  message,
  history,
  latitude,
  longitude,
}) => {
  const intent = detectIntent(message);
  const sentiment = detectSentiment(message);
  const riskLevel = detectRisk(message);

  if (riskLevel === 'high') {
    return {
      intent,
      sentiment,
      riskLevel,
      sources: [],
      recommendations: [],
      quickActions: buildQuickActions('UNKNOWN'),
      reply: buildEscalationResponse(sentiment),
      escalated: true,
    };
  }

  const sources = await retrieveKnowledge({ message, intent, limit: 4 });
  const troubleshooting = buildTroubleshooting(message);

  const recommendations =
    intent === 'SERVICE_RECOMMENDATION'
      ? await recommendServicePartners({ issue: message, latitude, longitude, limit: 5 })
      : [];

  const recommendationText = formatRecommendationText(recommendations);
  const memoryContext = buildMemoryContext(history);
  const knowledgeContext = buildKnowledgeContext(sources);

  let reply = await callDeepSeek({
    message,
    intent,
    sentiment,
    memoryContext,
    knowledgeContext,
    troubleshooting,
    recommendationText,
  });

  if (!reply) {
    reply = buildFallbackReply({
      message,
      intent,
      sentiment,
      sources,
      troubleshooting,
      recommendationText,
    });
  }

  const shouldEscalate = intent === 'UNKNOWN' && !sources.length;
  if (shouldEscalate) {
    reply = `${reply} Jika masih belum terjawab, silakan pilih tombol Hubungi Admin.`;
  }

  return {
    intent,
    sentiment,
    riskLevel,
    sources,
    recommendations,
    quickActions: buildQuickActions(intent),
    reply,
    escalated: shouldEscalate || riskLevel !== 'low',
  };
};

module.exports = {
  detectIntent,
  detectSentiment,
  detectRisk,
  generateAssistantReply,
};
