'use strict';
module.exports = (sequelize, DataTypes) => {
  const ScriptRevision = sequelize.define('ScriptRevision', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    scriptId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    content: DataTypes.TEXT
  }, {
    paranoid: true
  });
  ScriptRevision.associate = function(models) {
    ScriptRevision.belongsTo(models.Script);
  };
  return ScriptRevision;
};