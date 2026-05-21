const { ServicePartner } = require('../../models');

const EARTH_RADIUS_KM = 6371;

const degToRad = (deg) => (deg * Math.PI) / 180;

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const normalize = (value, maxValue) => {
  if (!maxValue || maxValue <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / maxValue));
};

const sanitizeIssueTokens = (issue) =>
  String(issue || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);

const computeIssueBoost = (issueTokens, partner) => {
  if (!issueTokens.length) {
    return 0;
  }

  const searchable = `${partner.name || ''} ${partner.description || ''}`.toLowerCase();
  const hitCount = issueTokens.filter((token) => searchable.includes(token)).length;
  return Math.min(0.15, hitCount * 0.05);
};

const mapPartner = (partner, latitude, longitude, score, distanceKm) => ({
  id: partner.id,
  name: partner.name,
  address: partner.address,
  latitude: partner.latitude,
  longitude: partner.longitude,
  rating: Number(partner.rating || 0),
  verified: Boolean(partner.verified),
  description: partner.description,
  popularity: Number(partner.popularity || 0),
  responseSpeed: partner.response_speed,
  distanceKm,
  score,
  estimatedCost: null,
  actions: ['Lihat Vendor', 'Hubungi Admin'],
});

const recommendServicePartners = async ({ issue, latitude, longitude, limit = 5 }) => {
  const partners = await ServicePartner.findAll({ where: {} });
  if (!partners.length) {
    return [];
  }

  const withDistance = partners.map((partner) => {
    const lat = Number(partner.latitude);
    const lng = Number(partner.longitude);

    const hasUserLocation = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    const distanceKm = hasUserLocation
      ? haversineDistance(Number(latitude), Number(longitude), lat, lng)
      : null;

    return {
      partner,
      distanceKm,
    };
  });

  const validDistances = withDistance
    .map((item) => item.distanceKm)
    .filter((distance) => Number.isFinite(distance));

  const maxDistance = validDistances.length
    ? Math.max(...validDistances)
    : 1;

  const maxPopularity = Math.max(
    ...partners.map((partner) => Number(partner.popularity || 0)),
    1
  );

  const issueTokens = sanitizeIssueTokens(issue);

  const scored = withDistance.map(({ partner, distanceKm }) => {
    const ratingScore = Math.max(0, Math.min(1, Number(partner.rating || 0) / 5));

    const distanceScore = Number.isFinite(distanceKm)
      ? 1 - normalize(distanceKm, maxDistance)
      : 0.5;

    const verifiedScore = partner.verified ? 1 : 0;
    const popularityScore = normalize(Number(partner.popularity || 0), maxPopularity);
    const issueBoost = computeIssueBoost(issueTokens, partner);

    const weightedScore =
      ratingScore * 0.4 + distanceScore * 0.3 + verifiedScore * 0.2 + popularityScore * 0.1 + issueBoost;

    return {
      partner,
      score: Number(weightedScore.toFixed(4)),
      distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ partner, score, distanceKm }) =>
      mapPartner(partner, latitude, longitude, score, distanceKm)
    );
};

module.exports = {
  recommendServicePartners,
  haversineDistance,
};
