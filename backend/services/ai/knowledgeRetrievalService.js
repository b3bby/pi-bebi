const { KnowledgeBase } = require('../../models');

const INTENT_CATEGORY_MAP = {
  APP_GUIDE: ['app_guide', 'faq', 'guide'],
  PAYMENT_SUPPORT: ['payment', 'faq', 'billing'],
  SERVICE_RECOMMENDATION: ['service', 'recommendation', 'faq'],
  ORDER_SUPPORT: ['order', 'transaction', 'faq'],
  FAQ: ['faq', 'general'],
  UNKNOWN: ['faq', 'general'],
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value) =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3);

const getTagArray = (tags) => {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags.map((item) => String(item).toLowerCase());
  }

  return [String(tags).toLowerCase()];
};

const keywordOverlapScore = (queryTokens, textTokens) => {
  if (!queryTokens.length || !textTokens.length) {
    return 0;
  }

  const textTokenSet = new Set(textTokens);
  const hitCount = queryTokens.filter((token) => textTokenSet.has(token)).length;
  return hitCount / queryTokens.length;
};

const categoryMatchScore = (intent, category) => {
  if (!category) {
    return 0;
  }

  const candidates = INTENT_CATEGORY_MAP[intent] || INTENT_CATEGORY_MAP.UNKNOWN;
  const normalizedCategory = String(category).toLowerCase();
  return candidates.includes(normalizedCategory) ? 0.25 : 0;
};

const tagMatchScore = (queryTokens, tags) => {
  const tagArray = getTagArray(tags);
  if (!queryTokens.length || !tagArray.length) {
    return 0;
  }

  const hitCount = queryTokens.filter((token) =>
    tagArray.some((tag) => tag.includes(token) || token.includes(tag))
  ).length;

  return Math.min(0.15, hitCount * 0.05);
};

const mapKnowledgeSource = (item, score) => ({
  id: item.id,
  title: item.title,
  category: item.category,
  source: item.source || 'internal',
  snippet: String(item.content || '').slice(0, 220),
  score: Number(score.toFixed(4)),
});

const FALLBACK_KNOWLEDGE = [
  {
    id: 'faq-bid',
    title: 'Cara Bid',
    category: 'app_guide',
    source: 'fallback',
    content: 'Untuk bid, user membuat request perbaikan, merchant memberikan penawaran, lalu user memilih penawaran terbaik dan lanjut pembayaran.',
  },
  {
    id: 'faq-payment',
    title: 'Cara Pembayaran',
    category: 'payment',
    source: 'fallback',
    content: 'Pembayaran dibuat dari invoice. Status umum: PENDING, PAID, FAILED, EXPIRED, dan REFUNDED.',
  },
  {
    id: 'faq-order',
    title: 'Status Order',
    category: 'order',
    source: 'fallback',
    content: 'Status order bisa dipantau dari dashboard order user. Jika ada kendala, user dapat menghubungi admin melalui fitur bantuan.',
  },
];

const retrieveKnowledge = async ({ message, intent, limit = 4 }) => {
  const queryTokens = tokenize(message);

  const knowledgeRows = await KnowledgeBase.findAll({
    order: [['updated_at', 'DESC']],
    limit: 200,
  });

  const pool = knowledgeRows.length
    ? knowledgeRows
    : FALLBACK_KNOWLEDGE;

  const scored = pool
    .map((item) => {
      const searchableText = `${item.title || ''} ${item.content || ''}`;
      const textTokens = tokenize(searchableText);
      const keywordScore = keywordOverlapScore(queryTokens, textTokens);
      const categoryScore = categoryMatchScore(intent, item.category);
      const tagsScore = tagMatchScore(queryTokens, item.tags);

      const score = keywordScore + categoryScore + tagsScore;
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length > 0) {
    return scored.map(({ item, score }) => mapKnowledgeSource(item, score));
  }

  return pool.slice(0, Math.min(2, pool.length)).map((item) => mapKnowledgeSource(item, 0.01));
};

module.exports = {
  retrieveKnowledge,
  normalizeText,
  tokenize,
};
