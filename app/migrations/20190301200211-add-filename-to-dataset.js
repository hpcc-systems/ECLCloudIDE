'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Datasets', 'filename', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'name'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Datasets', 'filename');
  }
};
