'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Workspaces', 'clusterUser', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'cluster'
      })
      .then(() => {
        return queryInterface.addColumn('Workspaces', 'clusterPwd', {
          type: Sequelize.STRING,
          allowNull: true,
          after: 'clusterUser'
        });
      });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Workspaces', 'clusterUser')
      .then(() => {
        return queryInterface.removeColumn('Workspaces', 'clusterPwd');
      });
  }
};