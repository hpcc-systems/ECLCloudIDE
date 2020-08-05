'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Workspaces', 'directoryTree', {
      type: Sequelize.TEXT('16384')
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Workspaces', 'directoryTree', {
      type: Sequelize.STRING('4096')
    })
  }
};