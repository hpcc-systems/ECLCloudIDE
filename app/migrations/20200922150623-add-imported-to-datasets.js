'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Datasets', 'imported', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      after: 'logicalfile'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Datasets', 'imported')
  }
};