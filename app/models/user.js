'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    username: DataTypes.STRING,
    emailAddress: DataTypes.STRING,
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    password: DataTypes.STRING,
    lastLoginAt: DataTypes.DATE,
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    paranoid: true
  });
  User.associate = function(models) {
    User.belongsToMany(models.Workspace, { through: models.WorkspaceUser } );
  };
  return User;
};