'use strict';
module.exports = (sequelize, DataTypes) => {
  const Workunit = sequelize.define('Workunit', {
    workunitId: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    objectId: DataTypes.UUID,
  }, {
    paranoid: true
  });
  Workunit.associate = function(models) {
    Workunit.belongsTo(models.Dataset, { foreignKey: 'objectId', targetKey: 'id' });
    Workunit.belongsTo(models.Script, { foreignKey: 'objectId', targetKey: 'id' });
  };
  return Workunit;
};