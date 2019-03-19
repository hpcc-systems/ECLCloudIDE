'use strict';
module.exports = (sequelize, DataTypes) => {
  const Dataset = sequelize.define('Dataset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    name: DataTypes.STRING,
    filename: DataTypes.STRING,
    logicalfile: DataTypes.STRING,
    rowCount: DataTypes.INTEGER,
    columnCount: DataTypes.INTEGER,
    eclSchema: DataTypes.JSON,
    eclQuery: DataTypes.STRING,
    workspaceId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
  }, {
    paranoid: true,
  });
  Dataset.associate = function(models) {
    Dataset.belongsTo(models.Workspace);
    Dataset.hasMany(models.Workunit, { foreignKey: 'id', targetKey: 'objectId' });
  };
  return Dataset;
};