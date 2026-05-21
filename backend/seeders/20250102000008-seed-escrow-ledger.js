'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const releaseAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const seedEscrow = [
      {
        id: 1,
        order_id: 1,
        amount: 50000,
        held_since: now,
        release_at: releaseAt,
        release_policy: 'Release after service completion confirmation.',
        released_to: null,
        status: 'held',
      },
    ];

    await queryInterface.bulkInsert('escrow_ledger', seedEscrow, {
      updateOnDuplicate: [
        'order_id',
        'amount',
        'held_since',
        'release_at',
        'release_policy',
        'released_to',
        'status',
      ],
    });
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('escrow_ledger', { id: { [Op.in]: [1] } });
  },
};
