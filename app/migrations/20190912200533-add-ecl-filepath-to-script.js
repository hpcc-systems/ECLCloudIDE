'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Scripts', 'eclFilePath', {
      type: Sequelize.STRING,
      after: 'name'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Scripts', 'eclFilePath')
  }
};
