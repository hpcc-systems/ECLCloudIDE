'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('WorkspaceUsers', {
      role: {
        allowNull: false,
        type: Sequelize.ENUM,
        values: [ 'OWNER', 'CONTRIBUTOR', 'GUEST' ]
      },
      workspaceId: {
        type: Sequelize.UUID,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        primaryKey: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('WorkspaceUsers');
  }
};