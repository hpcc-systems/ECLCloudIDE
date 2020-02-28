'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Workunits', 'deletedAt');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Workunits', 'deletedAt', {
      type: Sequelize.DATE,
      after: 'updatedAt'
    });
  }
};