'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('scripts', 'workunitId', {
      type: Sequelize.STRING,
      allowNull: false,
      after: 'workspaceId'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('scripts', 'workunitId');
  }
};
