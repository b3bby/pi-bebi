const { fn, col } = require('sequelize');
const { Review, Merchant, User, Order } = require('../models');
const createCrudController = require('./crudController');

const baseController = createCrudController(Review);

const parsePagination = (query) => {
  const options = {};
  const limit = Number.parseInt(query.limit, 10);
  const offset = Number.parseInt(query.offset, 10);

  if (!Number.isNaN(limit)) {
    options.limit = Math.min(Math.max(limit, 1), 50);
  }

  if (!Number.isNaN(offset)) {
    options.offset = Math.max(offset, 0);
  }

  return options;
};

const reviewIncludes = [
  {
    model: User,
    attributes: ['id', 'name'],
  },
  {
    model: Merchant,
    attributes: ['id', 'business_name', 'rating_cache'],
  },
  {
    model: Order,
    attributes: ['id', 'request_id', 'status', 'created_at'],
  },
];

const getAll = async (req, res) => {
  try {
    const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
    const options = parsePagination(req.query);

    const records = await Review.findAll({
      ...options,
      include: reviewIncludes,
      order: [['created_at', sort]],
    });

    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const record = await Review.findByPk(req.params.id, {
      include: reviewIncludes,
    });

    if (!record) {
      return res.status(404).json({ message: 'Not found' });
    }

    return res.json(record);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getShowcase = async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10);
    const safeLimit = Number.isNaN(limit) ? 6 : Math.min(Math.max(limit, 3), 12);

    const [recentReviews, totalReviews, avgResult, completedOrders, merchants] = await Promise.all([
      Review.findAll({
        include: reviewIncludes,
        order: [['created_at', 'DESC']],
        limit: safeLimit,
      }),
      Review.count(),
      Review.findOne({
        attributes: [[fn('AVG', col('rating')), 'averageRating']],
        raw: true,
      }),
      Order.count({ where: { status: 'completed' } }),
      Merchant.findAll({
        attributes: ['id', 'business_name', 'rating_cache'],
        include: [
          {
            model: Review,
            attributes: ['rating'],
          },
        ],
      }),
    ]);

    const topMerchants = merchants
      .map((merchant) => {
        const ratings = Array.isArray(merchant.Reviews) ? merchant.Reviews.map((item) => Number(item.rating) || 0) : [];
        const reviewCount = ratings.length;
        const avgRating = reviewCount
          ? ratings.reduce((acc, item) => acc + item, 0) / reviewCount
          : Number(merchant.rating_cache || 0);

        return {
          id: merchant.id,
          name: merchant.business_name,
          averageRating: Number(avgRating.toFixed(2)),
          reviewCount,
        };
      })
      .filter((merchant) => merchant.averageRating > 0)
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.reviewCount - a.reviewCount;
      })
      .slice(0, 5);

    const averageRating = Number(avgResult?.averageRating || 0);

    return res.json({
      summary: {
        totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        completedOrders,
      },
      recentReviews,
      topMerchants,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  ...baseController,
  getAll,
  getById,
  getShowcase,
};
