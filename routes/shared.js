import { Op } from 'sequelize';

export const getCommonFilters = (startDate, endDate) => ({
  billingDate: {
    [Op.between]: [startDate, endDate]
  },
  businessLineId: {
    [Op.in]: ['P07', 'P08', 'P12']
  },
  [Op.not]: {
    [Op.and]: [
      { dataFlag: 'Primary Sales' },
      { channel: 'Distributor - A' }
    ]
  }
});
