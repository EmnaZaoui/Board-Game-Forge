require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const protoPath = 'auth.proto';
const packageDefinition = protoLoader.loadSync(protoPath);
const proto = grpc.loadPackageDefinition(packageDefinition).auth;

const db = new sqlite3.Database(process.env.DATABASE_PATH);
db.run(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  email TEXT
)`);

function generateUUID() { return Date.now() + '-' + Math.random().toString(36); }

const server = new grpc.Server();
server.addService(proto.AuthService.service, {
  Register: (call, callback) => {
    const { username, password, email } = call.request;
    const userId = generateUUID();
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return callback({ code: grpc.status.INTERNAL, details: err.message });
      db.run(`INSERT INTO users (id, username, password_hash, email) VALUES (?, ?, ?, ?)`, [userId, username, hash, email], (err) => {
        if (err) return callback({ code: grpc.status.ALREADY_EXISTS, details: 'Username exists' });
        callback(null, { success: true, message: 'User created', userId });
      });
    });
  },
  Login: (call, callback) => {
    const { username, password } = call.request;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      if (err || !row) return callback({ code: grpc.status.NOT_FOUND, details: 'Invalid credentials' });
      bcrypt.compare(password, row.password_hash, (err, match) => {
        if (!match) return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Invalid credentials' });
        const token = jwt.sign({ userId: row.id, username: row.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        callback(null, { success: true, token, message: 'Logged in', userId: row.id });
      });
    });
  },
  VerifyToken: (call, callback) => {
    try {
      const decoded = jwt.verify(call.request.token, process.env.JWT_SECRET);
      callback(null, { valid: true, userId: decoded.userId, username: decoded.username });
    } catch (e) {
      callback(null, { valid: false });
    }
  }
});

server.bindAsync(`0.0.0.0:${process.env.PORT}`, grpc.ServerCredentials.createInsecure(), () => {
  server.start();
  console.log(`Auth service on port ${process.env.PORT}`);
});