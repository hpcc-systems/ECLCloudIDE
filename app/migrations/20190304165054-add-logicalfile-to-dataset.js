'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('datasets', 'logicalfile', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'filename'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('datasets', 'logicalfile');
  }
};
