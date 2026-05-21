'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const { Op } = Sequelize;
    const names = [
      'Bengkel Maju Motor',
      'AutoCare Nusantara',
      'Bengkel Prima Service',
      'Garage Jaya Teknik',
    ];

    await queryInterface.bulkDelete('service_partners', {
      name: { [Op.in]: names },
    });

    await queryInterface.bulkInsert('service_partners', [
      {
        name: 'Bengkel Maju Motor',
        address: 'Jl. Pahlawan No. 10, Jakarta Selatan',
        latitude: -6.2421,
        longitude: 106.7991,
        rating: 4.8,
        verified: true,
        description: 'Spesialis tune-up dan service rutin motor harian.',
        popularity: 214,
        response_speed: 15,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'AutoCare Nusantara',
        address: 'Jl. Haji Nawi No. 22, Jakarta Selatan',
        latitude: -6.254,
        longitude: 106.7938,
        rating: 4.6,
        verified: true,
        description: 'Fokus perbaikan mesin, kelistrikan, dan injeksi.',
        popularity: 175,
        response_speed: 20,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Bengkel Prima Service',
        address: 'Jl. Ciledug Raya No. 58, Jakarta Selatan',
        latitude: -6.2695,
        longitude: 106.7645,
        rating: 4.4,
        verified: false,
        description: 'Service ringan, ganti oli, dan pengecekan berkala.',
        popularity: 96,
        response_speed: 35,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Garage Jaya Teknik',
        address: 'Jl. Bintaro Utama No. 8, Tangerang Selatan',
        latitude: -6.2748,
        longitude: 106.7341,
        rating: 4.7,
        verified: true,
        description: 'Penanganan kendaraan sulit hidup dan bunyi mesin kasar.',
        popularity: 188,
        response_speed: 18,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('service_partners', {
      name: {
        [Op.in]: [
          'Bengkel Maju Motor',
          'AutoCare Nusantara',
          'Bengkel Prima Service',
          'Garage Jaya Teknik',
        ],
      },
    });
  },
};
