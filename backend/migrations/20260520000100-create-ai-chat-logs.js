'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_chat_logs', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      session_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      user_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      ai_response: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      intent: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      sentiment: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      risk_level: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'low',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('ai_chat_logs', ['session_id']);
    await queryInterface.addIndex('ai_chat_logs', ['user_id']);
    await queryInterface.addIndex('ai_chat_logs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_chat_logs');
  },
};
