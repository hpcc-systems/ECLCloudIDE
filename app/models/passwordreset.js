'use strict';
module.exports = (sequelize, DataTypes) => {
  const PasswordReset = sequelize.define('PasswordReset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    userId: DataTypes.UUID
  }, {
    paranoid: true
  });
  PasswordReset.associate = function(models) {
    PasswordReset.belongsTo(models.User);
  };
  return PasswordReset;
};