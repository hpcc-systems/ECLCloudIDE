'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('datasets', 'eclQuery', {
      type: Sequelize.STRING(4096),
      allowNull: true,
      after: 'eclSchema'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('datasets', 'eclQuery')
  }
};
