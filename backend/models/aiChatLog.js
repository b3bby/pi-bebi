module.exports = (sequelize, DataTypes) => {
  const AiChatLog = sequelize.define(
    'AiChatLog',
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      session_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ai_response: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      intent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sentiment: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      risk_level: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'low',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'ai_chat_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return AiChatLog;
};
