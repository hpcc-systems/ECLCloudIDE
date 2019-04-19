'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Datasets', 'eclQuery', {
      type: Sequelize.STRING(4096),
      allowNull: true,
      after: 'eclSchema'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Datasets', 'eclQuery')
  }
};
