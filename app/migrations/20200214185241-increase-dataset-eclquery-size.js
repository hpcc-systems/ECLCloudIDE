'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Datasets', 'eclQuery', {
      type: Sequelize.TEXT('16384')
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Datasets', 'eclQuery', {
      type: Sequelize.STRING('4096')
    })
  }
};