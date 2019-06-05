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
    name: DataTypes.STRING,
    cluster: DataTypes.STRING,
    directoryTree: {
      type: DataTypes.STRING(4098),
      defaultValue: '{ "datasets": {}, "scripts": {} }',
      allowNull: false,
    }
  }, {
    paranoid: true
  });
  Workspace.associate = function(models) {
    Workspace.hasMany(models.Script);
    Workspace.hasMany(models.Dataset);
    Workspace.belongsToMany(models.User, { through: models.WorkspaceUser } );
  };
  return Workspace;
};