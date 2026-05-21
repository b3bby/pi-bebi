'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const { Op } = Sequelize;
    const titles = [
      'Panduan Cara Bid',
      'Panduan Pembayaran',
      'Panduan Status Order',
      'FAQ Rekomendasi Service',
    ];

    await queryInterface.bulkDelete('knowledge_base', {
      title: { [Op.in]: titles },
    });

    await queryInterface.bulkInsert('knowledge_base', [
      {
        title: 'Panduan Cara Bid',
        content:
          'User membuat request dengan detail kerusakan, merchant memberi penawaran, lalu user memilih bid terbaik sebelum checkout.',
        category: 'app_guide',
        source: 'internal_prd',
        tags: JSON.stringify(['bid', 'request', 'merchant']),
        embedding: null,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Panduan Pembayaran',
        content:
          'Pembayaran diproses dari invoice. Status transaksi yang dipakai sistem: PENDING, PAID, FAILED, EXPIRED, REFUNDED.',
        category: 'payment',
        source: 'internal_prd',
        tags: JSON.stringify(['pembayaran', 'invoice', 'status']),
        embedding: null,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Panduan Status Order',
        content:
          'Status order bisa dipantau dari dashboard order. Jika terjadi kendala, user dapat escalation ke admin.',
        category: 'order',
        source: 'internal_prd',
        tags: JSON.stringify(['status order', 'tracking', 'admin']),
        embedding: null,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'FAQ Rekomendasi Service',
        content:
          'AI merekomendasikan service partner berdasarkan rating, jarak, verified status, dan popularitas.',
        category: 'service',
        source: 'internal_prd',
        tags: JSON.stringify(['service', 'vendor', 'rating', 'jarak']),
        embedding: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('knowledge_base', {
      title: {
        [Op.in]: [
          'Panduan Cara Bid',
          'Panduan Pembayaran',
          'Panduan Status Order',
          'FAQ Rekomendasi Service',
        ],
      },
    });
  },
};
