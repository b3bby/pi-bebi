'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const seedCategories = [
      {
        id: 1,
        name: 'Cleaning',
        parent_id: null,
        created_at: now,
      },
      {
        id: 2,
        name: 'Plumbing',
        parent_id: null,
        created_at: now,
      },
      {
        id: 3,
        name: 'Home Repair',
        parent_id: null,
        created_at: now,
      },
      {
        id: 4,
        name: 'AC Service',
        parent_id: 3,
        created_at: now,
      },
    ];

    await queryInterface.bulkInsert('categories', seedCategories, {
      updateOnDuplicate: ['name', 'parent_id', 'created_at'],
    });
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    const categoryIds = [1, 2, 3, 4];

    await queryInterface.bulkDelete('requests', {
      [Op.or]: [
        { id: { [Op.in]: [1, 2] } },
        { user_id: 1, category_id: { [Op.in]: categoryIds } },
      ],
    });

    await queryInterface.sequelize.query(`
      DELETE FROM categories
      WHERE id IN (1, 2, 3, 4)
        AND id NOT IN (
          SELECT DISTINCT category_id
          FROM requests
          WHERE category_id IS NOT NULL
        )
    `);
  },
};
