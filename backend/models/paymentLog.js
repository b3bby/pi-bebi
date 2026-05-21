module.exports = (sequelize, DataTypes) => {
  const PaymentLog = sequelize.define(
    'PaymentLog',
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      payment_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      doku_invoice_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      request_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      external_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      idempotency_key: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'payment_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return PaymentLog;
};
