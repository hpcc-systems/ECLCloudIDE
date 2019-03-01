'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('datasets', 'filename', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'name'
    }).then(() => queryInterface.addIndex('datasets', {
      name: 'workspaceId_filename',
      fields: [ 'workspaceId', 'filename' ],
      unique: true
    }));
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeIndex('datasets', 'workspaceId_filename')
      .then(() => queryInterface.removeColumn('datasets', 'filename'));
  }
};
