'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Workspaces', 'directoryTree', {
      type: Sequelize.STRING(4098),
      defaultValue: '{ "datasets": {}, "scripts": {} }',
      allowNull: false,
      after: 'cluster'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Workspaces', 'directoryTree')
  }
};
