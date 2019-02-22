'use strict';
module.exports = (sequelize, DataTypes) => {
  const Script = sequelize.define('Script', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    name: DataTypes.STRING,
    workspaceId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    workunitId: DataTypes.STRING,
  }, {
    paranoid: true
  });
  Script.associate = function(models) {
    Script.belongsTo(models.Workspace);
    Script.hasMany(models.ScriptRevision);
  };
  return Script;
};