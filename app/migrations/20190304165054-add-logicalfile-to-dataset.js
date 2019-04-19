'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Datasets', 'logicalfile', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'filename'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Datasets', 'logicalfile');
  }
};
