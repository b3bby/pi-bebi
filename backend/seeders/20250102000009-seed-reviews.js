'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const seedReviews = [
      {
        id: 1,
        order_id: 1,
        user_id: 1,
        merchant_id: 1,
        rating: 5,
        comment: 'Good service and on time.',
        created_at: now,
      },
    ];

    await queryInterface.bulkInsert('reviews', seedReviews, {
      updateOnDuplicate: ['order_id', 'user_id', 'merchant_id', 'rating', 'comment', 'created_at'],
    });
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('reviews', { id: { [Op.in]: [1] } });
  },
};
