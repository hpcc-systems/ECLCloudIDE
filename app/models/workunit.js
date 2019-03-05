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
    Workunit.belongsTo(models.Dataset);
    Workunit.belongsTo(models.Script);
  };
  return Workunit;
};