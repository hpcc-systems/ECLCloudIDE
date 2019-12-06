'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Scripts', 'cluster', {
      type: Sequelize.STRING,
      after: 'eclFilePath'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Scripts', 'cluster')
  }
};