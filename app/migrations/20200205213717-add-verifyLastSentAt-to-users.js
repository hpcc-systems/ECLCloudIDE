'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'verifyLastSentAt', {
      type: Sequelize.DATE,
      after: 'emailVerified'
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Users', 'verifyLastSentAt')
  }
};