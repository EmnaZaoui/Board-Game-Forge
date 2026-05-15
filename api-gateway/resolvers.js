module.exports = (clients) => ({
  Query: {
    games: async () => {
      return new Promise((resolve, reject) => {
        clients.gameClient.listGames({}, (err, resp) => {
          if (err) reject(err);
          else resolve(resp.games);
        });
      });
    },
    game: async (_, { id }) => {
      return new Promise((resolve, reject) => {
        clients.gameClient.getGame({ gameId: id }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp.game);
        });
      });
    },
    playtestStatus: async (_, { sessionId }) => {
      return new Promise((resolve, reject) => {
        clients.playtestClient.getPlaytestStatus({ sessionId }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp.session);
        });
      });
    },
    recommendations: async (_, { userId, limit }) => {
      return new Promise((resolve, reject) => {
        clients.recClient.getRecommendations({ userId, limit: limit || 10 }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp.recommendations || []);
        });
      });
    }
  },
  Mutation: {
    register: async (_, { username, password, email }) => {
      return new Promise((resolve, reject) => {
        clients.authClient.register({ username, password, email }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });
    },
    login: async (_, { username, password }) => {
      return new Promise((resolve, reject) => {
        clients.authClient.login({ username, password }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });
    },
    createGame: async (_, { name, description, rules, categories }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      return new Promise((resolve, reject) => {
        clients.gameClient.createGame({ name, description, rules, creatorId: context.user.userId, categories }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp.game);
        });
      });
    },
    startPlaytest: async (_, { gameId }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      return new Promise((resolve, reject) => {
        clients.playtestClient.startPlaytest({ gameId, userId: context.user.userId }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp.session);
        });
      });
    },
    submitMove: async (_, { sessionId, moveJson }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      return new Promise((resolve, reject) => {
        clients.playtestClient.submitMove({ sessionId, moveJson }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });
    },
    completePlaytest: async (_, { sessionId, score }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      return new Promise((resolve, reject) => {
        clients.playtestClient.completePlaytest({ sessionId, score }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });
    }
  }
});