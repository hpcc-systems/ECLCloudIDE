'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('datasets', 'workunitId', {
      type: Sequelize.STRING,
      allowNull: false,
      after: 'workspaceId'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('datasets', 'workunitId');
  }
};
