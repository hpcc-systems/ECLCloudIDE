'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('datasets', 'rowCount', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'logicalfile'
      })
      .then(() => {
        return queryInterface.addColumn('datasets', 'columnCount', {
          type: Sequelize.INTEGER,
          allowNull: true,
          after: 'rowCount'
        })
        .then(() => {
          return queryInterface.addColumn('datasets', 'eclSchema', {
            type: Sequelize.JSON,
            allowNull: true,
            after: 'columnCount'
          });
        });
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('datasets', 'rowCount')
      .then(() => {
        return queryInterface.removeColumn('datasets', 'columnCount')
          .then(() => {
            return queryInterface.removeColumn('datasets', 'eclSchema');
          })
      });
  }
};
