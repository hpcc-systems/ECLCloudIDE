'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('workspaces', 'cluster', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'name'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('workspaces', 'cluster')
  }
};
