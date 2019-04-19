'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Workspaces', 'cluster', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'name'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Workspaces', 'cluster')
  }
};
