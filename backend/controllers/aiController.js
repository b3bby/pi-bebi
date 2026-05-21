const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { AiChatLog, User } = require('../models');
const { generateAssistantReply } = require('../services/ai/aiAssistantService');
const { recommendServicePartners } = require('../services/ai/recommendationService');

const jwtSecret = process.env.JWT_SECRET || 'change_this_secret';

const sanitizeMessage = (message) =>
  String(message || '')
    .replace(/\s+/g, ' ')
    .trim();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
};

const resolveUserIdFromToken = (req) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    return payload.id || null;
  } catch (error) {
    return null;
  }
};

const resolveUserContext = async (req) => {
  const userId = resolveUserIdFromToken(req);
  if (!userId) {
    return { userId: null, user: null };
  }

  try {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'location_lat', 'location_lng', 'address'],
    });
    return { userId, user };
  } catch (error) {
    return { userId, user: null };
  }
};

const resolveCoordinates = ({ latitude, longitude, user }) => {
  const clientLat = toFiniteNumber(latitude);
  const clientLng = toFiniteNumber(longitude);

  if (clientLat !== null && clientLng !== null) {
    return { latitude: clientLat, longitude: clientLng, source: 'client' };
  }

  const userLat = toFiniteNumber(user?.location_lat);
  const userLng = toFiniteNumber(user?.location_lng);

  if (userLat !== null && userLng !== null) {
    return { latitude: userLat, longitude: userLng, source: 'profile' };
  }

  return { latitude: null, longitude: null, source: 'none' };
};

const resolveSessionId = (req) => {
  const bodySessionId = req.body?.sessionId;
  const headerSessionId = req.headers['x-session-id'];
  const raw = bodySessionId || headerSessionId;

  if (raw && typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }

  return `sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

const streamReply = (res, payload) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const words = payload.reply.split(/\s+/).filter(Boolean);
  let index = 0;
  let rendered = '';

  const timer = setInterval(() => {
    if (index >= words.length) {
      clearInterval(timer);
      res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
      res.end();
      return;
    }

    rendered = rendered ? `${rendered} ${words[index]}` : words[index];
    res.write(`event: chunk\ndata: ${JSON.stringify({ content: rendered })}\n\n`);
    index += 1;
  }, 40);
};

const chat = async (req, res) => {
  try {
    const message = sanitizeMessage(req.body?.message);
    const sessionId = resolveSessionId(req);
    const { userId, user } = await resolveUserContext(req);

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const resolvedCoordinates = resolveCoordinates({
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      user,
    });

    const history = await AiChatLog.findAll({
      where: { session_id: sessionId },
      order: [['created_at', 'ASC']],
      limit: 20,
    });

    const result = await generateAssistantReply({
      message,
      history,
      latitude: resolvedCoordinates.latitude,
      longitude: resolvedCoordinates.longitude,
    });

    const saved = await AiChatLog.create({
      user_id: userId,
      session_id: sessionId,
      user_message: message,
      ai_response: result.reply,
      intent: result.intent,
      sentiment: result.sentiment,
      risk_level: result.riskLevel,
    });

    const responsePayload = {
      id: saved.id,
      sessionId,
      reply: result.reply,
      intent: result.intent,
      sentiment: result.sentiment,
      riskLevel: result.riskLevel,
      sources: result.sources,
      quickActions: result.quickActions,
      recommendations: result.recommendations,
      escalated: result.escalated,
      locationSource: resolvedCoordinates.source,
      streamSupported: true,
    };

    const streamEnabled = req.query.stream === 'true' || Boolean(req.body?.stream);
    if (streamEnabled) {
      streamReply(res, responsePayload);
      return undefined;
    }

    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const recommendService = async (req, res) => {
  try {
    const issue = sanitizeMessage(req.body?.issue);
    if (!issue) {
      return res.status(400).json({ message: 'Issue is required' });
    }

    const { user } = await resolveUserContext(req);
    const resolvedCoordinates = resolveCoordinates({
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      user,
    });

    const recommendations = await recommendServicePartners({
      issue,
      latitude: resolvedCoordinates.latitude,
      longitude: resolvedCoordinates.longitude,
      limit: 7,
    });

    return res.json({
      issue,
      locationSource: resolvedCoordinates.source,
      recommendations,
      quickActions: [
        { label: 'Lihat Vendor', value: 'view_vendor' },
        { label: 'Buat Bid', value: 'create_bid' },
        { label: 'Hubungi Admin', value: 'contact_admin' },
      ],
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const userId = resolveUserIdFromToken(req);

    if (!sessionId && !userId) {
      return res.status(400).json({ message: 'sessionId or authenticated user is required' });
    }

    const where = {};

    if (sessionId) {
      where.session_id = sessionId;
      if (userId) {
        where[Op.or] = [{ user_id: userId }, { user_id: null }];
      }
    } else {
      where.user_id = userId;
    }

    const limit = Number.parseInt(req.query.limit, 10);
    const safeLimit = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 100);

    const logs = await AiChatLog.findAll({
      where,
      order: [['created_at', 'ASC']],
      limit: safeLimit,
    });

    return res.json({
      sessionId: sessionId || null,
      count: logs.length,
      data: logs.map((log) => ({
        id: log.id,
        sessionId: log.session_id,
        userMessage: log.user_message,
        aiResponse: log.ai_response,
        intent: log.intent,
        sentiment: log.sentiment,
        riskLevel: log.risk_level,
        createdAt: log.created_at,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  chat,
  recommendService,
  getHistory,
};
