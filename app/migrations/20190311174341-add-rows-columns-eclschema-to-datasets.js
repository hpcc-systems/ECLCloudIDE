'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Datasets', 'rowCount', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'logicalfile'
      })
      .then(() => {
        return queryInterface.addColumn('Datasets', 'columnCount', {
          type: Sequelize.INTEGER,
          allowNull: true,
          after: 'rowCount'
        })
        .then(() => {
          return queryInterface.addColumn('Datasets', 'eclSchema', {
            type: Sequelize.JSON,
            allowNull: true,
            after: 'columnCount'
          });
        });
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Datasets', 'rowCount')
      .then(() => {
        return queryInterface.removeColumn('Datasets', 'columnCount')
          .then(() => {
            return queryInterface.removeColumn('Datasets', 'eclSchema');
          })
      });
  }
};
