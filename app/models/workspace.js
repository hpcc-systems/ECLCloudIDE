'use strict';
module.exports = (sequelize, DataTypes) => {
  const Workspace = sequelize.define('Workspace', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    name: DataTypes.STRING
  }, {});
  Workspace.associate = function(models) {
    Workspace.hasMany(models.Script);
    Workspace.belongsToMany(models.User, { through: models.WorkspaceUser } );
  };
  return Workspace;
};