'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const seedDisputes = [
      {
        id: 1,
        order_id: 1,
        opened_by: 'user',
        opener_id: 1,
        reason: 'Service not finished yet, requesting follow-up.',
        status: 'open',
        admin_notes: null,
        resolution: null,
        created_at: now,
        resolved_at: null,
      },
    ];

    await queryInterface.bulkInsert('disputes', seedDisputes, {
      updateOnDuplicate: [
        'order_id',
        'opened_by',
        'opener_id',
        'reason',
        'status',
        'admin_notes',
        'resolution',
        'created_at',
        'resolved_at',
      ],
    });
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('disputes', { id: { [Op.in]: [1] } });
  },
};
