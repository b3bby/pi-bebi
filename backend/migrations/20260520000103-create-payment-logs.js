'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_logs', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'payments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      doku_invoice_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      request_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      external_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      idempotency_key: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      payload: {
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

    await queryInterface.addIndex('payment_logs', ['order_id']);
    await queryInterface.addIndex('payment_logs', ['payment_id']);
    await queryInterface.addIndex('payment_logs', ['doku_invoice_id']);
    await queryInterface.addIndex('payment_logs', ['request_id']);
    await queryInterface.addIndex('payment_logs', ['idempotency_key']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_logs');
  },
};
