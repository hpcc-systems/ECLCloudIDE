'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'lastLoginAt', {
        type: Sequelize.DATE,
        after: 'password'
      })
      .then(() => {
        return queryInterface.addColumn('Users', 'loginAttempts', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          after: 'lastLoginAt'
        })
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Users', 'lastLoginAt')
      .then(() => {
        return queryInterface.removeColumn('Users', 'loginAttempts');
      });
  }
};