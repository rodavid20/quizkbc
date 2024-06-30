const { Sequelize, DataTypes, Model } = require("sequelize");

//const sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname') // Example for postgres
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: global.port == 3000 ? "quiz3000.db" : "quiz.db",
  logging: false,
});

class GameSession extends Model {}
GameSession.init(
  {
    sessionId: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: true, // This ensures the question text is not empty
      },
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "GameSession",
  }
);

class Question extends Model {}
Question.init(
  {
    questionId: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    text: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true, // This ensures the question text is not empty
      },
    },
    option1: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    option2: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    option3: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    option4: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    correctOption: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "GameSessions",
        key: "sessionId",
      },
    },
  },
  {
    sequelize,
    modelName: "Question",
  }
);

class PlayerSession extends Model {}

PlayerSession.init(
  {
    playerSessionId: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    playerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    choice: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clientActualTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serverTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'GameSessions',
        key: 'sessionId',
      },
    },
  },
  {
    sequelize,
    modelName: 'PlayerSession',
  }
);

GameSession.hasMany(Question, { foreignKey: "sessionId" });
Question.belongsTo(GameSession, { foreignKey: "sessionId" });

GameSession.hasMany(PlayerSession, { foreignKey: "sessionId" });
PlayerSession.belongsTo(GameSession, { foreignKey: "sessionId" });

module.exports = { sequelize, GameSession, Question, PlayerSession };
