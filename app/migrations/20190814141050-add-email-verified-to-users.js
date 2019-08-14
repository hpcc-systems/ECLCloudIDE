'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'emailVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      after: 'emailAddress'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Users', 'emailVerified')
  }
};
