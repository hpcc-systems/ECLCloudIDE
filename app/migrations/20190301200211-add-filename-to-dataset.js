'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('datasets', 'filename', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'name'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('datasets', 'filename');
  }
};
