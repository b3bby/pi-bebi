'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const seedPayments = [
      {
        id: 1,
        order_id: 1,
        user_id: 1,
        merchant_id: 1,
        amount: 50000,
        type: 'dp',
        status: 'succeeded',
        provider_txn_id: 'TXN-DEMO-001',
        created_at: now,
      },
    ];

    await queryInterface.bulkInsert('payments', seedPayments, {
      updateOnDuplicate: [
        'order_id',
        'user_id',
        'merchant_id',
        'amount',
        'type',
        'status',
        'provider_txn_id',
      ],
    });
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('payments', { id: { [Op.in]: [1] } });
  },
};
