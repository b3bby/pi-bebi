'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const etaTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const seedBids = [
      {
        id: 1,
        request_id: 1,
        merchant_id: 1,
        price: 250000,
        eta: etaTomorrow,
        note: 'Can arrive tomorrow morning.',
        is_selected: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        request_id: 2,
        merchant_id: 1,
        price: 300000,
        eta: etaTomorrow,
        note: 'Include cleaning and refill.',
        is_selected: false,
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('bids', seedBids, {
      updateOnDuplicate: [
        'request_id',
        'merchant_id',
        'price',
        'eta',
        'note',
        'is_selected',
        'updated_at',
      ],
    });
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('bids', { id: { [Op.in]: [1, 2] } });
  },
};
