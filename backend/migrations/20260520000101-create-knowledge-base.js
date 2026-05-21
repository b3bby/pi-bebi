'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('knowledge_base', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      source: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      embedding: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('knowledge_base', ['category']);
    await queryInterface.addIndex('knowledge_base', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('knowledge_base');
  },
};
