'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'emailAddress', {
      type: Sequelize.STRING,
      allowNull: false,
      after: 'username'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Users', 'emailAddress')
  }
};
